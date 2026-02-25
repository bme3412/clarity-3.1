#!/usr/bin/env node
/**
 * Generate Evaluation Report for Blog Post
 * 
 * This script generates markdown reports comparing RAG strategy performance
 * over time, suitable for inclusion in a blog post documenting improvements.
 * 
 * Usage:
 *   node scripts/generate-eval-report.js [--format markdown|json|html]
 */

import fs from 'fs';
import path from 'path';
import { StrategyRegistry } from '../src/lib/evaluation/strategyRegistry.js';

const REPORTS_DIR = path.join(process.cwd(), 'evaluation_reports');
// Serve via Next static assets: public/evaluations/*
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'evaluations');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatPercent(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(value, isLatency = false) {
  if (value === null || value === undefined) return '';
  const sign = value > 0 ? '+' : '';
  const color = isLatency 
    ? (value < 0 ? '🟢' : value > 0 ? '🔴' : '⚪')
    : (value > 0 ? '🟢' : value < 0 ? '🔴' : '⚪');
  return `${color} ${sign}${(value * 100).toFixed(1)}%`;
}

function generateMarkdownReport(registry) {
  const strategies = registry.listStrategies().sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  );
  
  let md = `# Clarity RAG Evaluation Report\n\n`;
  md += `> Generated: ${new Date().toISOString()}\n\n`;
  md += `This report tracks the evolution of our RAG (Retrieval-Augmented Generation) system `;
  md += `for financial analysis. Each strategy version represents improvements to embedding, `;
  md += `retrieval, or synthesis components.\n\n`;

  // Executive Summary
  md += `## 📊 Executive Summary\n\n`;
  
  if (strategies.length > 0) {
    const latest = strategies[strategies.length - 1];
    const latestRun = registry.getLatestRun(latest.codename);
    
    if (latestRun?.summary) {
      md += `**Current Strategy:** ${latest.codename} (${latest.version})\n\n`;
      md += `| Metric | Score |\n`;
      md += `|--------|-------|\n`;
      md += `| Relevance | ${formatPercent(latestRun.summary.avg_relevance)} |\n`;
      md += `| Faithfulness | ${formatPercent(latestRun.summary.avg_faithfulness)} |\n`;
      md += `| Accuracy | ${formatPercent(latestRun.summary.avg_accuracy)} |\n`;
      md += `| Avg Latency | ${latestRun.summary.timings_ms?.totalMs?.toFixed(0) || 'N/A'}ms |\n`;
      md += `\n`;
    }
  }

  // Strategy Evolution
  md += `## 🔄 Strategy Evolution\n\n`;
  
  for (let i = 0; i < strategies.length; i++) {
    const s = strategies[i];
    const fullStrategy = registry.getStrategy(s.codename);
    const latestRun = registry.getLatestRun(s.codename);
    
    md += `### ${s.version}: ${s.codename}\n\n`;
    md += `**Created:** ${s.created_at} | **Status:** ${s.status}\n\n`;
    md += `${s.description}\n\n`;
    
    // Configuration Summary
    md += `<details>\n<summary>📋 Configuration Details</summary>\n\n`;
    
    if (fullStrategy.embedding) {
      md += `**Embedding:**\n`;
      md += `- Model: \`${fullStrategy.embedding.model}\`\n`;
      md += `- Dimensions: ${fullStrategy.embedding.dimensions}\n`;
      md += `- Provider: ${fullStrategy.embedding.provider}\n\n`;
    }
    
    if (fullStrategy.retrieval) {
      md += `**Retrieval:**\n`;
      md += `- Vector DB: ${fullStrategy.retrieval.vector_db}\n`;
      md += `- Search Type: ${fullStrategy.retrieval.search_type}\n`;
      md += `- Top-K: ${fullStrategy.retrieval.top_k}\n`;
      md += `- Reranking: ${fullStrategy.retrieval.reranking}\n\n`;
    }
    
    if (fullStrategy.chunking) {
      md += `**Chunking:**\n`;
      md += `- Strategy: ${fullStrategy.chunking.strategy}\n`;
      md += `- Chunk Size: ${fullStrategy.chunking.chunk_size}\n`;
      md += `- Overlap: ${fullStrategy.chunking.overlap}\n\n`;
    }
    
    md += `</details>\n\n`;
    
    // Metrics
    if (latestRun?.summary) {
      md += `**Evaluation Results:**\n\n`;
      md += `| Metric | Score | vs Previous |\n`;
      md += `|--------|-------|-------------|\n`;
      
      const prevStrategy = i > 0 ? strategies[i - 1] : null;
      const prevRun = prevStrategy ? registry.getLatestRun(prevStrategy.codename) : null;
      
      const relevanceDelta = prevRun?.summary 
        ? latestRun.summary.avg_relevance - prevRun.summary.avg_relevance 
        : null;
      const faithfulnessDelta = prevRun?.summary 
        ? latestRun.summary.avg_faithfulness - prevRun.summary.avg_faithfulness 
        : null;
      const accuracyDelta = prevRun?.summary 
        ? latestRun.summary.avg_accuracy - prevRun.summary.avg_accuracy 
        : null;
      
      md += `| Relevance | ${formatPercent(latestRun.summary.avg_relevance)} | ${formatDelta(relevanceDelta)} |\n`;
      md += `| Faithfulness | ${formatPercent(latestRun.summary.avg_faithfulness)} | ${formatDelta(faithfulnessDelta)} |\n`;
      md += `| Accuracy | ${formatPercent(latestRun.summary.avg_accuracy)} | ${formatDelta(accuracyDelta)} |\n`;
      md += `\n`;
    } else {
      md += `*No evaluation runs yet*\n\n`;
    }
    
    // Known Limitations
    if (fullStrategy.known_limitations?.length > 0) {
      md += `**Known Limitations:**\n`;
      for (const limitation of fullStrategy.known_limitations) {
        md += `- ${limitation}\n`;
      }
      md += `\n`;
    }
    
    md += `---\n\n`;
  }

  // Metrics Definitions
  md += `## 📖 Metrics Definitions\n\n`;
  md += `| Metric | Description | Range |\n`;
  md += `|--------|-------------|-------|\n`;
  md += `| **Relevance** | Does the answer address the user's question? | 0-100% |\n`;
  md += `| **Faithfulness** | Is the answer grounded in retrieved context? | 0-100% |\n`;
  md += `| **Accuracy** | Does the answer match ground truth facts? | 0-100% |\n`;
  md += `| **Latency** | End-to-end response time | ms |\n`;
  md += `\n`;

  // Appendix: Test Cases
  md += `## 📝 Evaluation Dataset\n\n`;
  
  try {
    const datasetPath = path.join(process.cwd(), 'data', 'evaluation', 'dataset.json');
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    
    md += `The evaluation uses ${dataset.length} test cases across categories:\n\n`;
    
    const categories = {};
    for (const item of dataset) {
      const cat = item.category || 'uncategorized';
      categories[cat] = (categories[cat] || 0) + 1;
    }
    
    md += `| Category | Count |\n`;
    md += `|----------|-------|\n`;
    for (const [cat, count] of Object.entries(categories)) {
      md += `| ${cat} | ${count} |\n`;
    }
    md += `\n`;
    
  } catch (e) {
    md += `*Dataset not found*\n\n`;
  }

  return md;
}

function generateJSONExport(registry) {
  return registry.exportForBlogPost();
}

async function main() {
  const format = process.argv.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'markdown';
  
  console.log('🔍 Loading strategy registry...');
  const registry = new StrategyRegistry();
  
  const strategies = registry.listStrategies();
  console.log(`📊 Found ${strategies.length} strategies`);
  
  for (const s of strategies) {
    const runs = registry.getEvaluationResults(s.codename);
    console.log(`   - ${s.codename}: ${runs.length} evaluation runs`);
  }
  
  ensureDir(OUTPUT_DIR);
  
  if (format === 'markdown' || format === 'all') {
    console.log('\n📝 Generating Markdown report...');
    const mdReport = generateMarkdownReport(registry);
    const mdPath = path.join(OUTPUT_DIR, 'EVALUATION_REPORT.md');
    fs.writeFileSync(mdPath, mdReport);
    console.log(`   ✅ Written to ${mdPath}`);
  }
  
  if (format === 'json' || format === 'all') {
    console.log('\n📦 Generating JSON export...');
    const jsonExport = generateJSONExport(registry);
    const jsonPath = path.join(OUTPUT_DIR, 'evaluation-data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonExport, null, 2));
    console.log(`   ✅ Written to ${jsonPath}`);
  }
  
  console.log('\n✨ Report generation complete!');
}

main().catch(console.error);

