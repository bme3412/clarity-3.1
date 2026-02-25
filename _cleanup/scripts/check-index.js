import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function checkIndex() {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  try {
    const description = await pinecone.describeIndex('clarity-1024');
    console.log('Index status:', description.status);
    
    const index = pinecone.index('clarity-1024');
    const stats = await index.describeIndexStats();
    console.log('Index stats:', stats);

    if (description.status?.ready) {
      console.log('✅ Index clarity-1024 is READY!');
    } else {
      console.log('❌ Index clarity-1024 is NOT ready yet.');
    }
  } catch (error) {
    console.error('Error checking index:', error.message);
  }
}

checkIndex();

