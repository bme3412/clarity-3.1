'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Database, Brain, Search, Zap, 
  FileText, Code, GitBranch, Layers, ChevronDown, ChevronRight,
  ExternalLink, Check
} from 'lucide-react';

// Code snippet component with syntax highlighting simulation
function CodeBlock({ title, language, code }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        <span className="text-xs text-slate-500">{language}</span>
      </div>
      <pre className="p-4 text-sm text-slate-300 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Expandable section component
function ExpandableSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <span className="font-semibold text-slate-800">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-6 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link 
            href="/chat"
            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Chat</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-800">Clarity</span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">3.0</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            How Clarity 3.0 Works
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            A deep dive into the RAG architecture, embedding strategy, and agentic LLM patterns 
            powering financial intelligence.
          </p>
        </div>

        {/* Architecture Overview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-12 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">System Architecture</h2>
          
          <div className="bg-slate-900 rounded-xl p-6 font-mono text-sm text-slate-300 overflow-x-auto">
            <pre>{`
┌─────────────────────────────────────────────────────────────────────┐
│                         USER QUERY                                   │
│              "What is NVIDIA's AI strategy?"                        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS API LAYER                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ /api/chat/stream                                               │  │
│  │ • Zod validation • SSE streaming • Tool orchestration         │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAUDE OPUS (Agentic LLM)                         │
│                                                                      │
│   Tool Selection:                                                    │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│   │ get_financial_  │  │ search_earnings_│  │ compute_growth_ │    │
│   │    metrics      │  │   transcript    │  │     rate        │    │
│   └────────┬────────┘  └────────┬────────┘  └────────┬────────┘    │
└────────────┼────────────────────┼────────────────────┼──────────────┘
             │                    │                    │
             ▼                    ▼                    ▼
┌───────────────────┐  ┌─────────────────────────────────────────────┐
│  LOCAL JSON DATA  │  │           PINECONE VECTOR DB                │
│                   │  │  ┌─────────────────────────────────────┐   │
│  data/financials/ │  │  │     11,929 vectors                  │   │
│  • Revenue        │  │  │  ┌─────────┐  ┌─────────┐           │   │
│  • EPS            │  │  │  │ Dense   │  │ Sparse  │           │   │
│  • Margins        │  │  │  │ Voyage  │  │ BM25    │           │   │
│  • Segments       │  │  │  │ 1024-dim│  │Keywords │           │   │
│                   │  │  │  └─────────┘  └─────────┘           │   │
└───────────────────┘  │  │      HYBRID SEARCH                  │   │
                       │  └─────────────────────────────────────┘   │
                       └─────────────────────────────────────────────┘
                                         │
                                         ▼
                       ┌─────────────────────────────────┐
                       │     STREAMING RESPONSE          │
                       │  ───────────────────────▶       │
                       │  Token-by-token via SSE         │
                       └─────────────────────────────────┘
`}</pre>
          </div>
        </div>

        {/* Key Components */}
        <div className="space-y-4 mb-12">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Technical Deep Dive</h2>
          
          <ExpandableSection title="Hybrid Search Strategy" icon={Search} defaultOpen={true}>
            <div className="space-y-4">
              <p className="text-slate-600">
                We combine <strong>dense vectors</strong> (semantic similarity) with <strong>sparse vectors</strong> 
                (keyword matching) for optimal retrieval. This catches both conceptual matches and exact terms.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Dense Vectors (Voyage 3.5)</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 1024 dimensions</li>
                    <li>• Captures semantic meaning</li>
                    <li>• "AI strategy" ≈ "machine learning initiatives"</li>
                  </ul>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <h4 className="font-semibold text-emerald-800 mb-2">Sparse Vectors (BM25)</h4>
                  <ul className="text-sm text-emerald-700 space-y-1">
                    <li>• Keyword frequency-based</li>
                    <li>• Catches exact matches</li>
                    <li>• "MI300", "Blackwell", "Q3 FY2025"</li>
                  </ul>
                </div>
              </div>
              
              <CodeBlock 
                title="sparseVectorizer.js" 
                language="JavaScript"
                code={`// BM25-style sparse vector generation
const boostTerms = {
  'revenue': 1.5, 'margin': 1.5, 'growth': 1.5,
  'earnings': 1.5, 'guidance': 1.5, 'outlook': 1.5
};

function vectorize(text) {
  const tokens = tokenize(text);
  const tf = computeTermFrequency(tokens);
  
  // Apply financial term boosting
  for (const [term, boost] of Object.entries(boostTerms)) {
    if (tf[term]) tf[term] *= boost;
  }
  
  return { indices, values }; // Sparse format
}`}
              />
            </div>
          </ExpandableSection>
          
          <ExpandableSection title="Chunking & Embedding Strategy" icon={Layers}>
            <div className="space-y-4">
              <p className="text-slate-600">
                Documents are split into overlapping chunks to preserve context across boundaries, 
                particularly important for earnings call Q&A where speaker transitions matter.
              </p>
              
              <div className="bg-slate-100 rounded-xl p-4 font-mono text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-600">Chunk Size:</span>
                  <span className="font-bold text-slate-800">800 characters</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-slate-600">Overlap:</span>
                  <span className="font-bold text-slate-800">150 characters</span>
                </div>
                <div className="bg-white rounded-lg p-3 text-xs">
                  <span className="text-blue-600">[Chunk 1: 800 chars]</span>
                  <span className="text-amber-500 mx-1">◀──150──▶</span>
                  <span className="text-emerald-600">[Chunk 2: 800 chars]</span>
                  <span className="text-amber-500 mx-1">◀──150──▶</span>
                  <span className="text-violet-600">[Chunk 3...]</span>
                </div>
              </div>
              
              <CodeBlock 
                title="embed-all-voyage.js" 
                language="JavaScript"
                code={`// Chunking with overlap
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

function chunkText(text) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  
  return chunks;
}`}
              />
            </div>
          </ExpandableSection>
          
          <ExpandableSection title="Agentic Tool Use" icon={Brain}>
            <div className="space-y-4">
              <p className="text-slate-600">
                Claude dynamically selects and executes tools based on query intent. 
                The model decides whether to fetch structured data, search transcripts, or compute metrics.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Query Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Tool Selected</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Data Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-4 text-slate-600">"What was AMD's revenue?"</td>
                      <td className="py-3 px-4"><code className="text-blue-600">get_financial_metrics</code></td>
                      <td className="py-3 px-4 text-slate-500">Local JSON</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-600">"NVIDIA's AI strategy?"</td>
                      <td className="py-3 px-4"><code className="text-blue-600">search_earnings_transcript</code></td>
                      <td className="py-3 px-4 text-slate-500">Pinecone vectors</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-600">"YoY growth rate?"</td>
                      <td className="py-3 px-4"><code className="text-blue-600">compute_growth_rate</code></td>
                      <td className="py-3 px-4 text-slate-500">Calculated</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <CodeBlock 
                title="tools/definitions.js" 
                language="JavaScript"
                code={`export const FINANCIAL_TOOLS = [
  {
    name: 'search_earnings_transcript',
    description: 'Semantic search over earnings call transcripts',
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Stock ticker' },
        query: { type: 'string', description: 'Search query' },
        fiscalYear: { type: 'string', description: 'e.g., 2025' },
        topK: { type: 'number', description: 'Results to return' }
      },
      required: ['ticker', 'query']
    }
  },
  // ... more tools
];`}
              />
            </div>
          </ExpandableSection>
          
          <ExpandableSection title="Streaming Architecture" icon={Zap}>
            <div className="space-y-4">
              <p className="text-slate-600">
                Server-Sent Events (SSE) enable token-by-token streaming for real-time responses. 
                The UI updates progressively as data arrives.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Event Types</h4>
                  <div className="space-y-2">
                    {[
                      { type: 'metadata', desc: 'Request ID, detected tickers' },
                      { type: 'tool_start', desc: 'Tool execution begins' },
                      { type: 'tool_result', desc: 'Tool output with latency' },
                      { type: 'content', desc: 'Response text tokens' },
                      { type: 'metrics', desc: 'Pipeline performance data' },
                      { type: 'end', desc: 'Stream complete' }
                    ].map(e => (
                      <div key={e.type} className="flex items-center gap-2 text-sm">
                        <code className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{e.type}</code>
                        <span className="text-slate-500">{e.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <CodeBlock 
                  title="SSE Format" 
                  language="plaintext"
                  code={`data: {"type":"metadata","requestId":"abc123"}

data: {"type":"tool_start","tool":"search_earnings_transcript"}

data: {"type":"tool_result","success":true,"latencyMs":342}

data: {"type":"content","content":"NVIDIA's AI"}
data: {"type":"content","content":" strategy focuses"}
data: {"type":"content","content":" on data centers..."}

data: {"type":"metrics","metrics":{...}}

data: {"type":"end"}`}
                />
              </div>
            </div>
          </ExpandableSection>
          
          <ExpandableSection title="Data Coverage" icon={Database}>
            <div className="space-y-4">
              <p className="text-slate-600">
                Comprehensive coverage of Big Tech earnings data from FY2020 to FY2025.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {['AAPL', 'AMD', 'AMZN', 'AVGO', 'CRM', 'GOOGL', 'META', 'MSFT', 'NVDA', 'ORCL'].map(ticker => (
                  <div key={ticker} className="bg-slate-100 rounded-lg p-3 text-center">
                    <span className="font-mono font-bold text-slate-800">{ticker}</span>
                  </div>
                ))}
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-blue-700">11,929</div>
                  <div className="text-sm text-blue-600">Total Vectors</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-700">571</div>
                  <div className="text-sm text-emerald-600">Transcript Files</div>
                </div>
                <div className="bg-violet-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-violet-700">5+</div>
                  <div className="text-sm text-violet-600">Years of Data</div>
                </div>
              </div>
            </div>
          </ExpandableSection>
        </div>

        {/* Performance Benchmarks */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-12 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Performance Benchmarks</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Metric</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Target</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Actual</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-4 text-slate-600">Retrieval Latency</td>
                  <td className="py-3 px-4 text-slate-500">&lt;500ms</td>
                  <td className="py-3 px-4 font-mono text-slate-800">200-400ms</td>
                  <td className="py-3 px-4"><span className="text-emerald-600">✓ Passing</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-600">Time to First Token</td>
                  <td className="py-3 px-4 text-slate-500">&lt;3s</td>
                  <td className="py-3 px-4 font-mono text-slate-800">1.5-2.5s</td>
                  <td className="py-3 px-4"><span className="text-emerald-600">✓ Passing</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-600">Full Response Time</td>
                  <td className="py-3 px-4 text-slate-500">&lt;15s</td>
                  <td className="py-3 px-4 font-mono text-slate-800">8-12s</td>
                  <td className="py-3 px-4"><span className="text-emerald-600">✓ Passing</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-600">Retrieval Precision@10</td>
                  <td className="py-3 px-4 text-slate-500">&gt;70%</td>
                  <td className="py-3 px-4 font-mono text-slate-800">~75%</td>
                  <td className="py-3 px-4"><span className="text-emerald-600">✓ Passing</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Trade-off Decisions */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 text-white mb-12">
          <h2 className="text-2xl font-bold mb-6">Key Design Decisions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-blue-300 mb-2">Why Voyage for dense embeddings?</h3>
              <p className="text-slate-300">
                Voyage <code className="text-emerald-300">voyage-3.5</code> outperforms our legacy dense baseline on 
                domain-specific retrieval tasks. In our testing, it achieved ~5% higher precision@10 
                on financial transcripts.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-blue-300 mb-2">Why hybrid search over dense-only?</h3>
              <p className="text-slate-300">
                Financial queries often contain specific terms (tickers, product names, quarters) that 
                dense embeddings can miss. BM25 sparse vectors ensure exact keyword matches while 
                dense vectors capture semantic meaning.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-blue-300 mb-2">Why 800-char chunks with 150-char overlap?</h3>
              <p className="text-slate-300">
                Smaller chunks (800 chars) enable precise retrieval, while overlap (150 chars) preserves 
                context across speaker transitions in earnings Q&A sections. This balance was determined 
                through iterative testing.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Try Clarity 3.0
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 mt-12">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-slate-500">
          Built with Next.js, Claude Opus, Voyage AI, and Pinecone
        </div>
      </footer>
    </div>
  );
}
