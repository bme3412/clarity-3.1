#!/usr/bin/env node
/**
 * Clarity 3.0 - Comprehensive Voyage Embedding Script
 * 
 * This script embeds ALL transcripts using:
 * - Voyage AI voyage-3.5 (1024 dimensions) - best-in-class retrieval
 * - BM25-style sparse vectors for keyword matching
 * - Optimized chunking with overlap for context preservation
 * - Rich metadata for filtering (ticker, fiscal_year, quarter, section)
 * 
 * Usage:
 *   node scripts/embed-all-voyage.js --status     Check current index status
 *   node scripts/embed-all-voyage.js TICKER       Embed single ticker
 *   node scripts/embed-all-voyage.js --all        Embed all tickers
 *   node scripts/embed-all-voyage.js --2025       Embed only FY2025 data
 */

import { Pinecone } from '@pinecone-database/pinecone';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import fsSync from 'fs';

// Load environment variables
try {
  const envConfig = dotenv.parse(fsSync.readFileSync('.env'));
  for (const k in envConfig) process.env[k] = envConfig[k];
} catch (e) {
  dotenv.config();
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'clarity-1024';

// Voyage 3.5 produces 1024-dim vectors optimized for retrieval
const VOYAGE_MODEL = 'voyage-3.5';
const VOYAGE_DIMENSIONS = 1024;

// Chunking configuration - optimized for earnings transcripts
const CHUNK_SIZE = 800;        // Smaller chunks = more precise retrieval
const CHUNK_OVERLAP = 150;     // Overlap preserves context across chunks
const MIN_CHUNK_LENGTH = 100;  // Skip tiny chunks
const BATCH_SIZE = 50;         // Pinecone upsert batch size

// Rate limiting
const VOYAGE_DELAY_MS = 80;    // ~12 requests/sec (well under 300/min limit)
const PINECONE_DELAY_MS = 100;

// All supported tickers
const ALL_TICKERS = ['AAPL', 'AMD', 'AMZN', 'AVGO', 'CRM', 'GOOGL', 'META', 'MSFT', 'NVDA', 'ORCL'];

// Financial domain stopwords for sparse vectors
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'into',
  'over', 'about', 'their', 'they', 'been', 'were', 'after', 'before', 'are',
  'was', 'has', 'had', 'its', 'our', 'what', 'how', 'can', 'you', 'your',
  'which', 'would', 'could', 'should', 'also', 'just', 'more', 'very', 'some',
  'year', 'quarter', 'said', 'says', 'like', 'going', 'think', 'really'
]);

if (!VOYAGE_API_KEY) {
  console.error('❌ VOYAGE_API_KEY is required');
  process.exit(1);
}
if (!PINECONE_API_KEY) {
  console.error('❌ PINECONE_API_KEY is required');
  process.exit(1);
}

// =============================================================================
// SPARSE VECTORIZER (BM25-style for hybrid search)
// =============================================================================

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
    const hash = crypto.createHash('md5').update(token).digest();
    return hash.readUInt32BE(0);
  }

  toSparseValues(text) {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return null;

    const counts = new Map();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    const indices = [];
    const values = [];
    for (const [token, count] of counts) {
      indices.push(this.tokenToIndex(token));
      // BM25-style TF weighting
      values.push(1 + Math.log(count));
    }

    return { indices, values };
  }
}

const sparseVectorizer = new SparseVectorizer();

// =============================================================================
// VOYAGE AI EMBEDDING
// =============================================================================

async function getVoyageEmbedding(text, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VOYAGE_API_KEY}`
        },
        body: JSON.stringify({
          input: [text],
          model: VOYAGE_MODEL,
          input_type: 'document'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429 && attempt < retries - 1) {
          console.log('  ⏳ Rate limited, waiting 15s...');
          await new Promise(r => setTimeout(r, 15000));
          continue;
        }
        throw new Error(`Voyage API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      console.log(`  ⚠️ Retry ${attempt + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// =============================================================================
// CHUNKING WITH OVERLAP
// =============================================================================

function createChunksWithOverlap(text, maxLength = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || typeof text !== 'string') return [];
  
  // Split by sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = '';
  let overlapBuffer = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk && currentChunk.length >= MIN_CHUNK_LENGTH) {
        chunks.push(currentChunk);
        // Keep last ~overlap chars for next chunk
        const words = currentChunk.split(' ');
        overlapBuffer = words.slice(-Math.floor(words.length * 0.2)).join(' ');
      }
      currentChunk = overlapBuffer + ' ' + sentence;
      currentChunk = currentChunk.trim();
    }
  }

  if (currentChunk && currentChunk.length >= MIN_CHUNK_LENGTH) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// =============================================================================
// FILE PROCESSING
// =============================================================================

async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

async function readTextFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function extractTextFromJson(data) {
  const sections = [];

  // Prepared remarks (CEO/CFO commentary)
  if (data.prepared_remarks) {
    const text = typeof data.prepared_remarks === 'string' 
      ? data.prepared_remarks 
      : JSON.stringify(data.prepared_remarks, null, 2);
    sections.push({ text, section: 'prepared_remarks', importance: 'high' });
  }

  // Q&A section (analyst questions and answers)
  if (data.qa_section) {
    const text = typeof data.qa_section === 'string'
      ? data.qa_section
      : JSON.stringify(data.qa_section, null, 2);
    sections.push({ text, section: 'qa', importance: 'high' });
  }

  // Earnings data
  if (data.earnings) {
    sections.push({ 
      text: JSON.stringify(data.earnings, null, 2), 
      section: 'earnings',
      importance: 'medium'
    });
  }

  // Financial segments
  if (data.financials?.composition) {
    for (const [segment, segmentData] of Object.entries(data.financials.composition)) {
      sections.push({
        text: `${segment} Segment Performance: ${JSON.stringify(segmentData, null, 2)}`,
        section: `segment_${segment.toLowerCase().replace(/\s+/g, '_')}`,
        importance: 'medium'
      });
    }
  }

  // Full fallback
  if (sections.length === 0) {
    sections.push({
      text: JSON.stringify(data, null, 2),
      section: 'full',
      importance: 'low'
    });
  }

  return sections;
}

function parseFileMetadata(filePath) {
  const fyMatch = filePath.match(/FY[_]?(\d{4})/i);
  const qMatch = filePath.match(/Q(\d)/i);
  
  return {
    fiscalYear: fyMatch ? fyMatch[1] : null,
    quarter: qMatch ? `Q${qMatch[1]}` : null
  };
}

async function getAllFiles(dir, extensions = ['.json', '.txt']) {
  const files = [];
  
  async function scan(d) {
    try {
      const entries = await fs.readdir(d, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(d, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }

  await scan(dir);
  return files;
}

// =============================================================================
// MAIN EMBEDDING LOGIC
// =============================================================================

async function processFile(filePath, ticker, index) {
  const { fiscalYear, quarter } = parseFileMetadata(filePath);
  const fileName = path.basename(filePath);
  const vectors = [];

  let sections = [];
  
  if (filePath.endsWith('.json')) {
    const data = await readJsonFile(filePath);
    if (!data) return vectors;
    sections = extractTextFromJson(data);
  } else if (filePath.endsWith('.txt')) {
    const text = await readTextFile(filePath);
    if (!text) return vectors;
    // Determine section type from filename
    const section = fileName.includes('transcript') ? 'transcript' :
                    fileName.includes('qa') ? 'qa' :
                    fileName.includes('press') ? 'press_release' : 'other';
    sections = [{ text, section, importance: 'high' }];
  }

  for (const { text, section, importance } of sections) {
    const chunks = createChunksWithOverlap(text);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.length < MIN_CHUNK_LENGTH) continue;

      try {
        // Get dense embedding from Voyage
        const denseVector = await getVoyageEmbedding(chunk);
        
        // Get sparse vector for keyword matching
        const sparseVector = sparseVectorizer.toSparseValues(chunk);
        
        const vectorData = {
          id: `${ticker}-${fiscalYear || 'unknown'}-${quarter || 'unknown'}-${section}-${i}`,
          values: denseVector,
          metadata: {
            ticker,
            company: ticker,
            company_ticker: ticker,  // Alternative field name for compatibility
            fiscal_year: fiscalYear,
            fiscalYear: fiscalYear,  // Both formats for query compatibility
            quarter,
            section,
            importance,
            source_file: fileName,
            text: chunk.substring(0, 8000),  // Pinecone metadata limit
            chunk_index: i,
            total_chunks: chunks.length,
            indexed_at: new Date().toISOString()
          }
        };

        // Add sparse vector if available
        if (sparseVector) {
          vectorData.sparseValues = sparseVector;
        }

        vectors.push(vectorData);
        
        // Rate limiting
        await new Promise(r => setTimeout(r, VOYAGE_DELAY_MS));
        
      } catch (error) {
        console.error(`    ⚠️ Error embedding chunk ${i}: ${error.message}`);
      }
    }
  }

  return vectors;
}

async function embedTicker(ticker, options = {}) {
  const { onlyYear, deleteExisting = false } = options;
  
  console.log(`\n🚀 Embedding ${ticker} with Voyage AI (${VOYAGE_MODEL})`);
  if (onlyYear) console.log(`   Filtering to FY${onlyYear} only`);
  
  const transcriptDir = path.join(process.cwd(), 'data', 'transcripts', ticker);
  
  try {
    await fs.access(transcriptDir);
  } catch {
    console.error(`❌ No transcript directory for ${ticker}`);
    return { ticker, success: false, vectors: 0 };
  }

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.index(PINECONE_INDEX);

  // Optionally delete existing vectors for this ticker
  if (deleteExisting) {
    console.log(`   🗑️ Deleting existing vectors for ${ticker}...`);
    try {
      await index.deleteMany({ ticker: { $eq: ticker } });
    } catch (e) {
      console.log(`   ⚠️ Could not delete existing vectors: ${e.message}`);
    }
  }

  // Get all transcript files
  let files = await getAllFiles(transcriptDir);
  
  // Filter by year if specified
  if (onlyYear) {
    files = files.filter(f => f.includes(`FY_${onlyYear}`) || f.includes(`FY${onlyYear}`));
  }

  console.log(`   📁 Found ${files.length} files to process\n`);

  let totalVectors = 0;
  
  for (const file of files) {
    const relativePath = path.relative(transcriptDir, file);
    process.stdout.write(`   📄 ${relativePath}...`);
    
    const vectors = await processFile(file, ticker, index);
    
    if (vectors.length > 0) {
      // Upsert in batches
      for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, i + BATCH_SIZE);
        await index.upsert(batch);
        await new Promise(r => setTimeout(r, PINECONE_DELAY_MS));
      }
      totalVectors += vectors.length;
      console.log(` ✅ ${vectors.length} vectors`);
    } else {
      console.log(' (skipped)');
    }
  }

  console.log(`\n   ✅ ${ticker} complete: ${totalVectors} vectors indexed`);
  return { ticker, success: true, vectors: totalVectors };
}

async function checkStatus() {
  console.log('\n📊 Clarity 3.0 - Embedding Status\n');
  console.log(`Index: ${PINECONE_INDEX}`);
  console.log(`Model: ${VOYAGE_MODEL} (${VOYAGE_DIMENSIONS} dims)`);
  console.log('─'.repeat(60));
  
  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.index(PINECONE_INDEX);

  try {
    const stats = await index.describeIndexStats();
    console.log(`\nTotal vectors in index: ${stats.totalRecordCount || 0}`);
  } catch (e) {
    console.log(`\n⚠️ Could not get index stats: ${e.message}`);
  }

  console.log('\n📈 Coverage by Ticker:\n');
  console.log('Ticker  | Local Files | FY2025 | Indexed | Action Needed');
  console.log('─'.repeat(60));

  for (const ticker of ALL_TICKERS) {
    const transcriptDir = path.join(process.cwd(), 'data', 'transcripts', ticker);
    
    try {
      const allFiles = await getAllFiles(transcriptDir);
      const fy2025Files = allFiles.filter(f => f.includes('FY_2025') || f.includes('FY2025'));
      
      // Check if indexed
      let indexedCount = 0;
      try {
        const queryResult = await index.query({
          vector: new Array(VOYAGE_DIMENSIONS).fill(0),
          topK: 1,
          filter: { ticker: { $eq: ticker } },
          includeMetadata: false
        });
        indexedCount = queryResult.matches?.length || 0;
      } catch (e) {
        // Query failed
      }

      const hasIndex = indexedCount > 0 ? '✅' : '❌';
      const has2025 = fy2025Files.length > 0 ? `${fy2025Files.length} files` : '—';
      const action = indexedCount === 0 ? 'EMBED' : 
                     fy2025Files.length > 0 ? 'Update 2025' : '—';
      
      console.log(`${ticker.padEnd(7)} | ${String(allFiles.length).padEnd(11)} | ${has2025.padEnd(8)} | ${hasIndex}      | ${action}`);
    } catch (error) {
      console.log(`${ticker.padEnd(7)} | Error: ${error.message}`);
    }
  }

  console.log('─'.repeat(60));
  console.log('\nCommands:');
  console.log('  node scripts/embed-all-voyage.js TICKER     Embed single ticker');
  console.log('  node scripts/embed-all-voyage.js --all      Embed all tickers');
  console.log('  node scripts/embed-all-voyage.js --2025     Embed only FY2025 data');
  console.log('  node scripts/embed-all-voyage.js --refresh  Delete & re-embed all\n');
}

async function embedAll(options = {}) {
  console.log('\n🚀 Embedding ALL tickers with Voyage AI\n');
  console.log(`Index: ${PINECONE_INDEX}`);
  console.log(`Model: ${VOYAGE_MODEL}`);
  if (options.onlyYear) console.log(`Filter: FY${options.onlyYear} only`);
  console.log('─'.repeat(50));
  
  const startTime = Date.now();
  const results = [];
  
  for (const ticker of ALL_TICKERS) {
    const result = await embedTicker(ticker, options);
    results.push(result);
    console.log('─'.repeat(50));
  }
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const totalVectors = results.reduce((sum, r) => sum + r.vectors, 0);
  
  console.log('\n✅ Complete!\n');
  console.log('Summary:');
  console.log('─'.repeat(40));
  results.forEach(r => console.log(`  ${r.ticker}: ${r.vectors} vectors ${r.success ? '✅' : '❌'}`));
  console.log('─'.repeat(40));
  console.log(`  Total: ${totalVectors} vectors in ${duration} min\n`);
}

// =============================================================================
// CLI
// =============================================================================

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
  console.log(`
📚 Clarity 3.0 - Voyage AI Embedding Script

Usage:
  node scripts/embed-all-voyage.js --status     Check index status
  node scripts/embed-all-voyage.js TICKER       Embed single ticker
  node scripts/embed-all-voyage.js --all        Embed all tickers  
  node scripts/embed-all-voyage.js --2025       Embed FY2025 data only
  node scripts/embed-all-voyage.js --refresh    Delete & re-embed all

Configuration:
  Index:  ${PINECONE_INDEX}
  Model:  ${VOYAGE_MODEL} (${VOYAGE_DIMENSIONS} dimensions)
  Chunk:  ${CHUNK_SIZE} chars with ${CHUNK_OVERLAP} overlap

Supported tickers: ${ALL_TICKERS.join(', ')}
`);
  process.exit(0);
}

if (args[0] === '--status') {
  await checkStatus();
} else if (args[0] === '--all') {
  await embedAll();
} else if (args[0] === '--2025') {
  await embedAll({ onlyYear: '2025' });
} else if (args[0] === '--refresh') {
  await embedAll({ deleteExisting: true });
} else {
  const ticker = args[0].toUpperCase();
  if (!ALL_TICKERS.includes(ticker)) {
    console.error(`❌ Unknown ticker: ${ticker}`);
    console.log(`Supported: ${ALL_TICKERS.join(', ')}`);
    process.exit(1);
  }
  await embedTicker(ticker, { deleteExisting: args.includes('--refresh') });
}
