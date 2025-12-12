#!/usr/bin/env node
/**
 * RAG evaluation runner (golden set + smoke mode).
 * 
 * Usage:
 *   node scripts/run-evals.js --strategy baseline
 *   node scripts/run-evals.js --smoke            (short delay, capped cases)
 *   node scripts/run-evals.js --dataset data/evaluation/dataset.json --limit 5
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

dotenv.config();

const DEFAULT_DATASET = path.join(process.cwd(), 'data', 'evaluation', 'dataset.json');
const REPORTS_BASE = path.join(process.cwd(), 'evaluation_reports');

const PASS_THRESHOLDS = {
  relevance: 0.8,
  faithfulness: 0.8,
  accuracy: 0.8,
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeRunId(timestamp) {
  return timestamp.replace(/[:.]/g, '-');
}

function parseArg(flag, fallback) {
  const pair = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (!pair) return fallback;
  return pair.split('=')[1];
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

function formatContext(contextItems) {
  if (!contextItems || contextItems.length === 0) return 'No context retrieved.';

  return contextItems
    .map((item, index) => {
      const text = item.metadata?.text || JSON.stringify(item.metadata);
      return `[Chunk ${index + 1}] (Score: ${item.score?.toFixed(3) || 'N/A'})\n${text}`;
    })
    .join('\n\n');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values = [], p = 50) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Dynamic imports to ensure env vars are loaded first
const {
  VoyageEmbedder,
  PineconeRetriever,
  QueryIntentAnalyzer,
  EnhancedFinancialAnalyst,
  KeywordTranscriptRetriever,
} = await import('../src/lib/rag/components.js');

const { ExtendedRAGPipeline } = await import('../src/lib/rag/pipeline.js');
const { RAGEvaluator } = await import('../src/lib/evaluation/evaluator.js');

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

async function run() {
  const strategyId = parseArg('--strategy', process.env.RAG_STRATEGY_ID || 'baseline');
  const datasetPath = parseArg('--dataset', DEFAULT_DATASET);
  const limitArg = parseInt(parseArg('--limit', ''), 10);
  const smoke = process.argv.includes('--smoke');
  const effectiveLimit = smoke ? Math.min(limitArg || 8, 8) : Number.isFinite(limitArg) ? limitArg : null;
  const delayMs = parseInt(parseArg('--delay', smoke ? '3000' : '25000'), 10);

  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset not found at ${datasetPath}`);
  }

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const testCases = effectiveLimit ? dataset.slice(0, effectiveLimit) : dataset;

  ensureDir(REPORTS_BASE);
  const strategyDir = path.join(REPORTS_BASE, strategyId);
  ensureDir(strategyDir);

  const runTimestamp = new Date().toISOString();
  const runId = sanitizeRunId(runTimestamp);
  const runDir = path.join(strategyDir, runId);
  ensureDir(runDir);

  console.log(`🔎 Strategy: ${strategyId}`);
  console.log(`🧪 Dataset: ${datasetPath}`);
  console.log(`🧪 Cases: ${testCases.length}${effectiveLimit ? ` (capped from ${dataset.length})` : ''}`);
  console.log(`⏱️ Delay between judge calls: ${delayMs}ms`);
  if (smoke) {
    console.log('⚡ Smoke mode enabled (short delay, capped cases).');
  }

  const pipeline = createPipeline();
  const evaluator = new RAGEvaluator();

  const results = [];
  const caseSummaries = [];

  for (const item of testCases) {
    console.log('\n--------------------------------------------------');
    console.log(`Evaluating: "${item.question}"`);

    const start = Date.now();
    const result = await pipeline.process(item.question);
    const duration = Date.now() - start;
    const pipelineMetrics = result.metrics || {};

    const answer = result.analysis;
    const context = result.context || [];
    const formattedContext = formatContext(context);

    console.log('Running metrics...');
    const relevance = await evaluator.evaluateAnswerRelevance(item.question, answer);
    await sleep(delayMs);
    const faithfulness = await evaluator.evaluateFaithfulness(answer, formattedContext);
    await sleep(delayMs);
    const accuracy = await evaluator.evaluateAccuracy(answer, item.ground_truth);
    await sleep(delayMs);

    console.log(`- Relevance:    ${relevance.score.toFixed(2)}`);
    console.log(`- Faithfulness: ${faithfulness.score.toFixed(2)}`);
    console.log(`- Accuracy:     ${accuracy.score.toFixed(2)}`);

    const metrics = { relevance, faithfulness, accuracy };

    // Pass/Fail rubric including unanswerable handling
    const isUnanswerable =
      (item.category && item.category.toLowerCase() === 'unanswerable') ||
      (item.ground_truth || '').toLowerCase().includes('not found in provided sources');
    const normalizedAnswer = (answer || '').toLowerCase();
    const failReasons = [];
    let passed = false;

    if (isUnanswerable) {
      const hasNotFound =
        normalizedAnswer.includes('not found in provided sources') ||
        normalizedAnswer.includes('not found');
      passed = hasNotFound;
      if (!hasNotFound) {
        failReasons.push('Unanswerable: expected "Not found in provided sources."');
      }
    } else {
      if (relevance.score < PASS_THRESHOLDS.relevance) {
        failReasons.push(`Relevance below ${PASS_THRESHOLDS.relevance}`);
      }
      if (faithfulness.score < PASS_THRESHOLDS.faithfulness) {
        failReasons.push(`Faithfulness below ${PASS_THRESHOLDS.faithfulness}`);
      }
      if (accuracy.score < PASS_THRESHOLDS.accuracy) {
        failReasons.push(`Accuracy below ${PASS_THRESHOLDS.accuracy}`);
      }
      passed =
        relevance.score >= PASS_THRESHOLDS.relevance &&
        faithfulness.score >= PASS_THRESHOLDS.faithfulness &&
        accuracy.score >= PASS_THRESHOLDS.accuracy;
    }

    results.push({
      id: item.id,
      strategy_id: strategyId,
      question: item.question,
      ground_truth: item.ground_truth,
      generated_answer: answer,
      context_count: context.length,
      metrics,
      duration_ms: duration,
      pipeline_metrics: pipelineMetrics,
      category: item.category,
      pass: passed,
      fail_reasons: failReasons,
    });

    const serializedContext = serializeContext(context);
    const caseData = {
      id: item.id,
      run_id: runId,
      strategy_id: strategyId,
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
      category: item.category,
    };

    fs.writeFileSync(path.join(runDir, `${item.id}.json`), JSON.stringify(caseData, null, 2));

    caseSummaries.push({
      id: item.id,
      question: item.question,
      duration_ms: duration,
      context_count: context.length,
      metrics,
      pipeline_metrics: pipelineMetrics,
      file: `${item.id}.json`,
      category: item.category,
      pass: passed,
    });
  }

  const avg = (arr, fn) => (arr.length ? arr.reduce((sum, r) => sum + fn(r), 0) / arr.length : 0);

  const avgRelevance = avg(results, (r) => r.metrics.relevance.score);
  const avgFaithfulness = avg(results, (r) => r.metrics.faithfulness.score);
  const avgAccuracy = avg(results, (r) => r.metrics.accuracy.score);

  const durations = results.map((r) => r.duration_ms).filter((d) => Number.isFinite(d));
  const latencyP50 = percentile(durations, 50);
  const latencyP95 = percentile(durations, 95);

  const unanswerableCases = results.filter(
    (r) =>
      (r.category && r.category.toLowerCase() === 'unanswerable') ||
      (r.ground_truth || '').toLowerCase().includes('not found in provided sources')
  );
  const unanswerablePassRate =
    unanswerableCases.length > 0
      ? unanswerableCases.filter((r) => r.pass).length / unanswerableCases.length
      : null;

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
    fallbackRates[key] = results.length ? count / results.length : 0;
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
  const totalPasses = results.filter((r) => r.pass).length;
  console.log(`Pass Rate:          ${(results.length ? (totalPasses / results.length) * 100 : 0).toFixed(1)}%`);
  if (latencyP50 !== null) {
    console.log(`Latency P50:        ${latencyP50.toFixed(1)} ms`);
  }
  if (latencyP95 !== null) {
    console.log(`Latency P95:        ${latencyP95.toFixed(1)} ms`);
  }
  if (unanswerablePassRate !== null) {
    console.log(`Unanswerable Pass:  ${(unanswerablePassRate * 100).toFixed(1)}% (${unanswerableCases.length} cases)`);
  }
  if (avgTimings.totalMs) {
    console.log(`Avg Total Latency:  ${avgTimings.totalMs.toFixed(2)} ms`);
  }
  console.log('==================================================');

  const runSummary = {
    run_id: runId,
    strategy_id: strategyId,
    created_at: runTimestamp,
    dataset: path.relative(process.cwd(), datasetPath),
    total_cases: results.length,
    pass_rate: results.length ? totalPasses / results.length : 0,
    summary: {
      avg_relevance: avgRelevance,
      avg_faithfulness: avgFaithfulness,
      avg_accuracy: avgAccuracy,
      timings_ms: avgTimings,
      retrieval: avgRetrieval,
      fallback_rates: fallbackRates,
      llm_usage: avgLlmUsage,
      latency_ms: {
        p50: latencyP50,
        p95: latencyP95,
        avg_total: avgTimings.totalMs || avg(durations, (d) => d),
      },
      unanswerable: {
        cases: unanswerableCases.length,
        pass_rate: unanswerablePassRate,
      },
    },
    cases: caseSummaries,
  };

  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(runSummary, null, 2));

  fs.writeFileSync(
    path.join(process.cwd(), 'evaluation_report.json'),
    JSON.stringify(
      {
        run_id: runId,
        strategy_id: strategyId,
        dataset: runSummary.dataset,
        timestamp: runTimestamp,
        summary: runSummary.summary,
        details: results,
      },
      null,
      2
    )
  );

  console.log(`Run artifacts saved to ${runDir}`);
  console.log('Latest summary written to evaluation_report.json');
}

run().catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});

