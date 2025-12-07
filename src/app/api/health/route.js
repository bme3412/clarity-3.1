import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { embedText } from '../../lib/llm/voyageClient';

const INDEX_NAME = process.env.PINECONE_INDEX || 'clarity-1024';

export async function GET() {
  if (!process.env.PINECONE_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        status: 'error',
        index: INDEX_NAME,
        error: 'PINECONE_API_KEY missing',
        env: {
          pineconeKey: false,
          voyageKey: !!process.env.VOYAGE_API_KEY
        }
      },
      { status: 500 }
    );
  }

  let totalVectors = null;
  let dimension = null;
  let status = 'unknown';
  let error = null;
  let testQuery = {
    attempted: false,
    ok: false,
    matches: 0,
    topScore: null,
    filter: { ticker: 'GOOGL' },
    error: null
  };
  let testQueryEmbed = {
    attempted: false,
    ok: false,
    matches: 0,
    topScore: null,
    filter: { ticker: 'GOOGL' },
    error: null
  };

  try {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(INDEX_NAME);
    const stats = await index.describeIndexStats();

    totalVectors = stats?.totalRecordCount ?? null;
    dimension = stats?.dimension ?? null;
    status = 'ready';

    // Test a minimal query to validate index reachability/dimension
    testQuery.attempted = true;
    const dim = dimension || 1024;
    const zeroVector = Array(dim).fill(0);
    const res = await index.query({
      vector: zeroVector,
      topK: 1,
      includeMetadata: false,
      filter: testQuery.filter
    });
    const matches = res?.matches || [];
    testQuery.matches = matches.length;
    testQuery.topScore = matches[0]?.score ?? null;
    testQuery.ok = true;

    // Embedding-based test query to validate Voyage + Pinecone end-to-end
    try {
      testQueryEmbed.attempted = true;
      const vector = await embedText('google ai strategy investments 2024 2025', {
        model: 'voyage-3.5',
        inputType: 'query'
      });
      const resEmbed = await index.query({
        vector,
        topK: 3,
        includeMetadata: false,
        filter: testQueryEmbed.filter
      });
      const matchesEmbed = resEmbed?.matches || [];
      testQueryEmbed.matches = matchesEmbed.length;
      testQueryEmbed.topScore = matchesEmbed[0]?.score ?? null;
      testQueryEmbed.ok = true;
    } catch (errEmbed) {
      testQueryEmbed.ok = false;
      testQueryEmbed.error = errEmbed?.message || 'unknown error';
    }
  } catch (err) {
    status = 'error';
    error = err.message;
    if (testQuery.attempted) {
      testQuery.ok = false;
      testQuery.error = err.message;
    }
  }

  return NextResponse.json({
    ok: !error,
    status,
    index: INDEX_NAME,
    dimension,
    totalVectors,
    env: {
      pineconeKey: true,
      voyageKey: !!process.env.VOYAGE_API_KEY
    },
    testQuery,
    testQueryEmbed,
    error: error || null
  });
}
