#!/usr/bin/env node
/**
 * Dense vs Hybrid Retrieval Comparison
 * 
 * Usage:
 *   node scripts/compare-dense-vs-hybrid.js
 *   node scripts/compare-dense-vs-hybrid.js --quick (5 queries)
 * 
 * Runs the same queries against both indexes and compares:
 * - Retrieval accuracy
 * - Keyword precision
 * - Response quality
 * - Latency
 */

import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
try {
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = await fs.readFile(envPath, 'utf8');
  const envConfig = dotenv.parse(envContent);
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} catch (e) {
  dotenv.config();
  dotenv.config({ path: '.env.local' });
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const DENSE_INDEX = 'clarity-openai';
const HYBRID_INDEX = 'clarity-hybrid';
const SPARSE_DIMENSION = 30000;

// Test queries designed to highlight differences between dense and hybrid search
const TEST_QUERIES = [
  {
    id: 'exact-revenue',
    query: "What was AMD's Q3 2024 revenue?",
    ticker: 'AMD',
    type: 'exact-number',
    keywords: ['Q3', '2024', 'revenue', 'AMD'],
    expectation: 'Hybrid should find exact quarter/year better'
  },
  {
    id: 'product-name',
    query: "What did NVIDIA say about MI300 competition?",
    ticker: 'NVDA',
    type: 'product-specific',
    keywords: ['MI300', 'competition', 'NVIDIA'],
    expectation: 'Hybrid should catch MI300 keyword'
  },
  {
    id: 'comparison',
    query: "Compare AMD and NVIDIA data center strategies",
    ticker: null,
    type: 'multi-company',
    keywords: ['AMD', 'NVIDIA', 'data center', 'strategy'],
    expectation: 'Both should work, hybrid may find keyword matches'
  },
  {
    id: 'strategic',
    query: "What is Meta's approach to AI infrastructure investment?",
    ticker: 'META',
    type: 'strategic',
    keywords: ['AI', 'infrastructure', 'investment'],
    expectation: 'Dense should excel at semantic meaning'
  },
  {
    id: 'guidance',
    query: "What guidance did Oracle give for FY2026 cloud revenue?",
    ticker: 'ORCL',
    type: 'guidance',
    keywords: ['guidance', 'FY2026', 'cloud', 'revenue'],
    expectation: 'Hybrid should find FY2026 and guidance terms'
  },
  {
    id: 'executive-quote',
    query: "What did Tim Cook say about Apple Intelligence?",
    ticker: 'AAPL',
    type: 'quote',
    keywords: ['Tim Cook', 'Apple Intelligence'],
    expectation: 'Hybrid should match exact names'
  },
  {
    id: 'metric-specific',
    query: "What was Google Cloud's growth rate in Q4 2024?",
    ticker: 'GOOGL',
    type: 'metric',
    keywords: ['Google Cloud', 'growth', 'Q4', '2024'],
    expectation: 'Hybrid should find exact quarter'
  },
  {
    id: 'trend',
    query: "How has Microsoft Azure revenue trended over the past year?",
    ticker: 'MSFT',
    type: 'trend',
    keywords: ['Azure', 'revenue', 'trend'],
    expectation: 'Dense should understand temporal concept'
  },
  {
    id: 'competitive',
    query: "What advantages does Broadcom have in AI networking?",
    ticker: 'AVGO',
    type: 'competitive',
    keywords: ['AI', 'networking', 'advantages'],
    expectation: 'Dense should capture competitive positioning'
  },
  {
    id: 'product-launch',
    query: "What new products did Salesforce announce with AI?",
    ticker: 'CRM',
    type: 'product',
    keywords: ['new products', 'AI', 'announce'],
    expectation: 'Both should work reasonably well'
  }
];

// Stopwords for sparse encoding
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'into',
  'over', 'about', 'their', 'they', 'been', 'were', 'after', 'before', 'are',
  'was', 'has', 'had', 'its', 'our', 'what', 'how', 'can', 'you', 'your',
  'which', 'would', 'could', 'should', 'also', 'just', 'more', 'very', 'some'
]);

// -------------------
// Embedding Functions
// -------------------
async function getDenseEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small'
    })
  });
  const data = await response.json();
  return data.data[0].embedding;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%$\.]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

function tokenToIndex(token) {
  const hash = crypto.createHash('md5').update(token).digest();
  return hash.readUInt32BE(0) % SPARSE_DIMENSION;
}

function getSparseVector(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const indexValueMap = new Map();
  for (const [token, count] of counts) {
    const idx = tokenToIndex(token);
    const value = 1 + Math.log(count);
    indexValueMap.set(idx, (indexValueMap.get(idx) || 0) + value);
  }

  const sortedEntries = [...indexValueMap.entries()].sort((a, b) => a[0] - b[0]);
  
  return {
    indices: sortedEntries.map(e => e[0]),
    values: sortedEntries.map(e => e[1])
  };
}

// -------------------
// Retrieval Functions
// -------------------
async function queryDenseOnly(pinecone, query, ticker = null) {
  const index = pinecone.index(DENSE_INDEX);
  const embedding = await getDenseEmbedding(query);
  
  const queryParams = {
    vector: embedding,
    topK: 10,
    includeMetadata: true
  };
  
  if (ticker) {
    queryParams.filter = { ticker: { $eq: ticker } };
  }
  
  const start = Date.now();
  const result = await index.query(queryParams);
  const latency = Date.now() - start;
  
  return {
    matches: result.matches || [],
    latency
  };
}

async function queryHybrid(pinecone, query, ticker = null, alpha = 0.5) {
  const index = pinecone.index(HYBRID_INDEX);
  const embedding = await getDenseEmbedding(query);
  const sparseVector = getSparseVector(query);
  
  const queryParams = {
    vector: embedding,
    topK: 10,
    includeMetadata: true
  };
  
  // Add sparse vector for hybrid search
  if (sparseVector) {
    queryParams.sparseVector = sparseVector;
  }
  
  if (ticker) {
    queryParams.filter = { ticker: { $eq: ticker } };
  }
  
  const start = Date.now();
  const result = await index.query(queryParams);
  const latency = Date.now() - start;
  
  return {
    matches: result.matches || [],
    latency
  };
}

// -------------------
// Evaluation Functions
// -------------------
function computeKeywordHits(matches, keywords) {
  if (!matches.length) return { hits: 0, total: keywords.length, ratio: 0 };
  
  const combinedText = matches.map(m => m.metadata?.text || '').join(' ').toLowerCase();
  let hits = 0;
  
  for (const keyword of keywords) {
    if (combinedText.includes(keyword.toLowerCase())) {
      hits++;
    }
  }
  
  return {
    hits,
    total: keywords.length,
    ratio: hits / keywords.length
  };
}

function computeAverageScore(matches) {
  if (!matches.length) return 0;
  return matches.reduce((sum, m) => sum + (m.score || 0), 0) / matches.length;
}

async function evaluateWithLLM(query, denseContext, hybridContext) {
  if (!ANTHROPIC_API_KEY) {
    return { denseRating: 'N/A', hybridRating: 'N/A', winner: 'N/A', explanation: 'No Anthropic API key' };
  }
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are evaluating retrieval quality for a financial RAG system.

QUERY: "${query}"

RETRIEVAL A (Dense-only):
${denseContext.slice(0, 2000)}

RETRIEVAL B (Hybrid dense+sparse):
${hybridContext.slice(0, 2000)}

Rate each retrieval 1-5 on relevance to the query:
1 = Completely irrelevant
3 = Partially relevant
5 = Highly relevant

Respond in JSON format:
{
  "denseRating": <1-5>,
  "hybridRating": <1-5>,
  "winner": "dense" | "hybrid" | "tie",
  "explanation": "<brief reason>"
}`
      }]
    })
  });
  
  try {
    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('LLM evaluation error:', e.message);
  }
  
  return { denseRating: 'N/A', hybridRating: 'N/A', winner: 'N/A', explanation: 'Parse error' };
}

// -------------------
// Main Comparison
// -------------------
async function runComparison(quickMode = false) {
  console.log('\n🔬 Dense vs Hybrid Retrieval Comparison\n');
  console.log('═'.repeat(60));
  
  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  
  // Check indexes
  console.log('Checking indexes...');
  
  try {
    const denseIndex = pinecone.index(DENSE_INDEX);
    const denseStats = await denseIndex.describeIndexStats();
    console.log(`  ${DENSE_INDEX}: ${denseStats.totalRecordCount} vectors`);
  } catch (e) {
    console.error(`  ❌ ${DENSE_INDEX}: Not accessible`);
    return;
  }
  
  try {
    const hybridIndex = pinecone.index(HYBRID_INDEX);
    const hybridStats = await hybridIndex.describeIndexStats();
    console.log(`  ${HYBRID_INDEX}: ${hybridStats.totalRecordCount} vectors`);
    
    if (hybridStats.totalRecordCount === 0) {
      console.log('\n⚠️  Hybrid index is empty! Run embed-hybrid.js first.\n');
      return;
    }
  } catch (e) {
    console.error(`  ❌ ${HYBRID_INDEX}: Not accessible`);
    return;
  }
  
  const queries = quickMode ? TEST_QUERIES.slice(0, 5) : TEST_QUERIES;
  console.log(`\nRunning ${queries.length} test queries...\n`);
  
  const results = [];
  
  for (const testCase of queries) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 ${testCase.id}: "${testCase.query}"`);
    console.log(`   Type: ${testCase.type} | Ticker: ${testCase.ticker || 'any'}`);
    
    // Query both indexes
    const [denseResult, hybridResult] = await Promise.all([
      queryDenseOnly(pinecone, testCase.query, testCase.ticker),
      queryHybrid(pinecone, testCase.query, testCase.ticker)
    ]);
    
    // Compute metrics
    const denseKeywords = computeKeywordHits(denseResult.matches, testCase.keywords);
    const hybridKeywords = computeKeywordHits(hybridResult.matches, testCase.keywords);
    
    const denseAvgScore = computeAverageScore(denseResult.matches);
    const hybridAvgScore = computeAverageScore(hybridResult.matches);
    
    // Format contexts for LLM
    const denseContext = denseResult.matches
      .map(m => `[Score: ${m.score?.toFixed(3)}] ${m.metadata?.text?.substring(0, 300)}`)
      .join('\n\n');
    
    const hybridContext = hybridResult.matches
      .map(m => `[Score: ${m.score?.toFixed(3)}] ${m.metadata?.text?.substring(0, 300)}`)
      .join('\n\n');
    
    // LLM evaluation
    console.log('   Evaluating with LLM...');
    const llmEval = await evaluateWithLLM(testCase.query, denseContext, hybridContext);
    
    // Determine winner
    let winner = 'tie';
    if (hybridKeywords.ratio > denseKeywords.ratio + 0.1) winner = 'hybrid';
    else if (denseKeywords.ratio > hybridKeywords.ratio + 0.1) winner = 'dense';
    else if (llmEval.winner && llmEval.winner !== 'tie' && llmEval.winner !== 'N/A') winner = llmEval.winner;
    
    results.push({
      ...testCase,
      dense: {
        matches: denseResult.matches.length,
        latency: denseResult.latency,
        avgScore: denseAvgScore,
        keywordHits: denseKeywords
      },
      hybrid: {
        matches: hybridResult.matches.length,
        latency: hybridResult.latency,
        avgScore: hybridAvgScore,
        keywordHits: hybridKeywords
      },
      llmEval,
      winner
    });
    
    // Print results
    console.log(`\n   ${'Dense'.padEnd(15)} | ${'Hybrid'.padEnd(15)}`);
    console.log(`   ${'─'.repeat(15)} | ${'─'.repeat(15)}`);
    console.log(`   Matches: ${String(denseResult.matches.length).padEnd(8)} | Matches: ${hybridResult.matches.length}`);
    console.log(`   Latency: ${String(denseResult.latency + 'ms').padEnd(8)} | Latency: ${hybridResult.latency}ms`);
    console.log(`   Keywords: ${denseKeywords.hits}/${denseKeywords.total}     | Keywords: ${hybridKeywords.hits}/${hybridKeywords.total}`);
    console.log(`   LLM: ${String(llmEval.denseRating).padEnd(11)} | LLM: ${llmEval.hybridRating}`);
    console.log(`\n   🏆 Winner: ${(winner || 'tie').toUpperCase()}`);
    if (llmEval.explanation && llmEval.explanation !== 'N/A') {
      console.log(`   📝 ${llmEval.explanation}`);
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  
  const denseWins = results.filter(r => r.winner === 'dense').length;
  const hybridWins = results.filter(r => r.winner === 'hybrid').length;
  const ties = results.filter(r => r.winner === 'tie').length;
  
  const avgDenseLatency = results.reduce((s, r) => s + r.dense.latency, 0) / results.length;
  const avgHybridLatency = results.reduce((s, r) => s + r.hybrid.latency, 0) / results.length;
  const avgDenseKeywords = results.reduce((s, r) => s + r.dense.keywordHits.ratio, 0) / results.length;
  const avgHybridKeywords = results.reduce((s, r) => s + r.hybrid.keywordHits.ratio, 0) / results.length;
  
  console.log(`\n   Dense Wins:  ${denseWins}`);
  console.log(`   Hybrid Wins: ${hybridWins}`);
  console.log(`   Ties:        ${ties}`);
  console.log(`\n   Avg Latency:  Dense ${avgDenseLatency.toFixed(0)}ms | Hybrid ${avgHybridLatency.toFixed(0)}ms`);
  console.log(`   Keyword Hit%: Dense ${(avgDenseKeywords * 100).toFixed(0)}% | Hybrid ${(avgHybridKeywords * 100).toFixed(0)}%`);
  
  const overallWinner = hybridWins > denseWins ? 'HYBRID' : 
                        denseWins > hybridWins ? 'DENSE' : 'TIE';
  
  console.log(`\n   🏆 OVERALL WINNER: ${overallWinner}`);
  console.log('═'.repeat(60));
  
  // Save results
  const reportPath = path.join(process.cwd(), 'dense-vs-hybrid-comparison.json');
  await fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      denseWins,
      hybridWins,
      ties,
      avgDenseLatency,
      avgHybridLatency,
      avgDenseKeywords,
      avgHybridKeywords,
      overallWinner
    },
    results
  }, null, 2));
  
  console.log(`\n📄 Full report saved to: ${reportPath}\n`);
  
  return { denseWins, hybridWins, ties, overallWinner };
}

// CLI
const args = process.argv.slice(2);
const quickMode = args.includes('--quick');

runComparison(quickMode).catch(console.error);

