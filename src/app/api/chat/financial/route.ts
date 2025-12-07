import { NextResponse, type NextRequest } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

import {
  buildConciseFinancialSystemPrompt,
  buildHydePrompt,
  buildQueryVariationsPrompt
} from '../../../../lib/prompts/index.js';
import { embedText } from '../../../lib/llm/voyageClient';
import { 
  FinancialChatRequestSchema, 
  formatValidationError,
  type RetrievalStrategy
} from '../../../../lib/schemas/api';

// =============================================================================
// TYPES
// =============================================================================

interface SparseVector {
  indices: number[];
  values: number[];
}

interface PineconeMatch {
  id: string;
  score: number;
  metadata: {
    text?: string;
    source_file?: string;
    ticker?: string;
    fiscal_year?: string;
    quarter?: string;
  };
  sparseValues?: SparseVector;
}

interface PipelineStep {
  name: string;
  status: 'active' | 'complete' | 'error';
  latency: number | null;
  details: string;
  metrics?: Record<string, unknown>;
}

interface PipelineMetrics {
  strategy: string;
  autoSelected: boolean;
  steps: PipelineStep[];
  totalLatency: number;
  retrieval: {
    sourcesFound: number;
    topScore: number;
  };
  tokensUsed?: number;
}

interface StreamData {
  type: string;
  [key: string]: unknown;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const PINECONE_INDEX = process.env.PINECONE_INDEX || 'clarity-1024';
const USE_HYBRID_INDEX = PINECONE_INDEX === 'clarity-hybrid';
const SPARSE_DIMENSION = 30000;
const EMBEDDING_DIMENSION = 1024;

// Model configuration - using Anthropic's latest Opus model
const ANTHROPIC_MODEL = 'claude-opus-4-5-20251101';

const SPARSE_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'into',
  'over', 'about', 'their', 'they', 'been', 'were', 'after', 'before', 'are',
  'was', 'has', 'had', 'its', 'our', 'what', 'how', 'can', 'you', 'your',
  'which', 'would', 'could', 'should', 'also', 'just', 'more', 'very', 'some'
]);

const KNOWN_TICKERS: Record<string, string[]> = {
  'AAPL': ['AAPL', 'apple'],
  'AMD': ['AMD', 'advanced micro devices'],
  'AMZN': ['AMZN', 'amazon', 'aws'],
  'AVGO': ['AVGO', 'broadcom'],
  'CRM': ['CRM', 'salesforce'],
  'GOOGL': ['GOOGL', 'GOOG', 'google', 'alphabet'],
  'META': ['META', 'meta', 'facebook', 'fb'],
  'MSFT': ['MSFT', 'microsoft', 'azure'],
  'NVDA': ['NVDA', 'nvidia', 'jensen'],
  'ORCL': ['ORCL', 'oracle', 'larry ellison']
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getEmbedding(text: string): Promise<number[]> {
  const embedding = await embedText(text, { model: 'voyage-3.5', inputType: 'query' });
  if (!embedding || embedding.length === 0) {
    throw new Error('Voyage embedding returned empty vector');
  }
  return embedding;
}

function getSparseVector(text: string): SparseVector | null {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9%$\.]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => token.length > 2 && !SPARSE_STOPWORDS.has(token));
  
  if (tokens.length === 0) return null;

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const indexValueMap = new Map<number, number>();
  for (const [token, count] of counts) {
    const hash = crypto.createHash('md5').update(token).digest();
    const idx = hash.readUInt32BE(0) % SPARSE_DIMENSION;
    const value = 1 + Math.log(count);
    indexValueMap.set(idx, (indexValueMap.get(idx) || 0) + value);
  }

  const sortedEntries = [...indexValueMap.entries()].sort((a, b) => a[0] - b[0]);
  
  return {
    indices: sortedEntries.map(e => e[0]),
    values: sortedEntries.map(e => e[1])
  };
}

function computeBM25Score(text: string, queryTerms: string[], k1 = 1.5, b = 0.75): number {
  const docLength = text.split(/\s+/).length;
  const avgDocLength = 500;
  
  let score = 0;
  const textLower = text.toLowerCase();
  
  queryTerms.forEach(term => {
    const termLower = term.toLowerCase();
    const regex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const termFreq = (textLower.match(regex) || []).length;
    
    if (termFreq > 0) {
      const idf = Math.log(1 + (10 - termFreq + 0.5) / (termFreq + 0.5));
      const tf = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));
      score += idf * tf;
    }
  });
  
  return score;
}

function hybridRerank(matches: PineconeMatch[], query: string, alpha = 0.5): PineconeMatch[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const stopwords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'what', 'how', 'was', 'were']);
  const filteredTerms = queryTerms.filter(t => !stopwords.has(t));
  
  if (filteredTerms.length === 0) return matches;
  
  const scoredMatches = matches.map(match => {
    const text = match.metadata?.text || '';
    const denseScore = match.score || 0;
    const sparseScore = computeBM25Score(text, filteredTerms);
    const normalizedSparse = Math.min(sparseScore / 10, 1);
    const hybridScore = (alpha * denseScore) + ((1 - alpha) * normalizedSparse);
    
    return {
      ...match,
      score: hybridScore
    };
  });
  
  return scoredMatches.sort((a, b) => b.score - a.score);
}

async function generateHypotheticalDoc(query: string, anthropic: Anthropic): Promise<string> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: buildHydePrompt(query)
    }]
  });
  
  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }
  return '';
}

async function generateQueryVariations(query: string, anthropic: Anthropic): Promise<string[]> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: buildQueryVariationsPrompt(query)
    }]
  });
  
  const content = response.content[0];
  if (content.type === 'text') {
    return content.text
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 10);
  }
  return [];
}

function reciprocalRankFusion(resultSets: PineconeMatch[][], k = 60): PineconeMatch[] {
  const scores = new Map<string, number>();
  const docMap = new Map<string, PineconeMatch>();
  
  resultSets.forEach(results => {
    results.forEach((doc, rank) => {
      const id = doc.id || `${doc.metadata?.source_file}-${doc.metadata?.text?.substring(0, 50)}`;
      const rrf = 1 / (k + rank + 1);
      scores.set(id, (scores.get(id) || 0) + rrf);
      if (!docMap.has(id)) {
        docMap.set(id, doc);
      }
    });
  });
  
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({
      ...docMap.get(id)!,
      score
    }));
}

function applyRecencyBoost(matches: PineconeMatch[], requestedYear: string | null = null): PineconeMatch[] {
  const currentYear = new Date().getFullYear();
  
  return matches.map(match => {
    const fiscalYear = parseInt(match.metadata?.fiscal_year || '0') || 0;
    const ticker = match.metadata?.ticker;
    const text = (match.metadata?.text || '').toLowerCase();
    
    let recencyMultiplier = 1.0;
    
    if (!requestedYear) {
      const yearsAgo = currentYear - fiscalYear;
      
      if (yearsAgo <= 0) {
        recencyMultiplier = 1.4;
      } else if (yearsAgo === 1) {
        recencyMultiplier = 1.3;
      } else if (yearsAgo === 2) {
        recencyMultiplier = 1.15;
      } else if (yearsAgo === 3) {
        recencyMultiplier = 1.0;
      } else {
        recencyMultiplier = 0.85;
      }
    }

    let keywordMultiplier = 1.0;
    if (ticker === 'AMZN') {
      if (text.includes('aws')) keywordMultiplier *= 1.25;
      if (text.includes('cloud')) keywordMultiplier *= 1.1;
      if (text.includes('bedrock') || text.includes('trainium') || text.includes('inferentia')) keywordMultiplier *= 1.05;
    }
    
    return {
      ...match,
      score: match.score * recencyMultiplier * keywordMultiplier
    };
  }).sort((a, b) => b.score - a.score);
}

function detectTickers(query: string): string[] {
  const queryLower = query.toLowerCase();
  const detected: string[] = [];
  
  for (const [ticker, aliases] of Object.entries(KNOWN_TICKERS)) {
    for (const alias of aliases) {
      const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(queryLower)) {
        detected.push(ticker);
        break;
      }
    }
  }
  
  return [...new Set(detected)];
}

function determineAnalysisType(query: string): 'financial' | 'general' {
  const q = query.toLowerCase();
  
  const financialKeywords = [
    'revenue', 'earnings', 'profit', 'margin', 'balance sheet', 
    'income statement', 'cash flow', 'sales', 'debt', 'financials', 
    'table', 'numbers', 'quarter', 'results', 'guidance', 'eps',
    'growth', 'spending', 'cost', 'expenses', 'expenditure', 'capex',
    'dividend', 'stock', 'share', 'valuation', 'metric', 'data',
    'fiscal', 'year', 'quarterly', 'annual'
  ];

  const hasFinancial = financialKeywords.some(k => q.includes(k));
  const hasTimeframe = /(q[1-4]|fy|20\d{2})/i.test(q);

  if (hasFinancial || hasTimeframe) {
    return 'financial';
  }
  
  return 'general';
}

function detectTimeframeFromQuery(query: string): string {
  const normalized = query.trim().toLowerCase();

  const quarterMatch = normalized.match(/(q[1-4])\s*(20\d{2})/i);
  if (quarterMatch) {
    return `${quarterMatch[1].toUpperCase()} ${quarterMatch[2]}`;
  }

  const fyMatch = normalized.match(/fy\s*(20\d{2})/i);
  if (fyMatch) {
    return `FY ${fyMatch[1]}`;
  }

  if (/(past year|last year|previous year|trailing 12 months|ttm)/i.test(normalized)) {
    return 'past year';
  }

  if (/(trailing 6 months|last six months|past six months)/i.test(normalized)) {
    return 'trailing 6 months';
  }

  if (/(recent|latest|current|now)/i.test(normalized)) {
    return 'recent';
  }

  return 'all';
}

async function autoSelectStrategy(query: string, anthropic: Anthropic): Promise<RetrievalStrategy> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Classify this financial query to pick the best retrieval strategy:

Query: "${query}"

Options:
- "dense-only": Best for conceptual/strategic questions (e.g., "How is Apple approaching AI?", "What's the outlook?")
- "hybrid-bm25": Best for specific metrics, numbers, or product names (e.g., "Q3 revenue", "MI300 shipments", "EPS")
- "hyde": Best for vague or exploratory questions (e.g., "What's going on with growth?", "Any concerns?")
- "multi-query": Best for complex multi-faceted questions (e.g., "Compare revenue growth and profitability trends", "What are the key drivers and risks?")

Respond with ONLY the strategy ID, nothing else.`
    }]
  });
  
  const content = response.content[0];
  if (content.type === 'text') {
    const selected = content.text.trim().toLowerCase();
    
    if (['dense-only', 'hybrid-bm25', 'hyde', 'multi-query'].includes(selected)) {
      return selected as RetrievalStrategy;
    }
  }
  
  return 'dense-only';
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const validation = FinancialChatRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        formatValidationError(validation.error),
        { status: 400 }
      );
    }

    const { query, strategy: requestedStrategy } = validation.data;

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const index = pinecone.index(PINECONE_INDEX);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    
    console.log(`Using Pinecone index: ${PINECONE_INDEX} (hybrid: ${USE_HYBRID_INDEX}, dims: ${EMBEDDING_DIMENSION})`);

    let strategy: RetrievalStrategy = requestedStrategy;
    let autoSelectedFrom: string | null = null;
    
    if (requestedStrategy === 'auto') {
      strategy = await autoSelectStrategy(query, anthropic);
      autoSelectedFrom = 'auto';
      console.log(`Auto-selected strategy: ${strategy} for query: "${query.substring(0, 50)}..."`);
    }

    console.log(`Financial Chat Query [${strategy}${autoSelectedFrom ? ' (auto)' : ''}]:`, query);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: StreamData) => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const metrics: PipelineMetrics = {
          strategy,
          autoSelected: autoSelectedFrom === 'auto',
          steps: [],
          totalLatency: 0,
          retrieval: {
            sourcesFound: 0,
            topScore: 0,
          }
        };
        const startTime = Date.now();

        if (autoSelectedFrom === 'auto') {
          metrics.steps.push({
            name: 'Strategy Selection',
            status: 'complete',
            latency: null,
            details: `LLM selected "${strategy}" for this query type`
          });
        }

        try {
          // STEP 1: Intent Analysis
          const intentStart = Date.now();
          const detectedTimeframe = detectTimeframeFromQuery(query);
          const analysisType = determineAnalysisType(query);
          const detectedTickers = detectTickers(query);
          
          metrics.steps.push({
            name: 'Intent Analysis',
            status: 'complete',
            latency: Date.now() - intentStart,
            details: `Type: ${analysisType}, Timeframe: ${detectedTimeframe}${detectedTickers.length > 0 ? `, Companies: ${detectedTickers.join(', ')}` : ''}`
          });
          
          // Build Pinecone filter
          type PineconeFilter = Record<string, unknown>;
          let queryFilter: PineconeFilter | null = null;
          
          const yearMatch = query.match(/20\d{2}/);
          const detectedYear = yearMatch ? yearMatch[0] : null;
          
          const filterConditions: PineconeFilter[] = [];
          
          if (detectedTickers.length === 1) {
            filterConditions.push({ ticker: detectedTickers[0] });
          } else if (detectedTickers.length > 1) {
            filterConditions.push({ ticker: { $in: detectedTickers } });
          }
          
          if (detectedYear) {
            filterConditions.push({ fiscal_year: detectedYear });
          }
          
          if (filterConditions.length === 1) {
            queryFilter = filterConditions[0];
          } else if (filterConditions.length > 1) {
            queryFilter = { $and: filterConditions };
          }

          // STEP 2: Embedding
          const embeddingStart = Date.now();
          let searchVector: number[] | undefined;
          let hydeDoc: string | null = null;
          let multiQueryVariations: string[] | null = null;
          
          if (strategy === 'hyde') {
            send({ type: 'status', message: 'Generating hypothetical document...' });
            hydeDoc = await generateHypotheticalDoc(query, anthropic);
            searchVector = await getEmbedding(hydeDoc);
            metrics.steps.push({
              name: 'HyDE Generation',
              status: 'complete',
              latency: Date.now() - embeddingStart,
              details: `Generated ${hydeDoc.length} char hypothetical doc`
            });
          } else if (strategy === 'multi-query') {
            send({ type: 'status', message: 'Generating query variations...' });
            multiQueryVariations = await generateQueryVariations(query, anthropic);
            multiQueryVariations = [query, ...multiQueryVariations.slice(0, 2)];
            metrics.steps.push({
              name: 'Query Expansion',
              status: 'complete',
              latency: Date.now() - embeddingStart,
              details: `Generated ${multiQueryVariations.length} query variations`
            });
          } else {
            searchVector = await getEmbedding(query);
            metrics.steps.push({
              name: 'Embedding',
              status: 'complete',
              latency: Date.now() - embeddingStart,
              details: `voyage-3.5 (query) → ${searchVector.length}d vector`
            });
          }

          // STEP 3: Retrieval
          const retrievalStart = Date.now();
          let matches: PineconeMatch[] = [];

          if (strategy === 'multi-query' && multiQueryVariations) {
            send({ type: 'status', message: 'Searching with multiple queries...' });
            
            const searchPromises = multiQueryVariations.map(async (variation) => {
              const vector = await getEmbedding(variation);
              const queryParams: Record<string, unknown> = {
                vector,
                topK: 8,
                includeMetadata: true
              };
              if (queryFilter) {
                queryParams.filter = queryFilter;
              }
              const response = await index.query(queryParams as Parameters<typeof index.query>[0]);
              return (response.matches || []) as PineconeMatch[];
            });
            
            const resultSets = await Promise.all(searchPromises);
            matches = reciprocalRankFusion(resultSets);
            matches = applyRecencyBoost(matches, detectedYear);
            matches = matches.slice(0, 15);
            
            const filterDesc = [
              detectedTickers.length > 0 ? detectedTickers.join(', ') : null,
              detectedYear ? `FY${detectedYear}` : null
            ].filter(Boolean).join(', ');
            
            metrics.steps.push({
              name: 'Retrieval (RRF)',
              status: 'complete',
              latency: Date.now() - retrievalStart,
              details: `${multiQueryVariations.length} searches → ${matches.length} merged results${filterDesc ? ` (filtered: ${filterDesc})` : ''}`,
              metrics: {
                strategy: strategy,
                queries: multiQueryVariations.length,
                matches: matches.length,
                topScore: matches[0]?.score?.toFixed(4) || 'N/A'
              }
            });
          } else {
            const queryParams: Record<string, unknown> = {
              vector: searchVector,
              topK: 25,
              includeMetadata: true
            };
            
            let usedTrueHybrid = false;
            if (USE_HYBRID_INDEX && strategy === 'hybrid-bm25') {
              const sparseVector = getSparseVector(query);
              if (sparseVector) {
                queryParams.sparseVector = sparseVector;
                usedTrueHybrid = true;
              }
            }
            
            if (queryFilter) {
              queryParams.filter = queryFilter;
            }
            const queryResponse = await index.query(queryParams as Parameters<typeof index.query>[0]);

            matches = (queryResponse.matches || []) as PineconeMatch[];
            
            if (strategy === 'hybrid-bm25' && matches.length > 0 && !usedTrueHybrid) {
              matches = hybridRerank(matches, query, 0.5);
            }
            
            matches = applyRecencyBoost(matches, detectedYear);
            matches = matches.slice(0, 15);

            const filterDesc = [
              detectedTickers.length > 0 ? detectedTickers.join(', ') : null,
              detectedYear ? `FY${detectedYear}` : null
            ].filter(Boolean).join(', ');
            
            metrics.steps.push({
              name: 'Retrieval',
              status: 'complete',
              latency: Date.now() - retrievalStart,
              details: `${matches.length} matches${usedTrueHybrid ? ' (hybrid)' : ''}${!detectedYear ? ' + recency boost' : ''}${filterDesc ? ` (${filterDesc})` : ''}`,
              metrics: {
                strategy: strategy,
                matches: matches.length,
                topScore: matches[0]?.score?.toFixed(3) || 'N/A',
                filteredByTicker: detectedTickers.length > 0 ? detectedTickers : null,
                filteredByYear: detectedYear,
                trueHybrid: usedTrueHybrid,
                recencyBoostApplied: !detectedYear
              }
            });
          }
          
          metrics.retrieval.sourcesFound = matches.length;
          metrics.retrieval.topScore = matches[0]?.score || 0;
          
          const context = matches
            .map(m => `[Source: ${m.metadata.source_file}]\n${m.metadata.text}`)
            .join('\n\n');

          const citations = matches.map((m, i) => ({
            index: i + 1,
            source: m.metadata.source_file,
            text: m.metadata.text?.substring(0, 100) + '...',
            fiscalYear: m.metadata.fiscal_year,
            quarter: m.metadata.quarter,
            score: m.score?.toFixed(3)
          }));

          send({
            type: 'metadata',
            citations,
            analysis_type: analysisType,
            timeframe: detectedTimeframe,
            topics_covered: ['earnings', 'financials'],
            strategy: strategy,
            autoSelected: autoSelectedFrom === 'auto',
            hydeDoc: hydeDoc,
            multiQueryVariations: multiQueryVariations,
            detectedTickers: detectedTickers,
            detectedYear: detectedYear
          });

          // STEP 4: Generation
          const generationStart = Date.now();
          metrics.steps.push({
            name: 'Generation',
            status: 'active',
            latency: null,
            details: `Claude ${ANTHROPIC_MODEL} streaming...`
          });

          const systemPrompt = buildConciseFinancialSystemPrompt();
          const userPrompt = `Context:\n${context}\n\nQuestion: ${query}`;

          const messageStream = await anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 600,
            messages: [{ role: 'user', content: userPrompt }],
            stream: true,
            system: systemPrompt
          });

          let tokenCount = 0;

          for await (const chunk of messageStream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text;
              tokenCount++;
              send({ type: 'content', content: text });
            }
          }

          const generationLatency = Date.now() - generationStart;
          metrics.steps[metrics.steps.length - 1] = {
            name: 'Generation',
            status: 'complete',
            latency: generationLatency,
            details: `${tokenCount} tokens generated`
          };

          metrics.totalLatency = Date.now() - startTime;
          metrics.tokensUsed = tokenCount;

          const followUps = [
            "What were the specific revenue drivers?",
            "How does this compare to the previous quarter?",
            "What are the risks mentioned?"
          ];

          send({ type: 'followup_questions', questions: followUps });
          send({ type: 'metrics', metrics });
          send({ type: 'end' });

        } catch (error) {
          console.error('Streaming error:', error);
          send({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

