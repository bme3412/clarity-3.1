import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from "@langchain/pinecone";
import { Embeddings } from 'langchain/embeddings/base';
import dotenv from 'dotenv';
import { requestEmbeddings } from './lib/voyageClient.js';

dotenv.config();

const requiredEnvVars = [
  'PINECONE_API_KEY',
  'PINECONE_INDEX',
  'VOYAGE_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

async function initializeVectorStore() {
  console.log('Starting vector store initialization...');
  
  try {
    // Initialize Pinecone client
    console.log('Connecting to Pinecone...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });

    // Get the index
    console.log('Accessing Pinecone index...');
    const index = pinecone.index(process.env.PINECONE_INDEX);
    
    // Initialize Voyage embeddings adapter
    console.log('Initializing Voyage embeddings...');
    class VoyageEmbeddings extends Embeddings {
      constructor({ model = 'voyage-3.5', inputType = 'document' } = {}) {
        super();
        this.model = model;
        this.inputType = inputType;
      }

      async embedDocuments(texts) {
        return requestEmbeddings(texts, {
          model: this.model,
          inputType: this.inputType,
        });
      }

      async embedQuery(text) {
        const embeddings = await requestEmbeddings([text], {
          model: this.model,
          inputType: 'query',
        });
        return embeddings[0];
      }
    }

    const embeddings = new VoyageEmbeddings();

    // Create PineconeStore instance
    console.log('Setting up Pinecone store...');
    const vectorStore = await PineconeStore.fromExistingIndex(
      embeddings,
      { 
        pineconeIndex: index,
        namespace: 'resume-content'
      }
    );

    console.log('Vector store initialized successfully!');
    return vectorStore;
  } catch (error) {
    console.error('Error initializing vector store:', error);
    throw error;
  }
}

initializeVectorStore().catch(error => {
  console.error('Failed to initialize vector store:', error);
  process.exit(1);
});