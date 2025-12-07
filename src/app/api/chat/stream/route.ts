import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { FINANCIAL_TOOLS, TOOL_SYSTEM_PROMPT } from '../../../../lib/tools/index.js';
import { executeToolCallWithTracing } from '../../../../lib/tools/instrumented-executor.js';
import { createTrace, flush } from '../../../../lib/observability/langfuse.js';
import { StreamChatRequestSchema, formatValidationError, type ChatMessage } from '../../../../lib/schemas/api';

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

// Model configuration - claude-opus-4-5-20251101 as primary
const MODEL = 'claude-opus-4-5-20251101';

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

// Enhanced system prompt that limits tool usage
const ENHANCED_SYSTEM_PROMPT = `You are Clarity 3.0, a disciplined financial analyst for Big Tech companies.

**CURRENT DATE: December 2025**

${TOOL_SYSTEM_PROMPT}

## CRITICAL: Year/Period Defaults
- The current fiscal year is FY2025 (we are in December 2025)
- When users ask about "recent", "current", or "latest" data, default to FY2025
- For "last quarter", check Q3 or Q4 FY2025 first
- Only fall back to FY2024 if FY2025 data is not available

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
        try {
          streamData(controller, { type: 'metadata', requestId });

          let messages: AnthropicMessage[] = toAnthropicMessages(chatHistory, message);
          let loopCount = 0;
          let totalToolCalls = 0;

          while (loopCount < MAX_TOOL_LOOPS) {
            const genSpan = trace?.span ? trace.span({ name: 'llm:anthropic', input: { messages } }) : null;
            
            const llmResponse = await callAnthropic({
              system: ENHANCED_SYSTEM_PROMPT,
              messages,
              tools: FINANCIAL_TOOLS,
              max_tokens: 1200
            });
            genSpan?.end({ metadata: { success: true, model: MODEL } });

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
                for (const textBlock of textBlocks) {
                  if (textBlock.text) {
                    // Stream character by character for visual effect
                    const text = textBlock.text;
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
                  max_tokens: 1200
                };
                
                for await (const token of streamAnthropicResponse(streamPayload)) {
                  streamData(controller, { type: 'content', content: token });
                }
              }
              break;
            }

            // Record assistant tool_use content
            messages.push({ role: 'assistant', content: llmResponse.content });

            // Execute tools (potentially in parallel for independent tools)
            const toolResultsForUser: AnthropicContentBlock[] = [];
            
            // Execute tools - could parallelize but keeping sequential for now
            for (const tu of toolUses) {
              totalToolCalls++;
              streamData(controller, { type: 'tool_start', tool: tu.name, id: tu.id, input: tu.input });
              
              const execResult: ToolExecutionResult = await executeToolCallWithTracing(
                tu.name!, 
                tu.input || {}, 
                trace
              );
              
              streamData(controller, {
                type: 'tool_result',
                tool: tu.name,
                id: tu.id,
                success: execResult.success,
                result: execResult.result,
                error: execResult.error,
                latencyMs: execResult.latencyMs
              });

              toolResultsForUser.push({
                type: 'tool_result',
                tool_use_id: tu.id,
                content: JSON.stringify(execResult)
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
