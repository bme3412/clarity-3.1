#!/usr/bin/env node
/**
 * Voyage-only embedding script for a single ticker into a 1024-d Pinecone index.
 * Defaults to PINECONE_INDEX=clarity-1024 and uses voyage-3.5 query embeddings.
 *
 * Usage:
 *   node scripts/embed-voyage-ticker.js GOOGL
 */

import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import fsSync from 'fs';
import { embedText } from './lib/voyageClient.js';
import { SparseVectorizer } from '../src/lib/rag/sparseVectorizer.js';

// Load env
try {
  const envConfig = dotenv.parse(fsSync.readFileSync('.env'));
  for (const k in envConfig) process.env[k] = envConfig[k];
} catch (e) {
  dotenv.config();
}

const PINECONE_INDEX = process.env.PINECONE_INDEX || 'clarity-1024';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const CHUNK_SIZE = 1000;
const BATCH_SIZE = 50;

if (!PINECONE_API_KEY) {
  console.error('PINECONE_API_KEY missing');
  process.exit(1);
}
if (!VOYAGE_API_KEY) {
  console.error('VOYAGE_API_KEY missing');
  process.exit(1);
}

const sparseVectorizer = new SparseVectorizer();

function chunkText(text, maxLen = CHUNK_SIZE) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length <= maxLen) {
      current += (current ? ' ' : '') + s;
    } else {
      if (current) chunks.push(current);
      current = s;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`  Error reading ${filePath}: ${err.message}`);
    return null;
  }
}

async function collectJsonFiles(dir) {
  const files = [];
  async function walk(d) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith('.json')) {
        files.push(full);
      }
    }
  }
  await walk(dir);
  return files;
}

function parseMeta(filePath) {
  const fyMatch = filePath.match(/FY[_]?(\d{4})/i);
  const qMatch = filePath.match(/Q(\d)/i);
  return {
    fiscal_year: fyMatch ? fyMatch[1] : null,
    quarter: qMatch ? `Q${qMatch[1]}` : null
  };
}

async function embedTicker(ticker) {
  const transcriptDir = path.join(process.cwd(), 'data', 'transcripts', ticker);
  try {
    await fs.access(transcriptDir);
  } catch {
    console.error(`No transcript dir for ${ticker}`);
    return;
  }

  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pinecone.index(PINECONE_INDEX);

  const files = await collectJsonFiles(transcriptDir);
  console.log(`Embedding ${ticker} into ${PINECONE_INDEX} with Voyage (files=${files.length})`);

  let totalVectors = 0;
  for (const file of files) {
    const data = await readJson(file);
    if (!data) continue;

    const text = JSON.stringify(data);
    const chunks = chunkText(text);
    const { fiscal_year, quarter } = parseMeta(file);

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.length < 50) continue;
      const dense = await embedText(chunk, { model: 'voyage-3.5', inputType: 'document' });
      const sparse = sparseVectorizer.toSparseValues(chunk);
      vectors.push({
        id: `${ticker}-${path.basename(file, '.json')}-${i}`,
        values: dense,
        metadata: {
          ticker,
          company: ticker,
          text: chunk.substring(0, 8000),
          source_file: path.basename(file),
          fiscal_year,
          quarter,
          chunk_index: i,
          total_chunks: chunks.length
        },
        ...(sparse ? { sparseValues: sparse } : {})
      });
      // gentle pacing
      await new Promise(r => setTimeout(r, 50));
    }

    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await index.upsert(batch);
    }
    totalVectors += vectors.length;
    console.log(`  ${path.basename(file)} → ${vectors.length} vectors`);
  }

  console.log(`Done. Upserted ${totalVectors} vectors for ${ticker}.`);
}

const argTicker = process.argv[2];
if (!argTicker) {
  console.error('Usage: node scripts/embed-voyage-ticker.js TICKER');
  process.exit(1);
}
embedTicker(argTicker.toUpperCase()).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
