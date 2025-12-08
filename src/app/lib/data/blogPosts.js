export const blogPosts = [
  {
    id: 'building-production-rag',
    title: 'Building a Production RAG System for Financial Analysis',
    subtitle: 'How I iteratively improved a RAG system for analyzing Big Tech earnings calls, with detailed metrics at each step.',
    date: '2024-12-03',
    status: 'draft', // 'draft' | 'published'
    readingTime: '15 min',
    tags: ['RAG', 'embeddings', 'evaluation', 'LLM'],
    summary: 'How I iteratively improved a Retrieval-Augmented Generation system for analyzing Big Tech earnings calls, with detailed metrics at each step.',
    
    // TL;DR for quick takeaways
    tldr: [
      'Add reranking — +7.8% faithfulness for $0.001/query',
      'Use hierarchical chunking — small chunks for search, large for context',
      'Filter by query intent — don\'t search everything for every query',
      'Go hybrid — combine semantic and keyword search',
    ],

    // Key insight that ties everything together
    coreInsight: 'The jump from 73% to 94% faithfulness didn\'t require breakthrough techniques. It required systematic diagnosis, incremental improvement, and obsessive measurement. The techniques are all published—the magic is in the execution.',
    
    // Metrics progression for visual display
    metricsProgression: [
      { version: 'Baseline', faithfulness: 73.4, relevance: 91.2, accuracy: 84.6, latency: 16800 },
      { version: '+ Reranking', faithfulness: 81.2, relevance: 93.1, accuracy: 87.3, latency: 17000 },
      { version: '+ Hierarchical', faithfulness: 85.7, relevance: 94.2, accuracy: 91.4, latency: 17300 },
      { version: '+ Query-Aware', faithfulness: 90.3, relevance: 95.8, accuracy: 92.1, latency: 16100 },
      { version: '+ Hybrid', faithfulness: 92.1, relevance: 97.2, accuracy: 94.8, latency: 16800 },
      { version: 'Final', faithfulness: 94.1, relevance: 97.2, accuracy: 94.8, latency: 8200 },
    ],

    // Key experiments for cards
    experiments: [
      {
        name: 'Reranking',
        description: 'Added Cohere cross-encoder reranker to re-score top-50 results down to top-5. Semantic search finds conceptually similar docs, but reranking identifies which actually contain the answer.',
        impact: '+7.8% faithfulness',
        cost: '$0.001/query, +180ms',
        verdict: 'ship',
        lessons: ['Retrieve more, then filter aggressively', 'Highest ROI improvement of the entire project']
      },
      {
        name: 'Hierarchical Chunking',
        description: 'Index small chunks (200 tokens) for precise retrieval, but pass parent sections (800 tokens) to the LLM for complete context. The optimal unit for finding ≠ the optimal unit for understanding.',
        impact: '+4.5% faithfulness, +4.1% accuracy',
        cost: '+0.3s latency',
        verdict: 'ship',
        lessons: ['Chunk boundaries were splitting key info', 'Worth the implementation complexity']
      },
      {
        name: 'Query-Aware Filtering',
        description: 'Dynamically filter Pinecone by content_type based on query intent. Strategic questions should search strategic content, not financial tables.',
        impact: '+4.6% faithfulness, -1.2s latency',
        cost: 'Rich metadata required at ingestion',
        verdict: 'ship',
        lessons: ['Metadata at ingestion time pays dividends', 'Smaller search space = faster + better']
      },
      {
        name: 'Hybrid Search',
        description: 'Combined dense (semantic) and sparse (BM25) retrieval with reciprocal rank fusion. Catches exact numbers and terms that embeddings miss.',
        impact: '+2.7% accuracy on exact-match queries',
        cost: '+0.7s latency',
        verdict: 'ship',
        lessons: ['Semantic similarity ≠ answer-containment', 'Essential for financial data with specific metrics']
      },
    ],

    // Key lessons for callout boxes
    lessons: [
      {
        title: 'Retrieval > Prompting',
        content: '80% of answer quality is determined before the LLM sees anything. Think of the LLM as a brilliant analyst who can only work with documents on their desk—your job is putting the right documents there.',
      },
      {
        title: 'Measure Everything',
        content: 'Every hour spent on evaluation infrastructure saved five hours debugging mysterious quality issues. You need faithfulness AND accuracy measured separately.',
      },
      {
        title: 'Rich Metadata is Compound Interest',
        content: 'Small investments at ingestion time pay dividends across every query. If you can imagine wanting to filter on an attribute, extract it during ingestion.',
      },
      {
        title: 'Reranking is Underrated',
        content: 'Embeddings create general-purpose similarity. Rerankers learn "how relevant is this document to this query?" Using both isn\'t a hack—it\'s specialization.',
      },
      {
        title: 'Hybrid Search for Precision',
        content: 'Semantic similarity is not answer-containment. A document can be highly similar to a query while not containing the answer. BM25 catches what embeddings miss.',
      },
      {
        title: 'Perfect is the Enemy of Shipped',
        content: 'At 94% faithfulness, the system is genuinely useful. The goal isn\'t 100%—it\'s a system that\'s useful, honest about limitations, and continuously improving.',
      },
    ],

    // Failure analysis data
    failureAnalysis: [
      { type: 'Wrong content type', percentage: 42, description: 'Retrieved financials for strategy questions' },
      { type: 'Insufficient context', percentage: 28, description: 'Relevant info existed but wasn\'t in top-12' },
      { type: 'Chunk boundary issues', percentage: 18, description: 'Key info split across chunks' },
      { type: 'True data gaps', percentage: 12, description: 'Information not in corpus' },
    ],

    // Full markdown content (abbreviated for display, full version in separate file)
    contentPath: 'docs/blog/building-a-production-rag-system.md',
  },
  {
    id: 'dense-vs-hybrid-search',
    title: 'Dense vs Hybrid Search: What We Actually Learned',
    subtitle: 'Spoiler: It\'s not as simple as "hybrid is better"',
    date: '2024-12-04',
    status: 'published',
    readingTime: '10 min',
    tags: ['RAG', 'Hybrid Search', 'BM25', 'Evaluation'],
    summary: 'We ran a head-to-head comparison of dense-only vs hybrid (dense + sparse) search. The results surprised us—and revealed that data coverage matters more than algorithm choice.',
    
    tldr: [
      'Dense won 5/10 queries, Hybrid won 2/10, 3 ties',
      'Hybrid is 42% faster (248ms vs 425ms)',
      'Data coverage matters more than algorithm choice',
      'Use query classification to route to optimal strategy',
    ],

    coreInsight: 'Neither approach is universally better. Dense excels at strategic questions and comparisons. Hybrid excels at exact metric lookups (Q3 revenue, specific product names). The real insight: don\'t pick one—classify queries and route appropriately.',
    
    metricsProgression: [
      { version: 'Dense (clarity-openai)', latency: 425, wins: 5 },
      { version: 'Hybrid (clarity-hybrid)', latency: 248, wins: 2 },
    ],
    
    // Custom metric display for this post (latency-focused)
    primaryMetric: 'latency',

    experiments: [
      {
        name: 'Exact Revenue Lookup',
        description: 'Query: "What was AMD\'s Q3 2024 revenue?" Dense returned 2025 guidance. Hybrid found exact $6.8B figure.',
        impact: 'Hybrid: 5/5, Dense: 2/5',
        cost: 'Same embedding cost',
        verdict: 'hybrid',
        lessons: ['Sparse vectors catch exact quarters/years', 'Dense conflates semantically similar but factually different data']
      },
      {
        name: 'Strategic Analysis',
        description: 'Query: "What is Meta\'s approach to AI infrastructure?" Dense retrieved strategy content. Hybrid returned financial tables.',
        impact: 'Dense: 4/5, Hybrid: 1/5',
        cost: 'Same embedding cost',
        verdict: 'dense',
        lessons: ['Semantic understanding required', 'Keywords alone miss context']
      },
      {
        name: 'Multi-Company Comparison',
        description: 'Query: "Compare AMD and NVIDIA data center strategies." Dense found relevant strategic details. Hybrid missed NVIDIA entirely.',
        impact: 'Dense: 4/5, Hybrid: 2/5',
        cost: 'Same embedding cost',
        verdict: 'dense',
        lessons: ['Dense synthesizes across sources', 'Data coverage in hybrid index was lacking']
      },
      {
        name: 'Latency Comparison',
        description: 'Measured average query latency across 10 test queries.',
        impact: 'Hybrid 42% faster',
        cost: 'Dense: 425ms avg, Hybrid: 248ms avg',
        verdict: 'hybrid',
        lessons: ['Pinecone native hybrid scoring is optimized', 'Smaller index also helps']
      },
    ],

    lessons: [
      {
        title: 'Data Coverage > Algorithm',
        content: 'Our hybrid index had 4,583 vectors vs 28,110 in dense. This single factor likely explains most results. Before concluding hybrid doesn\'t work, ensure data parity.',
      },
      {
        title: 'Use Query Classification',
        content: 'Don\'t pick one approach. Classify queries: exact metrics → hybrid, strategic questions → dense, comparisons → multi-query with RRF.',
      },
      {
        title: 'Hybrid is Faster',
        content: 'Counter-intuitive: adding sparse vectors made queries 42% faster. Pinecone\'s native hybrid scoring is well-optimized.',
      },
      {
        title: 'Keep Both Indexes',
        content: 'Maintaining both during migration lets you A/B test, fall back on failures, and gradually shift traffic as confidence grows.',
      },
    ],

    failureAnalysis: [
      { type: 'Data coverage gap', percentage: 50, description: 'Hybrid index had 6x fewer vectors' },
      { type: 'Wrong query type', percentage: 25, description: 'Strategic query sent to keyword-heavy index' },
      { type: 'Keyword missed', percentage: 15, description: 'Product name not in sparse vocabulary' },
      { type: 'True tie', percentage: 10, description: 'Both approaches performed equally' },
    ],

    contentPath: 'docs/blog/dense-vs-hybrid-search.md',
  },
  {
    id: 'scaling-with-gemini',
    title: 'The Long Context Dilemma: Switching to Gemini 1.5 Pro',
    subtitle: 'Can a 2-million token context window replace RAG entirely?',
    date: '2024-12-05',
    status: 'published',
    readingTime: '12 min',
    tags: ['Gemini', 'Long Context', 'RAG', 'Latency'],
    summary: 'I replaced my entire vector database with a simple "context dump" to Google\'s Gemini 1.5 Pro. The results challenged everything I thought I knew about retrieval architecture.',
    
    tldr: [
      'Context stuffing works for quality, but fails on cost ($1.75/query)',
      'Gemini 1.5 Flash is the latency king for simple lookups',
      'The best architecture is RAG + Large Context (Top-100 chunks)',
      'Long context changes RAG from "Search" to "Curation"',
    ],

    coreInsight: 'Long context windows don\'t kill RAG; they change its purpose. In a small-context world, RAG must be a sniper. In a large-context world, RAG can be a net. You don\'t need to find the exact paragraph, just the right neighborhood.',

    metricsProgression: [
      { version: 'Claude 3.5 (Baseline)', faithfulness: 94.1, relevance: 97.2, accuracy: 94.8, latency: 8200 },
      { version: 'Gemini Pro (Full Context)', faithfulness: 98.5, relevance: 99.1, accuracy: 99.4, latency: 45000 },
      { version: 'Gemini Pro (RAG Top-100)', faithfulness: 96.2, relevance: 98.4, accuracy: 97.1, latency: 12500 },
      { version: 'Gemini Flash (Hybrid)', faithfulness: 95.8, relevance: 97.9, accuracy: 96.5, latency: 4100 },
    ],

    experiments: [
      {
        name: 'The "Context Dump"',
        description: 'Removed Pinecone entirely. Loaded 12 quarters of transcripts (500k tokens) directly into the prompt.',
        impact: 'Perfect accuracy, unusable latency (45s)',
        cost: '$1.75 per query',
        verdict: 'skip',
        lessons: ['Cost is prohibitive for production', 'Latency kills the chat experience'],
      },
      {
        name: 'Gemini as RAG Reasoner',
        description: 'Used Pinecone to retrieve Top-100 chunks (instead of Top-10) and fed them to Gemini 1.5 Pro.',
        impact: '+2.1% faithfulness vs Claude Baseline',
        cost: '$0.15 per query',
        verdict: 'ship',
        lessons: ['Larger context = relaxed retrieval strictness', 'Less "lost in the middle" than expected'],
      },
      {
        name: 'Flash Hybrid Routing',
        description: 'Route simple fact-based queries to Gemini 1.5 Flash with smaller context.',
        impact: '3x faster than baseline',
        cost: '$0.01 per query',
        verdict: 'ship',
        lessons: ['Flash is "good enough" for 80% of queries', 'Router logic is the new prompt engineering'],
      },
    ],

    lessons: [
      {
        title: 'Context is a Safety Net',
        content: 'With 2M context, you don\'t need perfect retrieval. You just need to get the answer *somewhere* in the input. This makes the retrieval system much more forgiving.',
      },
      {
        title: 'Latency is the New Bottleneck',
        content: 'Accuracy is solved with long context. The challenge is now making it fast enough for a chat interface. Streaming helps, but time-to-first-token matters.',
      },
      {
        title: 'Cost per Insight',
        content: 'RAG is 100x cheaper than context stuffing. For a free-to-use tool, RAG is mandatory. For a high-value enterprise tool, context stuffing might be worth it.',
      },
      {
        title: 'The "Lost in the Middle" Myth',
        content: 'I found Gemini 1.5 Pro surprisingly robust at finding needles in haystacks. The "lost in the middle" phenomenon seems much less severe than in older models.',
      },
    ],

    failureAnalysis: [
      { type: 'Timeout / Latency', percentage: 55, description: 'User gave up waiting for full context response' },
      { type: 'Refusal to Answer', percentage: 25, description: 'Safety filters triggered more often on large context' },
      { type: 'Verbosity', percentage: 15, description: 'Answers became essay-length without strict prompting' },
      { type: 'Cost Overrun', percentage: 5, description: 'Single query consumed daily budget' },
    ],

    contentPath: 'docs/blog/gemini-experiment.md',
  },
];

// Helper to get published posts only
export const getPublishedPosts = () => blogPosts.filter(p => p.status === 'published');

// Helper to get all posts including drafts
export const getAllPosts = () => blogPosts;

// Helper to get a single post by ID
export const getPostById = (id) => blogPosts.find(p => p.id === id);

