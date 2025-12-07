/**
 * Storage utilities for S3 and Pinecone
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Pinecone } from '@pinecone-database/pinecone';
import { embedText } from '../llm/voyageClient.js';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export async function fetchQuarterlyData(quarter, year) {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `quarterly/${year}/${quarter}/data.json`
    });
    
    const response = await s3Client.send(command);
    const data = await response.Body.transformToString();
    return JSON.parse(data);
  } catch (error) {
    console.error('Error fetching quarterly data:', error);
    throw new Error('Failed to fetch quarterly data');
  }
}

export async function storeQuarterlyData(data, quarter, year) {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `quarterly/${year}/${quarter}/data.json`,
      Body: JSON.stringify(data),
      ContentType: 'application/json'
    });
    
    await s3Client.send(command);
  } catch (error) {
    console.error('Error storing quarterly data:', error);
    throw new Error('Failed to store quarterly data');
  }
}

export async function searchSimilarQueries(query, topK = 5) {
  try {
    const index = pinecone.index('financial-queries');
    
    const queryResponse = await index.query({
      vector: await generateQueryEmbedding(query),
      topK,
      includeMetadata: true
    });

    return queryResponse.matches.map(match => ({
        query: match.metadata.query,
        response: match.metadata.response,
        score: match.score
      }));
    } catch (error) {
      console.error('Error searching similar queries:', error);
      return [];
    }
  }
  
  async function generateQueryEmbedding(query) {
    return embedText(query, {
      model: 'voyage-3.5',
      inputType: 'query',
    });
  }
  
  export async function storeQueryResponse(query, response) {
    try {
      const index = pinecone.index('financial-queries');
      const embedding = await generateQueryEmbedding(query);
      
      await index.upsert([{
        id: `query_${Date.now()}`,
        values: embedding,
        metadata: {
          query,
          response: JSON.stringify(response),
          timestamp: new Date().toISOString()
        }
      }]);
    } catch (error) {
      console.error('Error storing query response:', error);
    }
  }