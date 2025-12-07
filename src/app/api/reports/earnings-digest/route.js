import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

// Model configuration - using Anthropic's latest Opus model
const ANTHROPIC_MODEL = "claude-opus-4-5-20251101";

// Helper to load earnings transcript
function loadEarningsTranscript(ticker, fiscalYear, quarter) {
  const basePath = path.join(process.cwd(), 'data', 'transcripts', ticker, `FY_${fiscalYear}`, quarter, 'parsed_earnings');
  
  const earningsFile = path.join(basePath, `${ticker}_FY${fiscalYear}_${quarter}_earnings.json`);
  const qaFile = path.join(basePath, `${ticker}_FY${fiscalYear}_${quarter}_qa.json`);
  
  // Try alternate naming convention
  const earningsFileAlt = path.join(basePath, `${ticker}_FY_${fiscalYear}_${quarter}_earnings.json`);
  const qaFileAlt = path.join(basePath, `${ticker}_FY_${fiscalYear}_${quarter}_qa.json`);
  
  let earnings = null;
  let qa = null;
  
  // Try to load earnings
  for (const file of [earningsFile, earningsFileAlt]) {
    if (fs.existsSync(file)) {
      try {
        earnings = JSON.parse(fs.readFileSync(file, 'utf8'));
        break;
      } catch (e) {
        console.error(`Error parsing ${file}:`, e.message);
      }
    }
  }
  
  // Try to load Q&A
  for (const file of [qaFile, qaFileAlt]) {
    if (fs.existsSync(file)) {
      try {
        qa = JSON.parse(fs.readFileSync(file, 'utf8'));
        break;
      } catch (e) {
        console.error(`Error parsing ${file}:`, e.message);
      }
    }
  }
  
  return { earnings, qa };
}

// Helper to load financial data
function loadFinancialData(ticker, fiscalYear, quarter) {
  const filePath = path.join(
    process.cwd(), 'data', 'financials', ticker, 
    `FY_${fiscalYear}`, quarter, 
    `${ticker}_FY_${fiscalYear}_${quarter}.json`
  );
  
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`Error parsing ${filePath}:`, e.message);
    }
  }
  return null;
}

// Format financial context for LLM
function formatContext(earnings, qa, financials) {
  let context = '';
  
  if (earnings) {
    context += `## EARNINGS CALL PREPARED REMARKS\n\n`;
    context += JSON.stringify(earnings, null, 2);
    context += '\n\n';
  }
  
  if (qa) {
    context += `## ANALYST Q&A SESSION\n\n`;
    // Extract key Q&A pairs
    if (qa.speakers) {
      for (const [speaker, data] of Object.entries(qa.speakers)) {
        if (data.responses && data.responses.length > 0) {
          context += `### ${speaker} (${data.role})\n`;
          data.responses.forEach(r => {
            context += `**Topic: ${r.topic}**\n${r.content}\n\n`;
          });
        }
      }
    }
    if (qa.analyst_questions) {
      context += `### ANALYST QUESTIONS\n`;
      qa.analyst_questions.slice(0, 10).forEach(q => {
        context += `- **${q.analyst}** (${q.firm}): ${q.topics?.join(', ')}\n`;
        if (q.questions && q.questions[0]) {
          context += `  "${q.questions[0].substring(0, 200)}..."\n`;
        }
      });
    }
    context += '\n\n';
  }
  
  if (financials) {
    context += `## FINANCIAL DATA\n\n`;
    context += JSON.stringify(financials, null, 2);
  }
  
  return context;
}

// Extract key metrics for the summary table
function extractKeyMetrics(earnings, financials) {
  const metrics = {
    revenue: null,
    revenueGrowth: null,
    eps: null,
    epsGrowth: null,
    grossMargin: null,
    operatingMargin: null,
    guidance: null,
    segments: []
  };
  
  // Try to extract from earnings first
  if (earnings?.financials) {
    const fin = earnings.financials;
    
    if (fin.total_revenue) {
      metrics.revenue = fin.total_revenue.value;
      metrics.revenueGrowth = fin.total_revenue.year_over_year_change;
    }
    
    if (fin.profitability?.eps) {
      metrics.eps = fin.profitability.eps.value;
      metrics.epsGrowth = fin.profitability.eps.year_over_year_change;
    }
    
    if (fin.guidance?.fourth_quarter_2024?.revenue) {
      metrics.guidance = fin.guidance.fourth_quarter_2024.revenue;
    }
    
    // Extract segment data
    if (fin.total_revenue?.composition) {
      for (const [segment, data] of Object.entries(fin.total_revenue.composition)) {
        if (data.value) {
          metrics.segments.push({
            name: segment.replace(/_/g, ' ').toUpperCase(),
            revenue: data.value,
            growth: data.year_over_year_change
          });
        }
      }
    }
  }
  
  // Supplement from financials if available
  if (financials?.financial_reports?.[0]) {
    const report = financials.financial_reports[0];
    
    if (report.income_statement?.margins) {
      metrics.grossMargin = report.income_statement.margins.gross_margin?.current_value;
      metrics.operatingMargin = report.income_statement.margins.operating_margin?.current_value;
    }
    
    // Override with more accurate financials data if available
    if (report.income_statement?.net_sales?.total) {
      metrics.revenue = report.income_statement.net_sales.total.value;
      metrics.revenueGrowth = `${report.income_statement.net_sales.total.yoy_growth > 0 ? '+' : ''}${report.income_statement.net_sales.total.yoy_growth}%`;
    }
    
    if (report.income_statement?.earnings_per_share?.diluted) {
      metrics.eps = report.income_statement.earnings_per_share.diluted.value;
      metrics.epsGrowth = `${report.income_statement.earnings_per_share.diluted.yoy_growth > 0 ? '+' : ''}${report.income_statement.earnings_per_share.diluted.yoy_growth}%`;
    }
  }
  
  return metrics;
}

export async function POST(req) {
  try {
    const { ticker, fiscalYear, quarter } = await req.json();
    
    if (!ticker || !fiscalYear || !quarter) {
      return NextResponse.json(
        { error: 'ticker, fiscalYear, and quarter are required' },
        { status: 400 }
      );
    }
    
    // Normalize inputs
    const normalizedTicker = ticker.toUpperCase();
    const normalizedQuarter = quarter.toUpperCase();
    
    console.log(`Generating Earnings Digest for ${normalizedTicker} ${normalizedQuarter} FY${fiscalYear}`);
    
    // Load data
    const { earnings, qa } = loadEarningsTranscript(normalizedTicker, fiscalYear, normalizedQuarter);
    const financials = loadFinancialData(normalizedTicker, fiscalYear, normalizedQuarter);
    
    if (!earnings && !qa && !financials) {
      return NextResponse.json(
        { error: `No data found for ${normalizedTicker} ${normalizedQuarter} FY${fiscalYear}` },
        { status: 404 }
      );
    }
    
    // Extract key metrics for structured response
    const keyMetrics = extractKeyMetrics(earnings, financials);
    
    // Format context for LLM
    const context = formatContext(earnings, qa, financials);
    
    // Initialize Anthropic
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    
    // Check if streaming is requested
    const url = new URL(req.url);
    const stream = url.searchParams.get('stream') === 'true';
    
    // Build metadata for immediate response
    const metadata = {
      ticker: normalizedTicker,
      fiscalYear,
      quarter: normalizedQuarter,
      generatedAt: new Date().toISOString(),
      keyMetrics,
      hasEarningsTranscript: !!earnings,
      hasQATranscript: !!qa,
      hasFinancialData: !!financials,
      contextLength: context.length
    };
    
    // Generate digest using Claude with streaming
    const systemPrompt = `You are a senior equity research analyst generating an earnings digest.

Your output must be a valid JSON object with this exact structure:
{
  "headline": "Single most important takeaway (1 sentence)",
  "managementTone": {
    "rating": "bullish" | "neutral" | "cautious",
    "supportingQuote": "Direct quote from management that best illustrates their tone"
  },
  "keyHighlights": [
    "Highlight 1 - most important point",
    "Highlight 2",
    "Highlight 3",
    "Highlight 4 (if relevant)",
    "Highlight 5 (if relevant)"
  ],
  "segmentPerformance": [
    {
      "segment": "Segment Name",
      "performance": "Brief performance summary",
      "outlook": "Forward outlook if mentioned"
    }
  ],
  "guidanceChanges": {
    "summary": "What guidance was given or changed",
    "details": ["Detail 1", "Detail 2"]
  },
  "analystConcerns": [
    {
      "topic": "What analysts pushed on",
      "managementResponse": "How management addressed it"
    }
  ],
  "risksAndChallenges": [
    "Risk 1 mentioned by management",
    "Risk 2"
  ],
  "strategicInitiatives": [
    "Key initiative or announcement 1",
    "Key initiative 2"
  ]
}

CRITICAL RULES:
- Every claim must be directly from the provided context
- Include specific numbers when available
- Keep each highlight under 50 words
- Include the most impactful direct quote for management tone
- Focus on what matters for investment decisions
- Return ONLY the JSON object, no markdown or other text`;

    const userPrompt = `Generate an earnings digest for ${normalizedTicker} ${normalizedQuarter} FY${fiscalYear}.

CONTEXT:
${context.substring(0, 50000)}

Return a JSON object following the exact schema specified.`;

    if (stream) {
      // Streaming response
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          // Send metadata immediately
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`));
          
          try {
            const messageStream = await anthropic.messages.create({
              model: ANTHROPIC_MODEL,
              max_tokens: 2000,
              messages: [{ role: 'user', content: userPrompt }],
              system: systemPrompt,
              stream: true
            });
            
            let fullText = '';
            
            for await (const chunk of messageStream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text;
                fullText += text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', data: text })}\n\n`));
              }
            }
            
            // Parse and send final digest
            try {
              let jsonText = fullText;
              if (jsonText.includes('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
              } else if (jsonText.includes('```')) {
                jsonText = jsonText.replace(/```\n?/g, '');
              }
              const digest = JSON.parse(jsonText.trim());
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', data: digest })}\n\n`));
            } catch (e) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: 'Failed to parse digest' })}\n\n`));
            }
          } catch (e) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: e.message })}\n\n`));
          } finally {
            controller.close();
          }
        }
      });
      
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    // Non-streaming response (original behavior)
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt
    });
    
    let digest;
    try {
      // Extract JSON from response
      let jsonText = response.content[0].text;
      
      // Remove markdown code blocks if present
      if (jsonText.includes('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }
      
      digest = JSON.parse(jsonText.trim());
    } catch (e) {
      console.error('Error parsing digest JSON:', e.message);
      console.error('Raw response:', response.content[0].text);
      return NextResponse.json(
        { error: 'Failed to parse earnings digest', details: e.message },
        { status: 500 }
      );
    }
    
    // Build final response
    const result = {
      ...metadata,
      digest,
      metadata: {
        hasEarningsTranscript: !!earnings,
        hasQATranscript: !!qa,
        hasFinancialData: !!financials,
        contextLength: context.length
      }
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Earnings Digest error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to list available earnings
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  
  if (!ticker) {
    // Return list of all tickers with available data
    const transcriptsDir = path.join(process.cwd(), 'data', 'transcripts');
    const tickers = fs.readdirSync(transcriptsDir)
      .filter(name => fs.statSync(path.join(transcriptsDir, name)).isDirectory());
    
    return NextResponse.json({ tickers });
  }
  
  // Return available periods for a specific ticker
  const tickerDir = path.join(process.cwd(), 'data', 'transcripts', ticker.toUpperCase());
  
  if (!fs.existsSync(tickerDir)) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
  }
  
  const periods = [];
  const fiscalYears = fs.readdirSync(tickerDir)
    .filter(name => name.startsWith('FY_'))
    .sort((a, b) => b.localeCompare(a)); // Most recent first
  
  for (const fy of fiscalYears) {
    const fyPath = path.join(tickerDir, fy);
    const quarters = fs.readdirSync(fyPath)
      .filter(name => name.startsWith('Q'))
      .sort((a, b) => b.localeCompare(a));
    
    for (const q of quarters) {
      const parsedDir = path.join(fyPath, q, 'parsed_earnings');
      if (fs.existsSync(parsedDir)) {
        periods.push({
          fiscalYear: fy.replace('FY_', ''),
          quarter: q,
          hasData: true
        });
      }
    }
  }
  
  return NextResponse.json({ 
    ticker: ticker.toUpperCase(), 
    periods 
  });
}

