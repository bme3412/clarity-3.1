#!/usr/bin/env node
/**
 * Quick check for AMZN vectors in Pinecone
 */

import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load env
try {
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = await fs.readFile(envPath, 'utf8');
  const envConfig = dotenv.parse(envContent);
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} catch (e) {
  dotenv.config();
}

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function checkAMZN() {
  console.log('\n🔍 Checking AMZN vectors in Pinecone indexes\n');
  
  // Get embedding for "AWS cloud revenue"
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      input: 'AWS cloud revenue growth',
      model: 'text-embedding-3-small'
    })
  });
  const embData = await response.json();
  const awsQueryVector = embData.data[0].embedding;
  
  for (const indexName of ['clarity-openai', 'clarity-hybrid']) {
    console.log(`\n📌 ${indexName}:`);
    try {
      const index = pinecone.index(indexName);
      
      // Semantic search for AWS cloud
      const result = await index.query({
        vector: awsQueryVector,
        topK: 5,
        filter: { ticker: 'AMZN' },
        includeMetadata: true
      });
      
      console.log(`  Found ${result.matches?.length || 0} matches for "AWS cloud revenue"`);
      
      if (result.matches?.length > 0) {
        console.log('  Results:');
        result.matches.slice(0, 3).forEach(m => {
          const awsInText = m.metadata?.text?.toLowerCase().includes('aws') ? '✅ AWS' : '❌ No AWS';
          console.log(`    - ${m.metadata?.source_file} | Score: ${m.score?.toFixed(3)} | ${awsInText}`);
          console.log(`      Section: ${m.metadata?.section}`);
          const preview = m.metadata?.text?.substring(0, 150) || '';
          console.log(`      "${preview}..."`);
        });
      }
      
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log('\n');
}

checkAMZN().catch(console.error);

