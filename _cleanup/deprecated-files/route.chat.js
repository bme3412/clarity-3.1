// src/app/api/chat/route.js
import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import path from 'path';

// Import from the new refactored locations
import {
  VoyageEmbedder,
  PineconeRetriever,
  QueryIntentAnalyzer,
  EnhancedFinancialAnalyst,
  FinancialJSONRetriever,
  KeywordTranscriptRetriever
} from '../../../lib/rag/components.js';

import { ExtendedRAGPipeline } from '../../../lib/rag/pipeline.js';

// ----------------------------------------------------------------
// Factory Function
// ----------------------------------------------------------------
function createPipeline() {
  const envVars = [
    'ANTHROPIC_API_KEY',
    'VOYAGE_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_INDEX',
  ];
  for (const v of envVars) {
    if (!process.env[v]) throw new Error(`${v} is required`);
  }

  const pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const pineconeIndex = pineconeClient.index(process.env.PINECONE_INDEX);

  const embedder = new VoyageEmbedder();
  const pineRetriever = new PineconeRetriever(pineconeIndex, embedder, {
    hybridAlpha: 0.6,
  });
  const intentAnalyzer = new QueryIntentAnalyzer();

  const analyzer = new EnhancedFinancialAnalyst();

  const baseDir = path.join(process.cwd(), 'data', 'financials');
  const finRetriever = new FinancialJSONRetriever(baseDir);
  const transcriptDir = path.join(process.cwd(), 'data', 'transcripts');
  const keywordRetriever = new KeywordTranscriptRetriever(transcriptDir);

  return new ExtendedRAGPipeline(
    embedder,
    pineRetriever,
    analyzer,
    intentAnalyzer,
    finRetriever,
    keywordRetriever
  );
}

const pipeline = createPipeline();

// ----------------------------------------------------------------
// POST Handler
// ----------------------------------------------------------------
export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: 'Invalid query.', details: 'Query cannot be empty' },
        { status: 400 }
      );
    }

    console.log('User query:', query);

    try {
      // Add timeout to prevent very long responses
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
      });
      
      const resultPromise = pipeline.process(query);
      const result = await Promise.race([resultPromise, timeoutPromise]);
      
      return NextResponse.json(result);
    } catch (err) {
      console.error('Processing error:', err);
      return NextResponse.json(
        {
          analysis: err.message === 'Request timeout' 
            ? 'The request took too long to process. Please try a more specific query.'
            : 'An error occurred while processing your query.',
          metadata: { error: err.message },
        },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Request parsing error:', err);
    return NextResponse.json(
      {
        analysis: 'Failed to process the request. Ensure JSON body with { query: "..." }.',
        metadata: { error: err.message },
      },
      { status: 400 }
    );
  }
};
