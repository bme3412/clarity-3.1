/**
 * RAG Retrieval Strategy Configurations
 * 
 * Each strategy represents a different approach to retrieval.
 * The frontend allows users to switch between strategies to see
 * how different techniques affect answer quality.
 */

export const RETRIEVAL_STRATEGIES = {
  'dense-only': {
    id: 'dense-only',
    name: 'Dense Retrieval',
    shortName: 'Dense',
    icon: 'Layers',
    description: 'Pure semantic similarity search using embeddings',
    technicalDetails: 'OpenAI text-embedding-3-small → Pinecone cosine similarity',
    pros: [
      'Fast single-index lookup',
      'Good for conceptual/semantic queries',
      'Lower latency (~200ms retrieval)'
    ],
    cons: [
      'May miss exact keyword matches',
      'Struggles with specific numbers/names',
      'No lexical signal'
    ],
    expectedLatency: '1.5-2.5s',
    bestFor: 'Strategic analysis, trend questions, conceptual queries',
    color: 'blue',
    enabled: true,
  },

  'hybrid-bm25': {
    id: 'hybrid-bm25',
    name: 'Hybrid (BM25 + Dense)',
    shortName: 'Hybrid',
    icon: 'GitMerge',
    description: 'Combines keyword matching with semantic search',
    technicalDetails: 'BM25 sparse vectors + dense embeddings, α=0.5 blend',
    pros: [
      'Catches exact terms (revenue, Q3, MI300)',
      'More robust for financial queries',
      'Better precision on numbers'
    ],
    cons: [
      'Slightly higher latency',
      'Requires sparse vector support',
      'More complex scoring'
    ],
    expectedLatency: '2-3s',
    bestFor: 'Financial metrics, specific product names, exact quotes',
    color: 'emerald',
    enabled: true,
    // This uses the keyword fallback as a pseudo-hybrid approach
    usesKeywordFallback: true,
  },

  'hyde': {
    id: 'hyde',
    name: 'HyDE (Hypothetical)',
    shortName: 'HyDE',
    icon: 'Sparkles',
    description: 'Generates hypothetical answer, then searches for similar content',
    technicalDetails: 'LLM → hypothetical doc → embed → search',
    pros: [
      'Excellent for vague queries',
      'Expands query semantically',
      'Handles intent gaps'
    ],
    cons: [
      'Extra LLM call (+500ms)',
      'Can hallucinate search direction',
      'Higher cost per query'
    ],
    expectedLatency: '3-4s',
    bestFor: 'Vague questions, exploratory research, "what about X?"',
    color: 'violet',
    enabled: true,
    requiresExtraLLMCall: true,
  },

  'multi-query': {
    id: 'multi-query',
    name: 'Multi-Query Expansion',
    shortName: 'Multi-Q',
    icon: 'Network',
    description: 'Generates multiple query variations, merges results',
    technicalDetails: 'LLM generates 3 query variants → parallel search → RRF merge',
    pros: [
      'Covers multiple phrasings',
      'Good for ambiguous queries',
      'Reduces single-query bias'
    ],
    cons: [
      '3x embedding calls',
      'Higher latency',
      'May retrieve redundant docs'
    ],
    expectedLatency: '3-5s',
    bestFor: 'Complex questions, comparison queries, research',
    color: 'amber',
    enabled: false, // Coming soon
    comingSoon: true,
  },
};

// Default strategy
export const DEFAULT_STRATEGY = 'dense-only';

// Get enabled strategies only
export const getEnabledStrategies = () => 
  Object.values(RETRIEVAL_STRATEGIES).filter(s => s.enabled);

// Get strategy by ID with fallback
export const getStrategy = (id) => 
  RETRIEVAL_STRATEGIES[id] || RETRIEVAL_STRATEGIES[DEFAULT_STRATEGY];

