import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { SparseVectorizer } from '../src/lib/rag/sparseVectorizer.js';

// Attempt to load environment variables from .env file manually
// This is necessary because sometimes dotenv.config() doesn't pick up the file in certain environments/CWDs
try {
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = await fs.readFile(envPath, 'utf8');
  const envConfig = dotenv.parse(envContent);
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} catch (e) {
  // Fallback to standard dotenv loading if manual read fails
  dotenv.config();
  dotenv.config({ path: '.env.local' });
}

const TRANSCRIPTS_DIR = path.join(process.cwd(), 'data', 'transcripts', 'AVGO');
const CHUNK_SIZE = 1000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = 'clarity-openai';
const sparseVectorizer = new SparseVectorizer();

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY is not set in .env or environment');
  process.exit(1);
}

if (!PINECONE_API_KEY) {
  console.error('Error: PINECONE_API_KEY is not set in .env');
  process.exit(1);
}

// -------------------
// 1) OpenAI Embedding Helper
// -------------------
async function getEmbedding(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-small'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// -------------------
// 2) File Reading & Utils
// -------------------
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

function createChunks(text, maxLength = CHUNK_SIZE) {
  if (!text || typeof text !== 'string') return [];

  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// -------------------
// 3) Parsers
// -------------------

function extractAllTextRecursively(obj, prefix = '', texts = []) {
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      extractAllTextRecursively(item, `${prefix}[${index}]`, texts);
    });
  } else if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([key, value]) => {
      if (value !== null && typeof value === 'object') {
        extractAllTextRecursively(value, prefix ? `${prefix}.${key}` : key, texts);
      } else {
        const stringValue = value === null ? 'null' : String(value);
        const keyPath = prefix ? `${prefix}.${key}` : key;
        texts.push(`${keyPath}: ${stringValue}`);
      }
    });
  } else {
    texts.push(`${prefix}: ${obj}`);
  }
  return texts;
}

function extractTextFromQA(content) {
  const texts = [];

  if (content.speakers) {
    for (const [speakerId, data] of Object.entries(content.speakers)) {
      const speakerName = speakerId.replace(/_/g, ' ');
      if (data.responses) {
        data.responses.forEach((response) => {
          const text = [
            `Speaker: ${speakerName} (${data.role || 'Unknown Role'})`,
            `Topic: ${response.topic || 'General'}`,
            `Content: ${response.content}`
          ].join('\n');
          texts.push(text);
        });
      }
    }
  }

  if (content.analyst_questions) {
    content.analyst_questions.forEach((qa) => {
      if (qa.questions && Array.isArray(qa.questions)) {
        qa.questions.forEach((q) => {
          const text = [
            `Analyst: ${qa.analyst} (${qa.firm})`,
            `Topics: ${qa.topics ? qa.topics.join(', ') : 'General'}`,
            `Question: ${q}`
          ].join('\n');
          texts.push(text);
        });
      }
    });
  }

  return texts;
}

function extractTextFromNews(content) {
  const texts = [];
  if (content.documents && Array.isArray(content.documents)) {
    content.documents.forEach((doc) => {
      if (doc.embeddings_text) {
        texts.push(doc.embeddings_text);
      } else if (doc.summary) {
        texts.push(doc.summary);
      }
    });
  }
  return texts;
}

// -------------------
// 4) Main Processor
// -------------------

async function processFile(filePath) {
  const content = await readJsonFile(filePath);
  if (!content) return [];

  const fileName = path.basename(filePath);

  let textSections = [];
  let fileType = 'unknown';

  if (fileName.includes('news.json')) {
    fileType = 'news';
    textSections = extractTextFromNews(content);
  } else if (fileName.includes('_qa.json')) {
    fileType = 'qa';
    textSections = extractTextFromQA(content);
  } else if (fileName.includes('_earnings.json') || fileName.includes('transcript.txt')) {
    fileType = 'earnings';
    textSections = extractAllTextRecursively(content, 'earnings');
  } else {
    fileType = 'general';
    textSections = extractAllTextRecursively(content, 'content');
  }

  console.log(`Extracted ${textSections.length} sections from ${fileName} (${fileType})`);

  const pathParts = filePath.split(path.sep);
  const fyPart = pathParts.find(p => p.startsWith('FY_'));
  const qPart = pathParts.find(p => /^Q[1-4]$/.test(p));

  const vectors = [];

  for (let i = 0; i < textSections.length; i++) {
    const sectionText = textSections[i];
    const chunks = createChunks(sectionText);

    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j];
      try {
          const embedding = await getEmbedding(chunk);
          const sparseValues = sparseVectorizer.toSparseValues(chunk);

        const vectorId = `AVGO_${fyPart || 'FY_Unknown'}_${qPart || 'QX'}_${fileType}_${i}_${j}_${Date.now()}`;

        vectors.push({
          id: vectorId,
          values: embedding,
            ...(sparseValues ? { sparseValues } : {}),
          metadata: {
            text: chunk,
            company: 'AVGO',
            fiscal_year: fyPart?.replace('FY_', '') || 'Unknown',
            quarter: qPart || 'Unknown',
            file_type: fileType,
            source_file: fileName,
            chunk_index: j
          }
        });
      } catch (e) {
        console.error(`Failed to embed chunk ${j} of section ${i} in ${fileName}:`, e.message);
      }
    }
  }

  return vectors;
}

async function getJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getJsonFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function upsertVectors(index, vectors) {
  if (vectors.length === 0) return;

  const batchSize = 50;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
    console.log(`Upserted batch ${Math.floor(i/batchSize) + 1} / ${Math.ceil(vectors.length/batchSize)}`);
  }
}

async function main() {
  try {
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

    console.log(`Checking for index: ${INDEX_NAME}...`);
    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some(i => i.name === INDEX_NAME);

    if (!indexExists) {
      console.log(`Index ${INDEX_NAME} does not exist. Creating (dim: 1536, region: us-west-2)...`);
      await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: 1536,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-west-2'
          }
        }
      });
      console.log('Waiting 20s for index initialization...');
      await new Promise(resolve => setTimeout(resolve, 20000));
    } else {
      console.log(`Index ${INDEX_NAME} exists.`);
    }

    const index = pinecone.index(INDEX_NAME);

    console.log('Scanning for AVGO JSON files...');
    const files = await getJsonFiles(TRANSCRIPTS_DIR);
    console.log(`Found ${files.length} JSON files.`);

    for (const file of files) {
      console.log(`Processing ${file}...`);
      const vectors = await processFile(file);
      if (vectors.length > 0) {
        console.log(`Generated ${vectors.length} vectors. Upserting...`);
        await upsertVectors(index, vectors);
      } else {
        console.log('No vectors generated.');
      }
    }

    console.log('Done processing all AVGO files.');

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();

