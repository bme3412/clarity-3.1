export const ragStrategies = [
  {
    version: 'v1.0',
    codename: 'Clarity Baseline',
    period: 'May 2025 – Present',
    summary:
      'Hybrid retrieval + deterministic financial lookups built around Voyage embeddings, Pinecone hybrid search, and Anthropic synthesis.',
    howItWorks:
      'The API route instantiates ExtendedRAGPipeline with VoyageEmbedder, PineconeRetriever, QueryIntentAnalyzer, FinancialJSONRetriever, and KeywordTranscriptRetriever. The pipeline classifies the query, normalizes tickers via COMPANY_ALIASES, applies Pinecone filters, blends dense/sparse scores, fetches JSON ledgers when metrics are requested, pulls keyword-matched transcript snippets, and hands the combined context to EnhancedFinancialAnalyst for tightly scoped answers.',
    goals:
      'Deliver accurate, reference-backed earnings analysis for Big Tech tickers while keeping the codebase debuggable and deterministic enough for investors.',
    codeRefs: [
      {
        path: 'src/app/api/chat/route.js',
        description: 'Factory that wires Voyage, Pinecone, Anthropic, and filesystem retrievers into a single pipeline instance.'
      },
      {
        path: 'src/lib/rag/pipeline.js',
        description: 'ExtendedRAGPipeline orchestrates intent parsing, filter building, retrieval fan-out, and context merging.'
      },
      {
        path: 'src/lib/rag/components.js',
        description: 'Implements VoyageEmbedder, PineconeRetriever (hybrid rerank), FinancialJSONRetriever, KeywordTranscriptRetriever, and EnhancedFinancialAnalyst prompts.'
      },
      {
        path: 'src/config/rag.js',
        description: 'Ticker alias map and embedding configuration used by the pipeline.'
      },
      {
        path: 'RAG_IMPROVEMENT_PLAN.md',
        description: 'Living strategy doc outlining upcoming observability, reranking, and evaluation upgrades.'
      }
    ],
    iterationIdeas: [
      'Swap the ad-hoc reranker with Cohere Rerank or bge-m3 for higher precision.',
      'Add streaming responses to /api/chat for better UX.',
      'Instrument tracing (LangSmith/Phoenix) and wire the evaluator script into CI smoke tests.'
    ],
    evaluationNarrative:
      '26 Nov 2025 (23:51 UTC) rerun proved the metadata fix worked: Pinecone still rejects sparse vectors, but dense retrieval now returns AMD Q3 transcript chunks. Quantitative questions stayed perfect (faithfulness 0.95) and the AI strategy prompt still exposes weak narrative coverage (0.30) because we only have financial sections indexed. Next action is adding strategic/QA sections or a reranker before we can lift the grade further.',
    effectivenessGrade: 'B',
    effectivenessRationale:
      'Dense-only retrieval plus JSON fallback now returns transcript evidence, raising faithfulness to 0.73 average. Still loses points on strategy prompts until we ingest qualitative sections or rerank beyond pure financial snippets.',
    latestEvaluation: {
      runId: '2025-11-26T23-51-11-174Z',
      timestamp: '2025-11-26T23:51:11.174Z',
      dataset: 'data/evaluation/dataset.json',
      samples: 3,
      averages: {
        relevance: 0.98,
        faithfulness: 0.73,
        accuracy: 0.9,
        totalLatencyMs: 16835
      },
      observations: [
        'Sparse vectors still disabled but dense matches now return AMD Q3 2024 transcript chunks thanks to metadata alignment.',
        'Financial revenue + data center prompts hit faithfulness 0.95 with both transcript + JSON cited.',
        'AI strategy prompt remains faithfulness 0.30 because only financial sections are indexed; need strategic/QA content ingestion.'
      ],
      logPath: 'evaluation_reports/baseline/2025-11-26T23-51-11-174Z/run.json',
      command: 'RAG_STRATEGY_ID=baseline node scripts/evaluate-rag.js'
    }
  }
];

