#!/usr/bin/env node
/**
 * Create a New RAG Strategy Version
 * 
 * This script helps create a new strategy version for tracking RAG improvements.
 * It copies the previous strategy as a template and prompts for changes.
 * 
 * Usage:
 *   node scripts/create-strategy.js <version> <codename> [--from <previous-codename>]
 * 
 * Example:
 *   node scripts/create-strategy.js v1.1 hybrid-search --from baseline
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const STRATEGIES_DIR = path.join(process.cwd(), 'src', 'lib', 'evaluation', 'strategies');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node scripts/create-strategy.js <version> <codename> [--from <previous-codename>]');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/create-strategy.js v1.1 hybrid-search --from baseline');
    process.exit(1);
  }
  
  const version = args[0];
  const codename = args[1];
  const fromIndex = args.indexOf('--from');
  const fromCodename = fromIndex !== -1 ? args[fromIndex + 1] : 'baseline';
  
  ensureDir(STRATEGIES_DIR);
  
  // Check if target already exists
  const targetPath = path.join(STRATEGIES_DIR, `${codename}.json`);
  if (fs.existsSync(targetPath)) {
    console.error(`❌ Strategy '${codename}' already exists at ${targetPath}`);
    process.exit(1);
  }
  
  // Load template from previous strategy
  let template = {
    version: version,
    codename: codename,
    created_at: new Date().toISOString().split('T')[0],
    status: 'development',
    description: '',
    embedding: {
      model: 'voyage-3.5',
      provider: 'Voyage AI',
      dimensions: 1024,
      input_types: { documents: 'document', queries: 'query' },
      batch_size: 10,
      rate_limit_delay_ms: 21000
    },
    chunking: {
      strategy: 'semantic',
      chunk_size: 1500,
      overlap: 200,
      special_handling: {}
    },
    retrieval: {
      vector_db: 'Pinecone',
      index_name: 'clarity-openai',
      search_type: 'dense',
      top_k: 12,
      hybrid_alpha: 0.6,
      reranking: 'none',
      filters: ['company', 'fiscalYear', 'quarter', 'type']
    },
    query_enhancement: {
      preprocessing: true,
      financial_term_expansion: true,
      timeframe_boosting: true
    },
    synthesis: {
      model: 'claude-sonnet-4-5-20250929',
      provider: 'Anthropic',
      max_tokens: 800,
      temperature: 0.7,
      streaming: true
    },
    changelog: [],
    known_limitations: [],
    target_improvements: [],
    key_metrics_baseline: {
      avg_relevance: null,
      avg_faithfulness: null,
      avg_accuracy: null,
      avg_latency_ms: null
    }
  };
  
  // Try to load from previous strategy
  const fromPath = path.join(STRATEGIES_DIR, `${fromCodename}.json`);
  if (fs.existsSync(fromPath)) {
    console.log(`📋 Loading template from ${fromCodename}...`);
    const prev = JSON.parse(fs.readFileSync(fromPath, 'utf-8'));
    template = {
      ...prev,
      version: version,
      codename: codename,
      created_at: new Date().toISOString().split('T')[0],
      status: 'development',
      parent_strategy: fromCodename,
      changelog: [],
      key_metrics_baseline: {
        avg_relevance: null,
        avg_faithfulness: null,
        avg_accuracy: null,
        avg_latency_ms: null
      }
    };
  } else {
    console.log(`⚠️  Previous strategy '${fromCodename}' not found, using default template`);
  }
  
  console.log('');
  console.log('📝 Creating new strategy version...');
  console.log(`   Version: ${version}`);
  console.log(`   Codename: ${codename}`);
  console.log(`   Based on: ${fromCodename}`);
  console.log('');
  
  // Write the strategy file
  fs.writeFileSync(targetPath, JSON.stringify(template, null, 2));
  
  console.log(`✅ Strategy created at ${targetPath}`);
  console.log('');
  console.log('Next steps:');
  console.log(`1. Edit ${targetPath} to describe your changes`);
  console.log(`2. Update the 'description' and 'changelog' fields`);
  console.log(`3. Implement your changes in the codebase`);
  console.log(`4. Run evaluation: RAG_STRATEGY_ID=${codename} node scripts/evaluate-rag.js`);
  console.log(`5. Generate report: node scripts/generate-eval-report.js`);
}

main().catch(console.error);

