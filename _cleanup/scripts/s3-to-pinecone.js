const { Pinecone } = require('@pinecone-database/pinecone');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY is required for embeddings.');
}

const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings';

// Initialize clients
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// Initialize Pinecone client
const initPinecone = async () => {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    return pinecone;
  } catch (error) {
    console.error('Error initializing Pinecone:', error);
    throw error;
  }
};

// Get embedding from Cohere
async function getEmbedding(text) {
  try {
    const response = await fetch(VOYAGE_EMBED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'voyage-3.5',
        input: [text],
        input_type: 'document',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Voyage embedding failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    return payload.data?.[0]?.embedding || [];
  } catch (error) {
    console.error('Error getting embedding:', error);
    throw error;
  }
}

// Single vector upsert
async function upsertSingleVector(index, vector) {
  try {
    await index.upsert([{
      id: vector.id,
      values: vector.values,
      metadata: vector.metadata
    }]);
    console.log(`Successfully upserted vector ${vector.id}`);
    return true;
  } catch (error) {
    console.error(`Failed to upsert vector ${vector.id}:`, error);
    return false;
  }
}

// Process content and extract metadata
function processContent(content, key) {
  const keyParts = key.split('/');
  const fileName = keyParts[keyParts.length - 1];
  
  const metadata = {
    source: fileName,
    type: key.includes('_earnings.json') ? 'earnings' : 'qa',
    fiscal_year: fileName.match(/FY(\d{4})/)?.[1],
    quarter: fileName.match(/Q(\d)/)?.[1],
    s3_path: key
  };

  const textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  return { text: textContent, metadata };
}

// Main function to process S3 files and upload to Pinecone
async function uploadS3ToPinecone() {
  try {
    console.log('Initializing Pinecone client...');
    const pinecone = await initPinecone();
    const index = pinecone.index('clarity');

    // Get list of files from S3
    console.log('Fetching file list from S3...');
    const files = await listS3Files();
    console.log(`Found ${files.length} files to process`);

    let successCount = 0;
    let failedCount = 0;

    for (const file of files) {
      try {
        console.log(`\nProcessing ${file.Key}`);
        
        // Get and parse file content
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: file.Key
        });
        
        const response = await s3Client.send(command);
        const content = await response.Body.transformToString();
        const { text, metadata } = processContent(JSON.parse(content), file.Key);
        
        // Get embedding
        const embedding = await getEmbedding(text);

        // Create vector object
        const vector = {
          id: `nvda_${metadata.fiscal_year || 'unknown'}_q${metadata.quarter || 'unknown'}_${metadata.type}_${Date.now()}`,
          values: embedding,
          metadata
        };

        // Upload single vector
        const success = await upsertSingleVector(index, vector);
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }

        // Add delay between uploads
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error processing file ${file.Key}:`, error);
        failedCount++;
      }
    }

    console.log('\nUpload Summary:');
    console.log(`Successfully processed: ${successCount} files`);
    console.log(`Failed: ${failedCount} files`);
    console.log('Total files: ', files.length);

  } catch (error) {
    console.error('Fatal error in upload process:', error);
    throw error;
  }
}

// List all NVDA files in S3 bucket
async function listS3Files() {
  const files = [];
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_BUCKET_NAME,
      Prefix: 'earnings/NVDA/',
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    
    if (response.Contents) {
      files.push(...response.Contents.filter(item => 
        item.Key.endsWith('.json')
      ));
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

// Execute the script
uploadS3ToPinecone().then(() => {
  console.log('Process completed successfully!');
}).catch(error => {
  console.error('Process failed:', error);
  process.exit(1);
});