import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { embedText } from './lib/voyageClient.js';
import { SparseVectorizer } from '../src/lib/rag/sparseVectorizer.js';

dotenv.config({ path: '.env' });

// Directory where NVDA transcripts live
const TRANSCRIPTS_DIR = path.join(process.cwd(), 'data', 'transcripts', 'NVDA');
const sparseVectorizer = new SparseVectorizer();
const CHUNK_SIZE = 1000;

// -------------------
// 1) Read JSON file
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

// -------------------
// 2) Generic JSON Walker
// -------------------
function extractAllTextRecursively(obj, prefix = '', texts = []) {
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      extractAllTextRecursively(item, `${prefix}[${index}]`, texts);
    });
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        extractAllTextRecursively(value, prefix ? `${prefix}.${key}` : key, texts);
      } else {
        const stringValue = value === null ? 'null' : String(value);
        texts.push(`${prefix ? prefix + '.' + key : key}: ${stringValue}`);
      }
    }
  } else {
    texts.push(`${prefix}: ${obj}`);
  }
  return texts;
}

// -------------------
// 3) QA Extraction
// -------------------
function extractTextFromQA(content) {
  const texts = [];
  if (content.speakers) {
    for (const [speaker, data] of Object.entries(content.speakers)) {
      if (data.responses) {
        data.responses.forEach((response) => {
          const responseText = [
            `Speaker: ${speaker} (${data.role})`,
            `Topic: ${response.topic}`,
            `Context: ${response.context}`,
            `Response: ${response.content}`,
          ].join('\n');
          texts.push(responseText);
        });
      }
      if (data.closing_remarks) {
        texts.push(`Speaker: ${speaker} (${data.role})\nClosing Remarks: ${data.closing_remarks}`);
      }
    }
  }
  if (content.analyst_questions) {
    content.analyst_questions.forEach((qa) => {
      const questionText = [
        `Analyst: ${qa.analyst} (${qa.firm})`,
        `Topic: ${qa.topic}`,
        `Question: ${qa.question}`,
      ].join('\n');
      texts.push(questionText);
    });
  }
  return texts;
}

// -------------------
// 4) Earnings Extraction
// -------------------
function extractTextFromEarnings(content) {
  if (!content) return [];
  return extractAllTextRecursively(content, 'earnings');
}

// -------------------
// 5) Create Chunks
// -------------------
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
// 6) Process File
// -------------------
async function processFile(filePath) {
  const content = await readJsonFile(filePath);
  if (!content) return [];

  // Derive FY and Q from directory path
  const pathParts = filePath.split(path.sep);
  // e.g. ".../NVDA/FY_2024/Q1/parsed_earnings/NVDA_FY2024_Q1_earnings.json"
  const fiscalYearPart = pathParts.find((part) => part.startsWith('FY_')); // e.g. "FY_2024"
  const quarterPart = pathParts.find((part) => part.startsWith('Q'));     // e.g. "Q1"

  const fileType = filePath.includes('_qa.json') ? 'qa' : 'earnings';

  // Extract text differently for "qa" vs. "earnings"
  const textSections =
    fileType === 'qa'
      ? extractTextFromQA(content)
      : extractTextFromEarnings(content);

  console.log(`Extracted ${textSections.length} sections from ${filePath}`);
  const vectors = [];

  for (let sectionIndex = 0; sectionIndex < textSections.length; sectionIndex++) {
    const sectionText = textSections[sectionIndex];
    const chunks = createChunks(sectionText);
    console.log(`Created ${chunks.length} chunks from section ${sectionIndex + 1}`);

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      const embedding = await embedText(chunk);
      const sparseValues = sparseVectorizer.toSparseValues(chunk);

      // Build metadata
      const metadata = {
        text: chunk,
        company: 'NVDA', // Hardcode NVDA
        fiscalYear: fiscalYearPart?.replace('FY_', '') || '',
        quarter: quarterPart?.replace('Q', '') || '',
        type: fileType,
        section: sectionIndex,
        chunk_index: chunkIndex,
        source: path.basename(filePath),
      };

      vectors.push({
        id: `NVDA_${fiscalYearPart || ''}_${quarterPart || ''}_${fileType}_${sectionIndex}_${chunkIndex}`,
        values: embedding,
        ...(sparseValues ? { sparseValues } : {}),
        metadata,
      });
    }
  }

  return vectors;
}

// -------------------
// 7) Upsert to Pinecone
// -------------------
async function upsertVectors(index, vectors, batchSize = 100) {
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
    console.log(
      `Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`
    );
  }
}

// -------------------
// 8) Recursively find JSON
// -------------------
async function getJsonFiles(dirPath) {
  const files = await fs.readdir(dirPath);
  const jsonFiles = [];

  for (const file of files) {
    if (file.startsWith('.')) continue;
    const filePath = path.join(dirPath, file);
    const stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      // Recurse
      jsonFiles.push(...(await getJsonFiles(filePath)));
    } else if (file.endsWith('_earnings.json') || file.endsWith('_qa.json')) {
      // Only process "earnings" or "qa" files
      jsonFiles.push(filePath);
    }
  }

  return jsonFiles;
}

// -------------------
// 9) Main Script
// -------------------
async function createNVDATranscriptsEmbeddings() {
  try {
    // Connect to Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Use your existing index name
    const index = pinecone.index('clarity');

    // We only want to process "NVDA" transcripts
    console.log('Processing transcripts for NVDA only...');

    // Collect all JSON files from data/transcripts/NVDA
    const allJsonFiles = await getJsonFiles(TRANSCRIPTS_DIR);
    console.log(`Found ${allJsonFiles.length} NVDA transcript files total.`);

    let totalVectors = 0;

    // For each JSON file, process
    for (const filePath of allJsonFiles) {
      console.log(`\nProcessing file: ${filePath}`);
      const vectors = await processFile(filePath);

      if (vectors.length > 0) {
        await upsertVectors(index, vectors);
        totalVectors += vectors.length;
        console.log(`Created ${vectors.length} vectors from ${path.basename(filePath)}`);
      }
    }

    console.log(`\nAll done! Created ${totalVectors} vectors total for NVDA.`);
  } catch (error) {
    console.error('Error creating embeddings:', error);
    throw error;
  }
}

// Invoke main script
createNVDATranscriptsEmbeddings();
