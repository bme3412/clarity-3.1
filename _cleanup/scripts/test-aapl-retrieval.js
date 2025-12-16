import { Pinecone } from '@pinecone-database/pinecone';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// 1. Load Environment Variables
console.log('Current working directory:', process.cwd());
try {
  // Try standard dotenv first
  dotenv.config(); 
  dotenv.config({ path: '.env.local' });

  // Debug: Check what keys are loaded (obfuscated)
  const envPath = path.resolve(process.cwd(), '.env');
  console.log('Attempting to read .env from:', envPath);
  
  try {
      const envContent = await fs.readFile(envPath, 'utf8');
      const envConfig = dotenv.parse(envContent);
      console.log('Keys found in .env:', Object.keys(envConfig));
      
      for (const k in envConfig) {
        process.env[k] = envConfig[k];
      }
  } catch (readErr) {
      console.error('Failed to read .env file directly:', readErr.message);
  }

} catch (e) {
  console.error('Dotenv loading error:', e);
}

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const INDEX_NAME = 'clarity-openai';

if (!PINECONE_API_KEY || !OPENAI_API_KEY || !ANTHROPIC_API_KEY) {
  console.error('Error: Missing API keys.');
  console.error('Status:');
  console.error(`- PINECONE_API_KEY: ${PINECONE_API_KEY ? 'Present' : 'MISSING'}`);
  console.error(`- OPENAI_API_KEY: ${OPENAI_API_KEY ? 'Present' : 'MISSING'}`);
  console.error(`- ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY ? 'Present' : 'MISSING'}`);
  console.error('\nPlease check your .env file.');
  process.exit(1);
}

async function getEmbedding(text) {
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

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function main() {
  try {
    // 1. Setup Clients
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.index(INDEX_NAME);
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // 2. Define Query
    const query = "What did Tim Cook say about China performance and future outlook in Q1 2025?";
    console.log(`\nQuery: "${query}"\n`);

    // 3. Embed Query
    console.log('Generating embedding for query...');
    const queryEmbedding = await getEmbedding(query);

    // 4. Search Pinecone
    console.log('Searching Pinecone...');
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true
    });

    // 5. Construct Context
    console.log(`Found ${queryResponse.matches.length} matches.`);
    const context = queryResponse.matches
      .map(match => `[Source: ${match.metadata.source_file}]\n${match.metadata.text}`)
      .join('\n\n');

    console.log('\n--- Retrieved Context ---\n');
    console.log(context.substring(0, 500) + '... [truncated]');

    // 6. Generate Answer with Claude
    console.log('\n--- Generating Answer with Claude 3.5 Sonnet ---\n');
    
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929", // As seen in anthropicClient.js (seems to be a custom or future model ID)
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a financial analyst assistant. Use the following context to answer the question.
          
Context:
${context}

Question: ${query}

Answer:`
        }
      ]
    });

    console.log(msg.content[0].text);

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
