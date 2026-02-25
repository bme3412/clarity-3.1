import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

// Load env vars immediately
dotenv.config();

const REPORTS_BASE = path.join(process.cwd(), '_cleanup', 'evals', 'evaluation_reports');
const STRATEGY_ID = process.env.RAG_STRATEGY_ID || process.argv[2] || 'baseline';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeRunId(timestamp) {
  return timestamp.replace(/[:.]/g, '-');
}

function serializeContext(matches = []) {
  return matches.map((match, index) => ({
    id: match.id || `context-${index}`,
    score: match.score ?? null,
    metadata: {
      company: match.metadata?.company || match.metadata?.company_name || null,
      quarter: match.metadata?.quarter || match.metadata?.quarter_name || null,
      fiscalYear: match.metadata?.fiscalYear || match.metadata?.fiscal_year || null,
      type: match.metadata?.type || null,
      source: match.metadata?.source || match.metadata?.source_file || null,
      retrieval: match.metadata?.retrieval || match.retrieval || null,
      text: match.metadata?.text || match.metadata?.content || null,
    },
  }));
}

// Dynamic imports to ensure env vars are loaded first
const {
  VoyageEmbedder,
  PineconeRetriever,
  QueryIntentAnalyzer,
  EnhancedFinancialAnalyst,
  KeywordTranscriptRetriever
} = await import('../../src/lib/rag/components.js');

const { ExtendedRAGPipeline } = await import('../../src/lib/rag/pipeline.js');
const { RAGEvaluator } = await import('../../src/lib/evaluation/evaluator.js');

// Factory to recreate pipeline in script context
function createPipeline() {
  const pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const indexName = process.env.PINECONE_INDEX || 'clarity-1024';
  const pineconeIndex = pineconeClient.index(indexName);

  // Use Voyage AI exclusively for embeddings (1024-dimensional vectors)
  const embedder = new VoyageEmbedder();
  const pineRetriever = new PineconeRetriever(pineconeIndex, embedder, {
    hybridAlpha: 0.6,
  });
  const intentAnalyzer = new QueryIntentAnalyzer();
  const analyzer = new EnhancedFinancialAnalyst();
  const transcriptDir = path.join(process.cwd(), 'data', 'transcripts');
  const keywordRetriever = new KeywordTranscriptRetriever(transcriptDir);

  return new ExtendedRAGPipeline(
    embedder,
    pineRetriever,
    analyzer,
    intentAnalyzer,
    keywordRetriever
  );
}

function formatContext(contextItems) {
  if (!contextItems || contextItems.length === 0) return "No context retrieved.";
  
  return contextItems.map((item, index) => {
    const text = item.metadata?.text || JSON.stringify(item.metadata);
    return `[Chunk ${index + 1}] (Score: ${item.score?.toFixed(3) || 'N/A'})\n${text}`;
  }).join('\n\n');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runEvaluation() {
  console.log('Starting RAG Evaluation...');
  
  const pipeline = createPipeline();
  const evaluator = new RAGEvaluator();
  
  // Load dataset
  const datasetPath = path.join(process.cwd(), 'data', 'evaluation', 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  
  ensureDir(REPORTS_BASE);
  const strategyDir = path.join(REPORTS_BASE, STRATEGY_ID);
  ensureDir(strategyDir);
  const runTimestamp = new Date().toISOString();
  const runId = sanitizeRunId(runTimestamp);
  const runDir = path.join(strategyDir, runId);
  ensureDir(runDir);
  
  const results = [];
  const caseSummaries = [];
  
  console.log(`Loaded ${dataset.length} test cases.`);

  for (const item of dataset) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Evaluating: "${item.question}"`);
    
    // 1. Run Pipeline
    const start = Date.now();
    const result = await pipeline.process(item.question);
    const duration = Date.now() - start;
    const pipelineMetrics = result.metrics || {};
    
    const answer = result.analysis;
    const context = result.context || [];
    const formattedContext = formatContext(context);

    // 2. Evaluate
    console.log(`Running metrics...`);
    
    // Relevance (Answer vs Question)
    const relevance = await evaluator.evaluateAnswerRelevance(item.question, answer);
    await sleep(2000); // Short pause between calls
    
    // Faithfulness (Answer vs Context)
    const faithfulness = await evaluator.evaluateFaithfulness(answer, formattedContext);
    await sleep(2000); 

    // Accuracy (Answer vs Ground Truth)
    const accuracy = await evaluator.evaluateAccuracy(answer, item.ground_truth);
    await sleep(2000);

    console.log(`- Relevance:    ${relevance.score.toFixed(2)}`);
    console.log(`- Faithfulness: ${faithfulness.score.toFixed(2)}`);
    console.log(`- Accuracy:     ${accuracy.score.toFixed(2)}`);
    
    const metrics = {
      relevance,
      faithfulness,
      accuracy,
    };

    results.push({
      id: item.id,
      strategy_id: STRATEGY_ID,
      question: item.question,
      ground_truth: item.ground_truth,
      generated_answer: answer,
      context_count: context.length,
      metrics,
      duration_ms: duration,
      pipeline_metrics: pipelineMetrics
    });

    const serializedContext = serializeContext(context);
    const caseData = {
      id: item.id,
      run_id: runId,
      strategy_id: STRATEGY_ID,
      question: item.question,
      ground_truth: item.ground_truth,
      generated_answer: answer,
      duration_ms: duration,
      metrics,
      context_count: context.length,
      pipeline_metrics: pipelineMetrics,
      context: serializedContext,
      formatted_context: formattedContext,
      created_at: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(runDir, `${item.id}.json`),
      JSON.stringify(caseData, null, 2)
    );

    caseSummaries.push({
      id: item.id,
      question: item.question,
      duration_ms: duration,
      context_count: context.length,
      metrics,
      pipeline_metrics: pipelineMetrics,
      file: `${item.id}.json`,
    });

    // Rate limiting delay for Voyage/Anthropic free tier
    console.log('Pausing for 25s to respect rate limits...');
    await sleep(25000);
  }
  
  // Calculate averages
  const avgRelevance = results.reduce((sum, r) => sum + r.metrics.relevance.score, 0) / results.length;
  const avgFaithfulness = results.reduce((sum, r) => sum + r.metrics.faithfulness.score, 0) / results.length;
  const avgAccuracy = results.reduce((sum, r) => sum + r.metrics.accuracy.score, 0) / results.length;

  const timingTotals = {};
  const retrievalTotals = { pineconeMatches: 0, financialMatches: 0, keywordMatches: 0, combinedContext: 0 };
  const fallbackTotals = { usedFinancialData: 0, usedKeywordFallback: 0, financialQuery: 0, hadTranscriptMatches: 0 };
  const llmUsageTotals = {};

  results.forEach((r) => {
    const timings = r.pipeline_metrics?.timings || {};
    Object.entries(timings).forEach(([key, value]) => {
      timingTotals[key] = (timingTotals[key] || 0) + value;
    });

    const retrieval = r.pipeline_metrics?.retrieval || {};
    retrievalTotals.pineconeMatches += retrieval.pineconeMatches || 0;
    retrievalTotals.financialMatches += retrieval.financialMatches || 0;
    retrievalTotals.keywordMatches += retrieval.keywordMatches || 0;
    retrievalTotals.combinedContext += retrieval.combinedContext || 0;

    const fallbacks = r.pipeline_metrics?.fallbacks || {};
    Object.keys(fallbackTotals).forEach((key) => {
      fallbackTotals[key] += fallbacks[key] ? 1 : 0;
    });

    const usage = r.pipeline_metrics?.llm || {};
    Object.entries(usage).forEach(([key, value]) => {
      if (typeof value === 'number') {
        llmUsageTotals[key] = (llmUsageTotals[key] || 0) + value;
      }
    });
  });

  const avgTimings = {};
  Object.entries(timingTotals).forEach(([key, sum]) => {
    avgTimings[key] = sum / results.length;
  });

  const avgRetrieval = {};
  Object.entries(retrievalTotals).forEach(([key, sum]) => {
    avgRetrieval[key] = sum / results.length;
  });

  const fallbackRates = {};
  Object.entries(fallbackTotals).forEach(([key, count]) => {
    fallbackRates[key] = count / results.length;
  });

  const avgLlmUsage = {};
  Object.entries(llmUsageTotals).forEach(([key, sum]) => {
    avgLlmUsage[key] = sum / results.length;
  });
  
  console.log('\n==================================================');
  console.log('EVALUATION SUMMARY');
  console.log('==================================================');
  console.log(`Total Samples:      ${results.length}`);
  console.log(`Avg Relevance:      ${avgRelevance.toFixed(2)}`);
  console.log(`Avg Faithfulness:   ${avgFaithfulness.toFixed(2)}`);
  console.log(`Avg Accuracy:       ${avgAccuracy.toFixed(2)}`);
  if (avgTimings.totalMs) {
    console.log(`Avg Total Latency:  ${avgTimings.totalMs.toFixed(2)} ms`);
  }
  console.log('==================================================');
  
  const runSummary = {
    run_id: runId,
    strategy_id: STRATEGY_ID,
    created_at: runTimestamp,
    dataset: path.relative(process.cwd(), datasetPath),
    total_cases: results.length,
    summary: {
      avg_relevance: avgRelevance,
      avg_faithfulness: avgFaithfulness,
      avg_accuracy: avgAccuracy,
      timings_ms: avgTimings,
      retrieval: avgRetrieval,
      fallback_rates: fallbackRates,
      llm_usage: avgLlmUsage
    },
    cases: caseSummaries,
  };

  fs.writeFileSync(
    path.join(runDir, 'run.json'),
    JSON.stringify(runSummary, null, 2)
  );

  console.log(`Run artifacts saved to ${runDir}`);

  // Backwards-compatible summary file
  const reportPath = path.join(process.cwd(), '_cleanup', 'evals', 'evaluation_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    run_id: runId,
    strategy_id: STRATEGY_ID,
    timestamp: runTimestamp,
    summary: runSummary.summary,
    details: results
  }, null, 2));
  
  console.log(`Latest summary written to ${reportPath}`);
}

runEvaluation().catch(console.error);
