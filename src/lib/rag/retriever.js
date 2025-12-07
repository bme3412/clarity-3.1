import { Pinecone } from '@pinecone-database/pinecone';
import { embedText } from '../../app/lib/llm/voyageClient';
import { SparseVectorizer } from './sparseVectorizer.js';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
// Uses Voyage AI voyage-3.5 embeddings (1024 dimensions)
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'clarity-1024';

// Always try sparse vectors for hybrid search - better recall for keywords
// Will gracefully fall back to dense-only if index doesn't support sparse
const USE_SPARSE = process.env.PINECONE_SUPPORTS_SPARSE !== 'false';

if (!PINECONE_API_KEY) {
  console.warn('[retriever] PINECONE_API_KEY is missing; transcript search will be disabled.');
}

const vectorizer = new SparseVectorizer();
let pineconeIndex = null;
let sparseSupported = USE_SPARSE; // Track if sparse is supported

function getIndex() {
  if (!PINECONE_API_KEY) return null;
  if (pineconeIndex) return pineconeIndex;
  const client = new Pinecone({ apiKey: PINECONE_API_KEY });
  pineconeIndex = client.index(PINECONE_INDEX);
  return pineconeIndex;
}

async function buildQueryVector(query) {
  return embedText(query, { model: 'voyage-3.5', inputType: 'query' });
}

export const retriever = {
  /**
   * Hybrid semantic search over transcripts (dense + sparse)
   * @param {{query: string, filters?: object, topK?: number}} params
   */
  async search({ query, filters = {}, topK = 15 }) {
    const index = getIndex();
    if (!index) {
      return { matches: [] };
    }

    const vector = await buildQueryVector(query);
    const sparseVector = sparseSupported ? vectorizer.toSparseValues(query) : null;

    const queryParams = {
      vector,
      topK,
      includeMetadata: true
    };
    
    if (sparseVector && sparseSupported) {
      queryParams.sparseVector = sparseVector;
    }
    if (filters && Object.keys(filters).length) {
      queryParams.filter = filters;
    }

    try {
      const res = await index.query(queryParams);
      return res || { matches: [] };
    } catch (err) {
      // Check if error is due to sparse vectors not being supported
      const errMsg = err?.message?.toLowerCase() || '';
      if (errMsg.includes('sparse') && sparseSupported) {
        console.warn('[retriever] Sparse vectors not supported, falling back to dense-only');
        sparseSupported = false;
        // Retry without sparse
        delete queryParams.sparseVector;
        try {
          const retryRes = await index.query(queryParams);
          return retryRes || { matches: [] };
        } catch (retryErr) {
          console.error('[retriever.search] Retry failed:', retryErr?.message);
          return { matches: [], error: retryErr?.message || 'unknown error' };
        }
      }
      console.error('[retriever.search] Pinecone query error:', err?.message || err);
      return { matches: [], error: err?.message || 'unknown error' };
    }
  }
};
