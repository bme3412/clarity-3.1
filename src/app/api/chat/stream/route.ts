import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { FINANCIAL_TOOLS, TOOL_SYSTEM_PROMPT } from '../../../../lib/tools/index.js';
import { executeToolCallWithTracing } from '../../../../lib/tools/instrumented-executor.js';
import { createTrace, flush } from '../../../../lib/observability/langfuse.js';
import { StreamChatRequestSchema, formatValidationError, type ChatMessage } from '../../../../lib/schemas/api';
import { sanitizeText, summarizeViolations } from '../../../../lib/prompts/guardrails.js';
import { getDataFreshness } from '../../../../lib/data/freshness.js';

// =============================================================================
// TYPES
// =============================================================================

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
}

interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  latencyMs?: number;
}

interface StreamData {
  type: string;
  [key: string]: unknown;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Model configuration
// Options: 
//   - claude-sonnet-4-20250514 (fast, great quality - RECOMMENDED)
//   - claude-opus-4-5-20251101 (slow, best quality)
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

// Limits to prevent excessive tool usage
const MAX_TOOL_LOOPS = 4;  // Reduced from 8
const MAX_TOOL_CALLS_PER_LOOP = 3;  // Limit tools per iteration

if (!ANTHROPIC_API_KEY) {
  console.warn('[api/chat/stream] ANTHROPIC_API_KEY missing; requests will fail.');
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function callAnthropic(payload: Record<string, unknown>): Promise<AnthropicResponse> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ ...payload, model: MODEL })
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${text}`);
  }
  
  return res.json();
}

async function* streamAnthropicResponse(payload: Record<string, unknown>): AsyncGenerator<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ ...payload, model: MODEL, stream: true })
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${text}`);
  }
  
  if (!res.body) {
    throw new Error('No response body');
  }
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') return;
        
        try {
          const event = JSON.parse(dataStr);
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
            yield event.delta.text;
          }
        } catch {
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function toAnthropicMessages(chatHistory: ChatMessage[], userMessage: string): AnthropicMessage[] {
  const msgs: AnthropicMessage[] = [];
  
  (chatHistory || []).forEach((m) => {
    msgs.push({ role: m.role, content: m.content });
  });
  
  msgs.push({ role: 'user', content: userMessage });
  return msgs;
}

function streamData(controller: ReadableStreamDefaultController, data: StreamData): void {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

function detectTickerFromMessage(msg: string): string | null {
  const text = msg.toLowerCase();
  const tickers = [
    { key: 'nvda', aliases: ['nvda', 'nvidia'] },
    { key: 'aapl', aliases: ['aapl', 'apple'] },
    { key: 'amd', aliases: ['amd', 'advanced micro devices'] },
    { key: 'amzn', aliases: ['amzn', 'amazon', 'aws'] },
    { key: 'msft', aliases: ['msft', 'microsoft', 'azure'] },
    { key: 'meta', aliases: ['meta', 'facebook', 'fb'] },
    { key: 'googl', aliases: ['googl', 'google', 'alphabet', 'goog'] },
    { key: 'avgo', aliases: ['avgo', 'broadcom'] },
    { key: 'crm', aliases: ['crm', 'salesforce'] },
    { key: 'orcl', aliases: ['orcl', 'oracle'] }
  ];
  for (const t of tickers) {
    if (t.aliases.some((a) => text.includes(a))) return t.key.toUpperCase();
  }
  return null;
}

function isLikelyFinancial(msg: string): boolean {
  const text = msg.toLowerCase();
  return ['revenue', 'growth', 'margin', 'guidance', 'data center', 'datacenter', 'earnings'].some((k) =>
    text.includes(k)
  );
}

// Enhanced system prompt with strict grounding + tool limits
const ENHANCED_SYSTEM_PROMPT = `You are Clarity 3.0, a disciplined financial analyst for Big Tech companies.

**CURRENT DATE: December 2025**

${TOOL_SYSTEM_PROMPT}

## HARD RULES (GROUNDING + CITATIONS)
- Use ONLY data returned by tools in this conversation. If a fact/number is not in tool results, respond "Not found in provided sources."
- Every number must come from tool output (no guessing). Do NOT extrapolate from memory.
- If tools return empty/opaque values (e.g., missing metrics, [object Object]), say "Not found in provided sources."
- Be concise: 2–5 lines for financial answers, each line with inline references like [C1], [C2] mapping to tool results you saw.

## CRITICAL: Fiscal Year Handling
- Different companies have different fiscal year calendars!
- NVIDIA (NVDA) is on FY2026 (their fiscal year ends in January)
- Most other companies (AMD, AVGO, etc.) are on FY2025
- When users ask for "recent", "latest", or "current" data, use fiscalYear: "latest" to auto-detect
- The system will automatically find the most recent available data for each ticker
- For comparisons across companies, use fiscalYear: "latest" for each to ensure you get their most recent data

## CRITICAL: Tool Usage Limits
- Use AT MOST 2-3 tool calls per question
- Prefer get_multi_quarter_metrics over multiple get_financial_metrics calls
- For qualitative questions, use search_earnings_transcript with topK: 10-15 for comprehensive coverage
- Combine related queries rather than making separate calls
- If you have enough data, STOP calling tools and provide your answer

## Efficiency Guidelines
- Don't search the same transcript multiple times with slight variations
- If data isn't found, mention it once and move on—don't retry with different queries
- Prioritize the most relevant tool for the question type
`;

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const validation = StreamChatRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        formatValidationError(validation.error),
        { status: 400 }
      );
    }

    const { message, chatHistory } = validation.data;
    const requestId = crypto.randomUUID();
    const trace = createTrace({ requestId, userId: null, query: message });

    const stream = new ReadableStream({
      async start(controller) {
        // Metrics tracking
        const metrics = {
          startTime: Date.now(),
          firstTokenTime: 0,
          endTime: 0,
          toolCalls: [] as { tool: string; latencyMs: number; success: boolean }[],
          retrievalResults: 0,
          avgRetrievalScore: 0,
          llmCalls: 0,
          totalTokensEstimate: 0
        };
        
        try {
          const dataFreshness = await getDataFreshness();
          streamData(controller, { type: 'metadata', requestId, dataFreshness });
          
          // Immediate acknowledgment for better perceived latency
          streamData(controller, { type: 'status', message: 'Analyzing your question...' });

          let messages: AnthropicMessage[] = toAnthropicMessages(chatHistory, message);
          let loopCount = 0;
          let totalToolCalls = 0;

          // Proactive financial fetch for numeric intents (prevents empty context)
          const detectedTicker = detectTickerFromMessage(message);
          const wantsFinancials = isLikelyFinancial(message);
          if (detectedTicker && wantsFinancials) {
            const autoInput = {
              ticker: detectedTicker,
              periods: [{ fiscalYear: 'latest' }],
              metrics: ['revenue', 'revenue_segments', 'operating_income', 'net_income']
            };
            streamData(controller, { type: 'status', message: `Fetching latest ${detectedTicker} financials...` });
            const autoExec = await executeToolCallWithTracing('get_multi_quarter_metrics', autoInput, trace);

            // Stream to client
            streamData(controller, {
              type: 'tool_result',
              tool: 'get_multi_quarter_metrics',
              id: 'auto-financials',
              success: autoExec.success,
              result: autoExec.result,
              error: autoExec.error,
              latencyMs: autoExec.latencyMs
            });

            // Provide concise summary back to the model
            const safeSummary = (() => {
              if (!autoExec.success || !autoExec.result) return 'No data.';
              const r = autoExec.result as any;
              if (typeof r === 'string') return r;
              if (r.periods && Array.isArray(r.periods)) {
                return r.periods
                  .map((p: any) => `${p.period}: ${JSON.stringify(p.metrics || {})}`)
                  .join(' | ');
              }
              if (r.summaries?.length) return r.summaries.join(' | ');
              return JSON.stringify(r);
            })();

            // Feed a plain-text summary back to the model (tool_result blocks must be in user role)
            messages.push({
              role: 'user',
              content: `Auto-fetched latest financials for ${detectedTicker}: ${safeSummary}`
            });
          }

          while (loopCount < MAX_TOOL_LOOPS) {
            const genSpan = trace?.span ? trace.span({ name: 'llm:anthropic', input: { messages } }) : null;
            
            const llmCallStart = Date.now();
            const llmResponse = await callAnthropic({
              system: ENHANCED_SYSTEM_PROMPT,
              messages,
              tools: FINANCIAL_TOOLS,
              max_tokens: 2400
            });
            metrics.llmCalls++;
            genSpan?.end({ metadata: { success: true, model: MODEL, latencyMs: Date.now() - llmCallStart } });

            const toolUses = (llmResponse.content || [])
              .filter((c): c is AnthropicContentBlock & { type: 'tool_use' } => c.type === 'tool_use')
              .slice(0, MAX_TOOL_CALLS_PER_LOOP); // Limit tools per loop
              
            const textBlocks = (llmResponse.content || [])
              .filter((c): c is AnthropicContentBlock & { type: 'text' } => c.type === 'text');

            // If there is final text and no tools, send the response
            if (!toolUses.length) {
              // Check if we already have text from this response
              if (textBlocks.length > 0) {
                // Send the text we already received (faster, no extra API call)
                let isFirstToken = true;
                for (const textBlock of textBlocks) {
                  if (textBlock.text) {
                    // Track first token time
                    if (isFirstToken) {
                      metrics.firstTokenTime = Date.now() - metrics.startTime;
                      isFirstToken = false;
                    }
                    const { sanitized, violations } = sanitizeText(textBlock.text);
                    if (violations.length) {
                      streamData(controller, { type: 'status', message: summarizeViolations(violations) });
                    }
                    metrics.totalTokensEstimate += Math.ceil(sanitized.length / 4);
                    
                    // Stream character by character for visual effect
                    const text = sanitized;
                    const chunkSize = 5; // Send ~5 chars at a time for smooth streaming
                    for (let i = 0; i < text.length; i += chunkSize) {
                      streamData(controller, { type: 'content', content: text.slice(i, i + chunkSize) });
                      // Small delay for visual streaming effect
                      await new Promise(resolve => setTimeout(resolve, 10));
                    }
                  }
                }
              } else {
                // No text yet, make a streaming call to get the final response
                const streamPayload = {
                  system: ENHANCED_SYSTEM_PROMPT,
                  messages,
                  max_tokens: 2400
                };
                
                let isFirstToken = true;
                let tokenCount = 0;
                for await (const token of streamAnthropicResponse(streamPayload)) {
                  if (isFirstToken) {
                    metrics.firstTokenTime = Date.now() - metrics.startTime;
                    isFirstToken = false;
                  }
                  const { sanitized, violations } = sanitizeText(token);
                  if (violations.length) {
                    streamData(controller, { type: 'status', message: summarizeViolations(violations) });
                  }
                  tokenCount += Math.ceil(sanitized.length / 4);
                  streamData(controller, { type: 'content', content: sanitized });
                }
                metrics.totalTokensEstimate = tokenCount;
              }
              break;
            }

            // Record assistant tool_use content
            messages.push({ role: 'assistant', content: llmResponse.content });

            // Execute tools (potentially in parallel for independent tools)
            const toolResultsForUser: AnthropicContentBlock[] = [];
            
            // Execute tools - could parallelize but keeping sequential for now
            streamData(controller, { type: 'status', message: `Searching ${toolUses.length > 1 ? toolUses.length + ' sources' : 'knowledge base'}...` });
            
            for (const tu of toolUses) {
              totalToolCalls++;
              streamData(controller, { type: 'tool_start', tool: tu.name, id: tu.id, input: tu.input });
              
              const execResult: ToolExecutionResult = await executeToolCallWithTracing(
                tu.name!, 
                tu.input || {}, 
                trace
              );
              
              // Track metrics
              metrics.toolCalls.push({
                tool: tu.name!,
                latencyMs: execResult.latencyMs || 0,
                success: execResult.success
              });
              
              // Extract retrieval stats if this was a search
              if (tu.name === 'search_earnings_transcript' && execResult.success) {
                const result = execResult.result as { results?: { score?: number }[] };
                if (result?.results) {
                  metrics.retrievalResults += result.results.length;
                  const scores = result.results.map(r => r.score || 0).filter(s => s > 0);
                  if (scores.length > 0) {
                    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                    metrics.avgRetrievalScore = avgScore;
                  }
                }
              }
              
              streamData(controller, {
                type: 'tool_result',
                tool: tu.name,
                id: tu.id,
                success: execResult.success,
              result: execResult.result,
                error: execResult.error,
                latencyMs: execResult.latencyMs
              });

              // Provide a compact, human-readable summary to the model instead of raw objects
              const safeSummary = (() => {
                if (!execResult.success || !execResult.result) return 'No data.';
                const r = execResult.result as any;
                if (typeof r === 'string') return r;
                if (r.metrics && r.period) return `${r.period}: ${JSON.stringify(r.metrics)}`;
                if (r.periods && Array.isArray(r.periods)) {
                  return r.periods
                    .map((p: any) => `${p.period}: ${JSON.stringify(p.metrics || {})}`)
                    .join(' | ');
                }
                if (r.summary) return r.summary;
                if (Array.isArray(r.summaries) && r.summaries.length) return r.summaries.join(' | ');
                return JSON.stringify(r);
              })();

              toolResultsForUser.push({
                type: 'tool_result',
                tool_use_id: tu.id,
                content: safeSummary
              });
            }

            if (toolResultsForUser.length) {
              messages.push({
                role: 'user',
                content: toolResultsForUser
              });
            }

            loopCount += 1;
            
            // Safety: if too many total tool calls, force completion
            if (totalToolCalls >= 6) {
              console.warn(`[stream] Hit tool call limit (${totalToolCalls}), forcing completion`);
              // Add a message to encourage finishing
              messages.push({
                role: 'user',
                content: 'Please provide your analysis now based on the data collected. No more tool calls needed.'
              });
            }
          }

          // Send final metrics
          metrics.endTime = Date.now() - metrics.startTime;
          streamData(controller, { 
            type: 'metrics', 
            metrics: {
              totalTimeMs: metrics.endTime,
              timeToFirstTokenMs: metrics.firstTokenTime,
              llmCalls: metrics.llmCalls,
              toolCalls: metrics.toolCalls.length,
              toolBreakdown: metrics.toolCalls,
              retrievalResults: metrics.retrievalResults,
              avgRetrievalScore: metrics.avgRetrievalScore > 0 ? parseFloat(metrics.avgRetrievalScore.toFixed(3)) : null,
              estimatedTokens: metrics.totalTokensEstimate
            }
          });
          
          streamData(controller, { type: 'end', requestId });
          await flush();
          controller.close();
        } catch (err) {
          const error = err as Error;
          console.error('[stream] Error:', error.message);
          streamData(controller, { type: 'error', error: error.message });
          await flush();
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
