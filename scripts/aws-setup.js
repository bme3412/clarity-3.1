import { 
    S3Client, 
    PutBucketCorsCommand,
    CreateBucketCommand,
    HeadBucketCommand,
    BucketAlreadyOwnedByYou,
    BucketAlreadyExists
  } from "@aws-sdk/client-s3";
  import dotenv from 'dotenv';
  
  dotenv.config();
  
  const requiredEnvVars = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_BUCKET_NAME'
  ];
  
  // Validate environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }
  
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });
  
  // Check if bucket exists
  async function checkBucketExists(bucketName) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
  
  // Create bucket if it doesn't exist
  async function createBucket(bucketName) {
    try {
      const bucketExists = await checkBucketExists(bucketName);
      
      if (!bucketExists) {
        await s3Client.send(new CreateBucketCommand({
          Bucket: bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: process.env.AWS_REGION
          }
        }));
        console.log(`Created bucket: ${bucketName}`);
      } else {
        console.log(`Bucket ${bucketName} already exists`);
      }
    } catch (error) {
      if (
        error instanceof BucketAlreadyOwnedByYou ||
        error instanceof BucketAlreadyExists
      ) {
        console.log(`Bucket ${bucketName} already exists and is owned by you`);
      } else {
        throw error;
      }
    }
  }
  
  // Configure CORS for the bucket
  async function configureCORS(bucketName) {
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "PUT", "POST"],
            AllowedOrigins: ["*"],  // Restrict this in production
            ExposeHeaders: []
          }
        ]
      }
    }));
    console.log('CORS configuration completed successfully');
  }
  
  // Main setup function
  async function setupAWS() {
    try {
      console.log('Starting AWS setup...');
      console.log(`Using region: ${process.env.AWS_REGION}`);
      console.log(`Target bucket: ${process.env.AWS_BUCKET_NAME}`);
  
      // Create or verify bucket
      await createBucket(process.env.AWS_BUCKET_NAME);
      
      // Configure CORS
      await configureCORS(process.env.AWS_BUCKET_NAME);
  
      console.log('\nAWS setup completed successfully! 🎉');
    } catch (error) {
      console.error('\nError during AWS setup:', error);
      process.exit(1);
    }
  }
  
  setupAWS();