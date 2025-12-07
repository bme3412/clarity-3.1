// src/utils/dataProcessor.js
import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { embedText } from '../src/app/lib/llm/voyageClient.js';
import fs from 'fs/promises';
import path from 'path';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
});


export async function processNvidiaFiles() {
  const index = pinecone.Index(process.env.PINECONE_INDEX);
  const baseDir = path.join(process.cwd(), 'data/transcripts/NVDA');
  
  // Recursive function to process all JSON files
  async function processDirectory(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else if (entry.name.endsWith('.json')) {
        // Read and process JSON file
        const content = await fs.readFile(fullPath, 'utf-8');
        const data = JSON.parse(content);
        
        // Split text into chunks
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
        });
        
        const docs = await splitter.createDocuments([JSON.stringify(data)]);
        
        // Create embeddings and upsert to Pinecone
        for (const doc of docs) {
        const vector = await embedText(doc.pageContent, {
          model: 'voyage-3.5',
          inputType: 'document',
        });
          
          await index.upsert([{
            id: `${entry.name}-${Math.random().toString(36).substring(7)}`,
            values: vector,
            metadata: {
              text: doc.pageContent,
              source: fullPath,
              quarter: path.basename(path.dirname(fullPath)),
              fiscalYear: path.basename(path.dirname(path.dirname(fullPath))),
            },
          }]);
        }
      }
    }
  }
  
  await processDirectory(baseDir);
}