// scripts/upload-to-s3.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { readFile } = require('fs/promises');
const { glob } = require('glob');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function uploadToS3() {
  try {
    // Find all NVDA JSON files in parsed_earnings directories
    const files = await glob('**/parsed_earnings/**/NVDA*.json', {
      ignore: ['node_modules/**']
    });

    if (files.length === 0) {
      console.log('No NVDA files found');
      return;
    }

    console.log(`Found ${files.length} NVDA files to upload`);
    let successCount = 0;
    let errorCount = 0;

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf8');
        const fileName = filePath.split('/').pop();
        
        // Extract metadata from file path
        const fiscalYear = filePath.match(/FY(\d{4})/)?.[1];
        const quarter = filePath.match(/Q(\d)/)?.[1];
        const type = filePath.includes('_earnings.json') ? 'earnings' : 'qa';
        
        if (!fiscalYear || !quarter) {
          console.warn(`⚠️ Skipping ${fileName} - couldn't extract metadata`);
          continue;
        }

        // Create S3 key with organized structure
        const s3Key = `earnings/NVDA/${fiscalYear}/Q${quarter}/${type}/${fileName}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: 'financial-copilot',
          Key: s3Key,
          Body: content,
          ContentType: 'application/json',
          Metadata: {
            company: 'NVDA',
            fiscalYear,
            quarter,
            type
          }
        }));

        console.log(`✅ Uploaded ${fileName} to s3://financial-copilot/${s3Key}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error uploading ${filePath}:`, error);
        errorCount++;
      }
    }

    console.log('\nUpload Summary:');
    console.log(`Successfully uploaded: ${successCount} files`);
    console.log(`Failed uploads: ${errorCount} files`);
  } catch (error) {
    console.error('Error in upload process:', error);
  }
}

uploadToS3();