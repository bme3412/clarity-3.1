import dotenv from 'dotenv';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
console.log('PINECONE_INDEX:', envConfig.PINECONE_INDEX);

