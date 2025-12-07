#!/usr/bin/env node
/**
 * Clarity 3.0 - Pinecone Hybrid Index Setup
 * 
 * This script helps you set up a Pinecone index that supports hybrid search
 * (dense + sparse vectors) for better retrieval performance.
 * 
 * Usage:
 *   node scripts/setup-pinecone-hybrid.js --check      Check current index config
 *   node scripts/setup-pinecone-hybrid.js --create     Create new hybrid-enabled index
 *   node scripts/setup-pinecone-hybrid.js --migrate    Delete old and create new (DESTRUCTIVE!)
 */

import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import fsSync from 'fs';
import readline from 'readline';

// Load environment variables
try {
  const envConfig = dotenv.parse(fsSync.readFileSync('.env'));
  for (const k in envConfig) process.env[k] = envConfig[k];
} catch (e) {
  dotenv.config();
}

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'clarity-1024';

if (!PINECONE_API_KEY) {
  console.error('❌ PINECONE_API_KEY is required');
  process.exit(1);
}

const pc = new Pinecone({ apiKey: PINECONE_API_KEY });

// =============================================================================
// HELPERS
// =============================================================================

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// COMMANDS
// =============================================================================

async function checkIndex() {
  console.log('\n🔍 Checking Pinecone index configuration...\n');
  
  try {
    const indexes = await pc.listIndexes();
    const indexList = indexes?.indexes || [];
    
    console.log(`Found ${indexList.length} index(es):\n`);
    
    for (const idx of indexList) {
      const isTarget = idx.name === PINECONE_INDEX;
      const supportsSparse = idx.metric === 'dotproduct';
      
      console.log(`${isTarget ? '→' : ' '} ${idx.name}`);
      console.log(`    Host: ${idx.host}`);
      console.log(`    Dimension: ${idx.dimension}`);
      console.log(`    Metric: ${idx.metric}`);
      console.log(`    Status: ${idx.status?.ready ? '✅ Ready' : '⏳ Not ready'}`);
      
      // Check if it's serverless (supports hybrid)
      if (idx.spec?.serverless) {
        console.log(`    Type: Serverless (${idx.spec.serverless.cloud}/${idx.spec.serverless.region})`);
        // Hybrid search requires dotproduct metric
        if (supportsSparse) {
          console.log(`    Hybrid Search: ✅ Supported (dotproduct metric)`);
        } else {
          console.log(`    Hybrid Search: ❌ Requires dotproduct metric (currently ${idx.metric})`);
        }
      } else if (idx.spec?.pod) {
        console.log(`    Type: Pod-based (${idx.spec.pod.pod_type})`);
        console.log(`    Hybrid Search: ${supportsSparse ? '✅ Supported' : '❌ Requires dotproduct metric'}`);
      }
      console.log('');
    }
    
    // Check if target index exists
    const targetExists = indexList.some(idx => idx.name === PINECONE_INDEX);
    if (!targetExists) {
      console.log(`⚠️  Target index "${PINECONE_INDEX}" not found!`);
      console.log(`   Run: node scripts/setup-pinecone-hybrid.js --create`);
    }
    
  } catch (error) {
    console.error('❌ Error checking indexes:', error.message);
  }
}

async function createIndex() {
  console.log('\n🚀 Creating hybrid-enabled Pinecone index...\n');
  
  // Check if index already exists
  try {
    const indexes = await pc.listIndexes();
    const exists = indexes?.indexes?.some(idx => idx.name === PINECONE_INDEX);
    
    if (exists) {
      console.log(`⚠️  Index "${PINECONE_INDEX}" already exists!`);
      console.log('   Use --migrate to delete and recreate (DESTRUCTIVE!)');
      return;
    }
  } catch (error) {
    // Continue if we can't check
  }
  
  console.log('Creating serverless index with hybrid search support...');
  console.log(`  Name: ${PINECONE_INDEX}`);
  console.log('  Dimension: 1024 (Voyage 3.5)');
  console.log('  Metric: dotproduct (required for hybrid)');
  console.log('  Type: Serverless (AWS us-east-1)');
  console.log('');
  
  try {
    await pc.createIndex({
      name: PINECONE_INDEX,
      dimension: 1024,
      metric: 'dotproduct',  // Required for hybrid search
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    
    console.log('⏳ Index creation initiated. Waiting for ready status...');
    
    // Wait for index to be ready
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 60) {
      await sleep(5000);
      const indexes = await pc.listIndexes();
      const idx = indexes?.indexes?.find(i => i.name === PINECONE_INDEX);
      ready = idx?.status?.ready === true;
      attempts++;
      process.stdout.write('.');
    }
    
    console.log('\n');
    
    if (ready) {
      console.log('✅ Index created successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Run embeddings: node scripts/embed-all-voyage.js --all');
      console.log('  2. Verify: node scripts/embed-all-voyage.js --status');
    } else {
      console.log('⚠️  Index creation may still be in progress.');
      console.log('   Check status: node scripts/setup-pinecone-hybrid.js --check');
    }
    
  } catch (error) {
    console.error('❌ Error creating index:', error.message);
    
    if (error.message?.includes('INVALID_ARGUMENT')) {
      console.log('\n💡 Tip: You may need to use a different region or check your Pinecone plan.');
      console.log('   Serverless indexes are available on Starter (free) and Standard plans.');
    }
  }
}

async function migrateIndex() {
  console.log('\n⚠️  WARNING: This will DELETE your existing index and all vectors!\n');
  
  const answer = await prompt('Type "yes" to confirm deletion: ');
  
  if (answer !== 'yes') {
    console.log('Cancelled.');
    return;
  }
  
  console.log('\n🗑️  Deleting existing index...');
  
  try {
    await pc.deleteIndex(PINECONE_INDEX);
    console.log('   Deleted. Waiting for cleanup...');
    await sleep(10000);
  } catch (error) {
    if (!error.message?.includes('not found')) {
      console.error('   Error deleting:', error.message);
    }
  }
  
  // Create new index
  await createIndex();
}

// =============================================================================
// MAIN
// =============================================================================

async function createNewHybridIndex(newName) {
  const indexName = newName || 'clarity-voyage-hybrid';
  
  console.log(`\n🚀 Creating NEW hybrid index: ${indexName}\n`);
  
  // Check if index already exists
  try {
    const indexes = await pc.listIndexes();
    const exists = indexes?.indexes?.some(idx => idx.name === indexName);
    
    if (exists) {
      console.log(`⚠️  Index "${indexName}" already exists!`);
      return;
    }
  } catch (error) {
    // Continue
  }
  
  console.log('Creating serverless index with hybrid search support...');
  console.log(`  Name: ${indexName}`);
  console.log('  Dimension: 1024 (Voyage 3.5)');
  console.log('  Metric: dotproduct (required for hybrid)');
  console.log('  Type: Serverless (AWS us-east-1)');
  console.log('');
  
  try {
    await pc.createIndex({
      name: indexName,
      dimension: 1024,
      metric: 'dotproduct',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    
    console.log('⏳ Index creation initiated. Waiting for ready status...');
    
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 60) {
      await sleep(5000);
      const indexes = await pc.listIndexes();
      const idx = indexes?.indexes?.find(i => i.name === indexName);
      ready = idx?.status?.ready === true;
      attempts++;
      process.stdout.write('.');
    }
    
    console.log('\n');
    
    if (ready) {
      console.log('✅ Index created successfully!');
      console.log('');
      console.log('Next steps:');
      console.log(`  1. Update .env: PINECONE_INDEX=${indexName}`);
      console.log('  2. Run embeddings: node scripts/embed-all-voyage.js --all');
      console.log('  3. Verify: node scripts/embed-all-voyage.js --status');
    }
    
  } catch (error) {
    console.error('❌ Error creating index:', error.message);
  }
}

const args = process.argv.slice(2);

if (args.includes('--check')) {
  checkIndex();
} else if (args.includes('--create')) {
  createIndex();
} else if (args.includes('--migrate')) {
  migrateIndex();
} else if (args.includes('--new')) {
  const nameIdx = args.indexOf('--new');
  const newName = args[nameIdx + 1] || 'clarity-voyage-hybrid';
  createNewHybridIndex(newName);
} else {
  console.log(`
Clarity 3.0 - Pinecone Hybrid Index Setup
==========================================

This script helps you set up a Pinecone index that supports hybrid search
(dense + sparse vectors) for better retrieval performance.

Commands:
  --check              Check current index configuration
  --create             Create index with name from PINECONE_INDEX env var
  --migrate            Delete old and create new (DESTRUCTIVE!)
  --new [name]         Create NEW index (keeps old one), default: clarity-voyage-hybrid

Examples:
  node scripts/setup-pinecone-hybrid.js --check
  node scripts/setup-pinecone-hybrid.js --new clarity-voyage-hybrid
  node scripts/setup-pinecone-hybrid.js --migrate

Current target index: ${PINECONE_INDEX}

⚠️  Your current index uses 'cosine' metric which doesn't support sparse vectors.
    Hybrid search requires 'dotproduct' metric.
`);
}
