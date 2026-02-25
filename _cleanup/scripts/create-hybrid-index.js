#!/usr/bin/env node
/**
 * Create a new Pinecone index with sparse vector support for hybrid search.
 * 
 * Usage:
 *   node scripts/create-hybrid-index.js
 *   node scripts/create-hybrid-index.js --check
 * 
 * This creates an index named 'clarity-hybrid' that supports:
 * - Dense vectors (1536 dimensions for OpenAI text-embedding-3-small)
 * - Sparse vectors (for BM25/keyword matching)
 * - Dotproduct metric (required for hybrid search)
 */

import { Pinecone } from '@pinecone-database/pinecone';
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

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const NEW_INDEX_NAME = 'clarity-hybrid';
const DIMENSION = 1536; // OpenAI text-embedding-3-small dimensions

if (!PINECONE_API_KEY) {
  console.error('Error: PINECONE_API_KEY must be set in .env');
  process.exit(1);
}

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

async function checkIndexes() {
  console.log('\n📊 Current Pinecone Indexes\n');
  
  const indexes = await pinecone.listIndexes();
  
  if (indexes.indexes && indexes.indexes.length > 0) {
    console.log('Existing indexes:');
    console.log('─'.repeat(60));
    
    for (const idx of indexes.indexes) {
      console.log(`\n📌 ${idx.name}`);
      console.log(`   Host: ${idx.host}`);
      console.log(`   Dimension: ${idx.dimension}`);
      console.log(`   Metric: ${idx.metric}`);
      console.log(`   Status: ${idx.status?.ready ? '✅ Ready' : '⏳ Initializing'}`);
      
      // Get stats for each index
      try {
        const index = pinecone.index(idx.name);
        const stats = await index.describeIndexStats();
        console.log(`   Vectors: ${stats.totalRecordCount || 0}`);
      } catch (e) {
        console.log(`   Vectors: Unable to fetch`);
      }
    }
    console.log('\n' + '─'.repeat(60));
  } else {
    console.log('No indexes found.');
  }
}

async function createHybridIndex() {
  console.log('\n🚀 Creating Hybrid Index for True Hybrid Search\n');
  
  // Check if index already exists
  const indexes = await pinecone.listIndexes();
  const existingIndex = indexes.indexes?.find(idx => idx.name === NEW_INDEX_NAME);
  
  if (existingIndex) {
    console.log(`⚠️  Index '${NEW_INDEX_NAME}' already exists!`);
    console.log(`   Dimension: ${existingIndex.dimension}`);
    console.log(`   Metric: ${existingIndex.metric}`);
    console.log(`   Status: ${existingIndex.status?.ready ? '✅ Ready' : '⏳ Initializing'}`);
    console.log('\nTo recreate, delete the existing index first in the Pinecone console.');
    return;
  }
  
  console.log(`Creating index: ${NEW_INDEX_NAME}`);
  console.log(`  Dimension: ${DIMENSION}`);
  console.log(`  Metric: dotproduct (required for hybrid search)`);
  console.log(`  Serverless: AWS us-east-1`);
  console.log('');
  
  try {
    await pinecone.createIndex({
      name: NEW_INDEX_NAME,
      dimension: DIMENSION,
      metric: 'dotproduct',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    
    console.log('✅ Index creation initiated!');
    console.log('');
    console.log('⏳ Waiting for index to be ready...');
    
    // Wait for index to be ready
    let ready = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (!ready && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
      attempts++;
      
      const updatedIndexes = await pinecone.listIndexes();
      const newIndex = updatedIndexes.indexes?.find(idx => idx.name === NEW_INDEX_NAME);
      
      if (newIndex?.status?.ready) {
        ready = true;
        console.log('');
        console.log('✅ Index is ready!');
        console.log(`   Host: ${newIndex.host}`);
      } else {
        process.stdout.write('.');
      }
    }
    
    if (!ready) {
      console.log('\n⚠️  Index is still initializing. Check Pinecone console for status.');
    }
    
    console.log('');
    console.log('📋 Next Steps:');
    console.log('─'.repeat(50));
    console.log('1. Update .env to use the new index:');
    console.log(`   PINECONE_INDEX_NAME=${NEW_INDEX_NAME}`);
    console.log('');
    console.log('2. Re-embed all data with sparse vectors:');
    console.log('   node scripts/embed-ticker.js --all');
    console.log('');
    console.log('3. Update the retrieval code to use hybrid search');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error creating index:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\nThe index already exists. Use --check to see current indexes.');
    } else if (error.message.includes('quota')) {
      console.log('\nYou may have reached your Pinecone quota. Check your plan limits.');
    }
  }
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--check')) {
  await checkIndexes();
} else if (args.includes('--help')) {
  console.log(`
📚 Create Hybrid Pinecone Index

Usage:
  node scripts/create-hybrid-index.js          Create the hybrid index
  node scripts/create-hybrid-index.js --check  Check existing indexes
  node scripts/create-hybrid-index.js --help   Show this help

This creates a new index '${NEW_INDEX_NAME}' with:
- dotproduct metric (required for hybrid search)
- ${DIMENSION} dimensions (OpenAI text-embedding-3-small)
- Serverless deployment on AWS us-east-1

After creation, update your embedding script to include sparse vectors.
`);
} else {
  await createHybridIndex();
}

