#!/usr/bin/env node
/**
 * Hybrid Embedding Script - Dense + Sparse Vectors
 * 
 * Usage:
 *   node scripts/embed-hybrid.js NVDA
 *   node scripts/embed-hybrid.js --all
 *   node scripts/embed-hybrid.js --status
 * 
 * This script embeds all transcript files with BOTH:
 * - Dense vectors (OpenAI text-embedding-3-small)
 * - Sparse vectors (BM25-style for keyword matching)
 * 
 * Target index: clarity-hybrid (dotproduct metric)
 */

import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
try {
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = await fs.readFile(envPath, 'utf8');
  const envConfig = dotenv.parse(envContent);
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} catch (e) {
  dotenv.config();
  dotenv.config({ path: '.env.local' });
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = 'clarity-hybrid'; // New hybrid index
const CHUNK_SIZE = 1000;
const BATCH_SIZE = 50;
const SPARSE_DIMENSION = 30000; // Hash space for sparse vectors

// All supported tickers
const ALL_TICKERS = ['AAPL', 'AMD', 'AMZN', 'AVGO', 'CRM', 'GOOGL', 'META', 'MSFT', 'NVDA', 'ORCL'];

// Financial domain stopwords
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'into',
  'over', 'about', 'their', 'they', 'been', 'were', 'after', 'before', 'are',
  'was', 'has', 'had', 'its', 'our', 'what', 'how', 'can', 'you', 'your',
  'which', 'would', 'could', 'should', 'also', 'just', 'more', 'very', 'some'
]);

if (!OPENAI_API_KEY || !PINECONE_API_KEY) {
  console.error('Error: OPENAI_API_KEY and PINECONE_API_KEY must be set in .env');
  process.exit(1);
}

// -------------------
// Sparse Vectorizer (BM25-style)
// -------------------
class SparseVectorizer {
  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9%$\.]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter(token => token.length > 2 && !STOPWORDS.has(token));
  }

  tokenToIndex(token) {
    // Hash token to a consistent index in sparse dimension space
    const hash = crypto.createHash('md5').update(token).digest();
    return hash.readUInt32BE(0) % SPARSE_DIMENSION;
  }

  toSparseValues(text) {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return null;

    // Count term frequencies
    const counts = new Map();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    // Convert to sparse vector format
    const indexValueMap = new Map();
    for (const [token, count] of counts) {
      const idx = this.tokenToIndex(token);
      // BM25-style TF weighting: 1 + log(count)
      const value = 1 + Math.log(count);
      // Aggregate if hash collision
      indexValueMap.set(idx, (indexValueMap.get(idx) || 0) + value);
    }

    // Sort by index (Pinecone requires sorted indices)
    const sortedEntries = [...indexValueMap.entries()].sort((a, b) => a[0] - b[0]);
    
    return {
      indices: sortedEntries.map(e => e[0]),
      values: sortedEntries.map(e => e[1])
    };
  }
}

const sparseVectorizer = new SparseVectorizer();

// -------------------
// OpenAI Dense Embedding
// -------------------
async function getDenseEmbedding(text, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
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
        if (response.status === 429 && attempt < retries - 1) {
          console.log('  Rate limited, waiting 10s...');
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      console.log(`  Retry ${attempt + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// -------------------
// File Processing
// -------------------
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`  Error reading ${filePath}:`, error.message);
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

function extractTextFromJson(data, filePath) {
  const texts = [];

  if (data.prepared_remarks) {
    texts.push({
      text: typeof data.prepared_remarks === 'string' 
        ? data.prepared_remarks 
        : JSON.stringify(data.prepared_remarks),
      section: 'prepared_remarks'
    });
  }

  if (data.qa_section) {
    texts.push({
      text: typeof data.qa_section === 'string'
        ? data.qa_section
        : JSON.stringify(data.qa_section),
      section: 'qa'
    });
  }

  // Handle "earnings" structure (used by some tickers)
  if (data.earnings && typeof data.earnings === 'object') {
    texts.push({
      text: JSON.stringify(data.earnings, null, 2),
      section: 'earnings'
    });
  }

  // Handle "financials" structure (used by AMZN and others)
  if (data.financials && typeof data.financials === 'object') {
    // Extract key segments for better searchability
    const financials = data.financials;
    
    // Add total revenue context
    if (financials.total_revenue) {
      texts.push({
        text: `Total Revenue: ${JSON.stringify(financials.total_revenue, null, 2)}`,
        section: 'financials_revenue'
      });
    }
    
    // Add each business segment separately for better retrieval
    if (financials.composition) {
      for (const [segment, segmentData] of Object.entries(financials.composition)) {
        texts.push({
          text: `${segment} Segment: ${JSON.stringify(segmentData, null, 2)}`,
          section: `financials_${segment.toLowerCase()}`
        });
      }
    }
    
    // Also add full financials as fallback
    texts.push({
      text: JSON.stringify(financials, null, 2),
      section: 'financials_full'
    });
  }

  // Handle segments/segment_performance (another common structure)
  if (data.segments && Array.isArray(data.segments)) {
    data.segments.forEach((segment, i) => {
      texts.push({
        text: `${segment.name || `Segment ${i+1}`}: ${JSON.stringify(segment, null, 2)}`,
        section: `segment_${segment.name?.toLowerCase() || i}`
      });
    });
  }

  if (texts.length === 0) {
    texts.push({
      text: JSON.stringify(data, null, 2),
      section: 'full'
    });
  }

  return texts;
}

function parseFileMetadata(filePath, ticker) {
  const fileName = path.basename(filePath);
  const dirPath = path.dirname(filePath);
  
  let fiscalYear = null;
  let quarter = null;

  const fyMatch = dirPath.match(/FY[_]?(\d{4})/i) || fileName.match(/FY[_]?(\d{4})/i);
  const qMatch = dirPath.match(/Q(\d)/i) || fileName.match(/Q(\d)/i);

  if (fyMatch) fiscalYear = fyMatch[1];
  if (qMatch) quarter = `Q${qMatch[1]}`;

  return { fiscalYear, quarter };
}

async function getJsonFiles(dirPath) {
  const files = [];
  
  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.endsWith('.json')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`  Error scanning ${dir}:`, error.message);
    }
  }

  await scanDir(dirPath);
  return files;
}

async function processFile(filePath, ticker) {
  const data = await readJsonFile(filePath);
  if (!data) return [];

  const vectors = [];
  const { fiscalYear, quarter } = parseFileMetadata(filePath, ticker);
  const textSections = extractTextFromJson(data, filePath);

  for (const { text, section } of textSections) {
    const chunks = createChunks(text);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.length < 50) continue;

      try {
        // Get BOTH dense and sparse embeddings
        const denseVector = await getDenseEmbedding(chunk);
        const sparseVector = sparseVectorizer.toSparseValues(chunk);
        
        const vectorData = {
          id: `${ticker}-${path.basename(filePath, '.json')}-${section}-${i}`,
          values: denseVector,
          metadata: {
            ticker,
            company: ticker,
            text: chunk.substring(0, 8000),
            source_file: path.basename(filePath),
            section,
            fiscal_year: fiscalYear,
            quarter,
            chunk_index: i,
            total_chunks: chunks.length
          }
        };

        // Add sparse vector if available
        if (sparseVector) {
          vectorData.sparseValues = sparseVector;
        }

        vectors.push(vectorData);

        // Rate limiting
        await new Promise(r => setTimeout(r, 100));
      } catch (error) {
        console.error(`  Error embedding chunk ${i} from ${path.basename(filePath)}:`, error.message);
      }
    }
  }

  return vectors;
}

async function upsertVectors(index, vectors) {
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await index.upsert(batch);
    console.log(`  Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(vectors.length / BATCH_SIZE)}`);
  }
}

// -------------------
// Status Check
// -------------------
async function checkStatus() {
  console.log('\n📊 Hybrid Embedding Status Check\n');
  
  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  
  // Check both indexes
  console.log('Index Comparison:');
  console.log('─'.repeat(60));
  
  for (const idxName of ['clarity-openai', 'clarity-hybrid']) {
    try {
      const index = pinecone.index(idxName);
      const stats = await index.describeIndexStats();
      console.log(`\n📌 ${idxName}: ${stats.totalRecordCount || 0} vectors`);
    } catch (e) {
      console.log(`\n📌 ${idxName}: Not found or error`);
    }
  }
  
  console.log('\n' + '─'.repeat(60));
  
  const index = pinecone.index(INDEX_NAME);
  
  console.log('\nTicker Coverage in clarity-hybrid:');
  console.log('─'.repeat(50));
  
  for (const ticker of ALL_TICKERS) {
    const transcriptDir = path.join(process.cwd(), 'data', 'transcripts', ticker);
    
    try {
      const files = await getJsonFiles(transcriptDir);
      
      const queryResult = await index.query({
        vector: new Array(1536).fill(0),
        topK: 1,
        filter: { ticker: { $eq: ticker } },
        includeMetadata: false
      });
      
      const hasVectors = queryResult.matches && queryResult.matches.length > 0;
      const status = hasVectors ? '✅' : '❌';
      
      console.log(`${status} ${ticker.padEnd(6)} | ${files.length} files | ${hasVectors ? 'Embedded' : 'Not embedded'}`);
    } catch (error) {
      console.log(`❓ ${ticker.padEnd(6)} | Error: ${error.message}`);
    }
  }
  
  console.log('─'.repeat(50));
  console.log('\nTo embed a ticker: node scripts/embed-hybrid.js TICKER');
  console.log('To embed all:      node scripts/embed-hybrid.js --all\n');
}

// -------------------
// Main Embedding Logic
// -------------------
async function embedTicker(ticker) {
  console.log(`\n🚀 Embedding ${ticker} (hybrid: dense + sparse)...\n`);
  
  const transcriptDir = path.join(process.cwd(), 'data', 'transcripts', ticker);
  
  try {
    await fs.access(transcriptDir);
  } catch {
    console.error(`❌ No transcript directory found for ${ticker}`);
    return false;
  }

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.index(INDEX_NAME);

  const files = await getJsonFiles(transcriptDir);
  console.log(`Found ${files.length} JSON files for ${ticker}\n`);

  let totalVectors = 0;
  
  for (const file of files) {
    const relativePath = path.relative(transcriptDir, file);
    process.stdout.write(`Processing ${relativePath}...`);
    
    const vectors = await processFile(file, ticker);
    
    if (vectors.length > 0) {
      await upsertVectors(index, vectors);
      totalVectors += vectors.length;
      console.log(` ${vectors.length} vectors (dense+sparse)`);
    } else {
      console.log(' (no vectors)');
    }
  }

  console.log(`\n✅ Done! Created ${totalVectors} hybrid vectors for ${ticker}\n`);
  return true;
}

async function embedAll() {
  console.log('\n🚀 Embedding ALL tickers with hybrid vectors...\n');
  console.log('Target index: clarity-hybrid (dotproduct metric)');
  console.log('Vector types: Dense (OpenAI) + Sparse (BM25)\n');
  
  const startTime = Date.now();
  const results = [];
  
  for (const ticker of ALL_TICKERS) {
    const tickerStart = Date.now();
    await embedTicker(ticker);
    results.push({
      ticker,
      duration: ((Date.now() - tickerStart) / 1000 / 60).toFixed(1)
    });
    console.log('─'.repeat(50));
  }
  
  const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n✅ All tickers embedded with hybrid vectors!\n');
  console.log('Summary:');
  console.log('─'.repeat(40));
  results.forEach(r => console.log(`  ${r.ticker}: ${r.duration} min`));
  console.log('─'.repeat(40));
  console.log(`  Total: ${totalDuration} min\n`);
}

// -------------------
// CLI Entry Point
// -------------------
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  console.log(`
📚 Hybrid Embedding Script (Dense + Sparse Vectors)

Usage:
  node scripts/embed-hybrid.js TICKER     Embed a single ticker
  node scripts/embed-hybrid.js --all      Embed all tickers
  node scripts/embed-hybrid.js --status   Check embedding status

Target index: ${INDEX_NAME} (dotproduct metric for hybrid search)

This creates vectors with BOTH:
  • Dense: OpenAI text-embedding-3-small (1536 dims)
  • Sparse: BM25-style term frequency (for exact keyword matching)

Supported tickers: ${ALL_TICKERS.join(', ')}
`);
  process.exit(0);
}

if (args[0] === '--status') {
  await checkStatus();
} else if (args[0] === '--all') {
  await embedAll();
} else {
  const ticker = args[0].toUpperCase();
  if (!ALL_TICKERS.includes(ticker)) {
    console.error(`❌ Unknown ticker: ${ticker}`);
    console.log(`Supported: ${ALL_TICKERS.join(', ')}`);
    process.exit(1);
  }
  await embedTicker(ticker);
}

