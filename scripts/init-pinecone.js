import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

// dotenv.config({ path: '.env' });
import fs from 'fs';
const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function initializePineconeIndex() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY environment variable is required');
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  try {
    console.log('Creating new Pinecone index...');
    
    await pinecone.createIndex({
      name: 'clarity-1024',
      dimension: 1024,  // dimensionality for voyage-3.5
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-west-2'
        }
      }
    });

    console.log('Index created successfully! Waiting for it to become ready...');
    
    // Wait for the index to be ready
    const index = pinecone.index('clarity-1024');
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 12; // 1 minute total waiting time

    while (!isReady && attempts < maxAttempts) {
      try {
        const description = await index.describe();
        if (description.status?.ready) {
          isReady = true;
          console.log('Index is ready!');
        } else {
          throw new Error('Index not ready yet');
        }
      } catch (error) {
        attempts++;
        console.log('Waiting for index to be ready... (attempt', attempts, 'of', maxAttempts, ')');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!isReady) {
      throw new Error('Timed out waiting for index to become ready');
    }

    console.log('You can now run the embeddings script.');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('Index already exists, ready to proceed with embeddings.');
      
      // Verify we can connect to the existing index
      const index = pinecone.index('clarity-1024');
      try {
        const description = await index.describe();
        console.log('Successfully connected to existing index.');
        console.log('Current index status:', description.status);
        console.log('Index configuration:', {
          dimension: description.dimension,
          metric: description.metric,
          host: description.host
        });
      } catch (statsError) {
        console.error('Error connecting to existing index:', statsError);
        throw statsError;
      }
    } else {
      console.error('Error initializing Pinecone index:', error);
      throw error;
    }
  }
}

initializePineconeIndex();