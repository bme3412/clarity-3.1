// scripts/test-connections.js
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testConnections() {
  console.log('Testing connections...\n');

  try {
    // Test AWS Connection
    /*
    console.log('Testing AWS connection...');
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    });
    const buckets = await s3Client.send(new ListBucketsCommand({}));
    console.log('✅ AWS Connection successful!');
    console.log('Available buckets:', buckets.Buckets.map(b => b.Name).join(', '));
    */

    // Test Pinecone Connection
    /*
    console.log('\nTesting Pinecone connection...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    
    const indexes = await pinecone.listIndexes();
    console.log('✅ Pinecone Connection successful!');
    console.log('Available indexes:', Object.keys(indexes).join(', '));
    */

    // Test Anthropic Connection
    console.log('\nTesting Anthropic Claude connection...');
    const anthropicResp = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!anthropicResp.ok) {
      throw new Error(`Anthropic connection failed (${anthropicResp.status})`);
    }
    const anthropicModels = await anthropicResp.json();
    console.log('✅ Anthropic Connection successful!');
    console.log('Available Claude models:', anthropicModels.models?.map((m) => m.id).slice(0, 5).join(', ') || 'n/a');

    // Test Voyage embeddings Connection
    console.log('\nTesting Voyage embeddings connection...');
    const voyageResp = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'voyage-3.5',
        input: ['connectivity test'],
        input_type: 'query',
      }),
    });
    if (!voyageResp.ok) {
      throw new Error(`Voyage embedding connection failed (${voyageResp.status})`);
    }
    const voyageBody = await voyageResp.json();
    console.log('✅ Voyage Connection successful!');
    console.log('Voyage embedding response size:', voyageBody.data?.length || 0);

    console.log('\nAll connections tested successfully! 🎉');
  } catch (error) {
    console.error('Error during connection test:', error);
  }
}

testConnections();