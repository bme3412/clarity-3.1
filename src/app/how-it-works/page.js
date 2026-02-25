import Link from 'next/link';
import { 
  ArrowLeft, Database, Brain, Search, Zap, 
  FileText, Code, GitBranch, Layers,
  ExternalLink, Check, AlertTriangle, ShieldCheck, Gauge, ListChecks
} from 'lucide-react';

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
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">3.1</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            How Clarity 3.1 Works
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            A practical deep dive into the RAG architecture, retrieval strategies, and streaming UX
            behind Clarity’s “earnings intelligence” answers.
          </p>
        </div>

        {/* What happens when you ask a question */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-12 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">What happens when you ask a question?</h2>
          <p className="text-slate-600 mb-6">
            Clarity is designed to behave like a disciplined analyst: it <strong>retrieves sources first</strong>,
            then answers using only retrieved evidence, and streams progress in real-time.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-5 bg-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-slate-800">Runtime flow (high level)</h3>
              </div>
              <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                <li><strong>Validate</strong> request (input schema + limits).</li>
                <li><strong>Detect</strong> likely ticker + intent (numbers vs narrative).</li>
                <li><strong>Retrieve</strong> evidence (tools: financial metrics + transcript search).</li>
                <li><strong>Assemble</strong> a grounded context block with citations.</li>
                <li><strong>Generate</strong> an answer and stream tokens to the UI.</li>
                <li><strong>Emit</strong> metrics (latencies, retrieval stats) at the end.</li>
              </ol>
              <div className="mt-4 text-xs text-slate-500 leading-relaxed">
                <strong className="text-slate-700">Important:</strong> Clarity intentionally limits tool usage per request
                to keep latency predictable and to avoid “runaway agent” behavior.
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-5 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold text-slate-800">What you see in the UI</h3>
              </div>
              <ul className="text-sm text-slate-600 space-y-2">
                <li><strong>Status updates</strong> like “Analyzing…” / “Searching…” to reduce dead time.</li>
                <li><strong>Retrieved sources panel</strong> showing which chunks/metrics were used.</li>
                <li><strong>Streaming response</strong> (token-by-token) instead of waiting for a full block.</li>
                <li><strong>Pipeline metrics</strong> (e.g., time-to-first-token, tool latency, avg score).</li>
              </ul>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                The goal is simple: you should be able to answer “why did I get this answer?” by looking at sources and tool outputs,
                without guessing what happened inside the model.
              </div>
            </div>
          </div>
        </div>

        {/* Single-article technical deep dive (no accordions) */}
        <div className="space-y-10 mb-12">
          <h2 className="text-2xl font-bold text-slate-800">Technical deep dive</h2>

          {/* Architecture Overview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Layers className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-800">System architecture (end-to-end)</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Clarity’s core idea is simple: route questions to the right evidence source, keep tool usage bounded,
              and stream progress so the system feels responsive and debuggable.
            </p>

            <div className="bg-slate-900 rounded-xl p-6 font-mono text-sm text-slate-300 overflow-x-auto">
              <pre>{`
User → /api/chat/stream (SSE)
  → validate input
  → infer intent + ticker/timeframe
  → run tools (financial JSON + transcript retrieval)
  → compile grounded context
  → generate answer (stream tokens)
  → emit metrics (TTFT, total time, tool timings, retrieval stats)
`}</pre>
            </div>
          </div>

          {/* Grounding */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-800">Grounding & citations: “no evidence, no claim”</h3>
            </div>

            <div className="space-y-4 text-slate-600">
              <p>
                Clarity optimizes for <strong>trust</strong>. The prompt and tool layer enforce a simple constraint:
                <strong> if a number or factual claim isn’t present in tool output, it shouldn’t be stated</strong>.
                Practically, this means you’ll sometimes see <em>“Not found in provided sources”</em>—and that’s intentional.
              </p>

              <p className="text-sm">
                <strong className="text-slate-800">What “good” looks like:</strong> every claim is anchored to retrieved context
                or a tool result; numeric values come from structured tools (no guessing); and sources/tool traces are visible in the UI.
              </p>

              <p className="text-sm">
                <strong className="text-slate-800">Why you might see “Not found”:</strong> the requested quarter/year isn’t present
                in the dataset, the question is underspecified (missing ticker or timeframe), or the metric doesn’t exist in the structured JSON.
              </p>

              <p className="text-sm">
                <strong className="text-slate-800">How to ask for numbers (best practice):</strong> include a ticker and timeframe
                (example: <span className="font-mono">“AAPL latest quarter revenue and gross margin”</span>). For strategy questions,
                include a focus area (example: <span className="font-mono">“NVDA Blackwell demand + supply constraints”</span>).
              </p>
            </div>
          </div>

          {/* Evidence sources */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-800">Evidence sources: structured numbers + narrative transcripts</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Clarity answers questions from two complementary sources. This separation is intentional: financial answers
              often require exact numbers, while strategy answers require grounded narrative context.
            </p>

            <div className="space-y-5 text-slate-600">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-800">Structured financial JSON (numbers)</h4>
                <p className="text-sm">
                  Use this lane for exact metrics (revenue, EPS, margins, segment figures). Deterministic retrieval reduces extraction
                  errors and hallucination pressure.
                </p>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  <li>
                    <strong className="text-slate-800">Source:</strong> <code className="font-mono">data/financials/</code>
                  </li>
                  <li>
                    <strong className="text-slate-800">Tools:</strong> <code className="font-mono">get_financial_metrics</code>,{' '}
                    <code className="font-mono">get_multi_quarter_metrics</code>
                  </li>
                  <li>
                    <strong className="text-slate-800">“Latest” handling:</strong> resolves most recent available quarter per ticker for up-to-date answers.
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-800">Embedded earnings transcripts (narrative)</h4>
                <p className="text-sm">
                  Use this lane for strategy, guidance, risks, and product positioning. Retrieval is chunk-based and metadata-filtered to
                  keep the context grounded and auditable.
                </p>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  <li>
                    <strong className="text-slate-800">Source:</strong> <code className="font-mono">data/transcripts/</code>
                  </li>
                  <li>
                    <strong className="text-slate-800">Tool:</strong> <code className="font-mono">search_earnings_transcript</code>
                  </li>
                  <li>
                    <strong className="text-slate-800">Retrieval:</strong> hybrid search (dense + sparse) to capture both meaning and exact terms.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Fiscal year handling */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <GitBranch className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-800">Fiscal-year handling (and why “latest” is tricky)</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Different companies have different fiscal calendars, so “FY2025” doesn’t always line up across tickers.
              For “latest/recent/current” questions, Clarity prefers fetching the most recent available quarter per ticker.
            </p>

            <p className="text-sm text-slate-600">
              <strong className="text-slate-800">How to ask for clean comparisons:</strong> if you want the latest quarter per company, say
              <span className="font-mono"> “latest”</span> explicitly. If you want apples-to-apples, specify an exact fiscal quarter/year (or constrain
              the analysis window) so the system doesn’t silently compare mismatched periods.
            </p>
          </div>

          {/* Retrieval strategy */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-800">Retrieval strategy: hybrid (dense + sparse)</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Clarity combines <strong>dense vectors</strong> (semantic similarity) with <strong>sparse vectors</strong> (keyword matching).
              This catches both conceptual matches (“AI strategy”) and exact terms (“Q3 FY2025”, “gross margin”, “Blackwell”).
            </p>

            <div className="space-y-3 mb-6 text-slate-600">
              <p className="text-sm">
                <strong className="text-slate-800">Dense vectors:</strong> capture semantic meaning and work well for thematic questions, but they’re
                weak at exact quarter/term matching.
              </p>
              <p className="text-sm">
                <strong className="text-slate-800">Sparse vectors (BM25-style):</strong> catch exact tokens (tickers, quarters, product names) and
                improve precision for metrics and dates. They complement dense retrieval rather than replacing it.
              </p>
            </div>

            <CodeBlock
              title="sparseVectorizer.js (conceptual)"
              language="JavaScript"
              code={`// BM25-style sparse vector generation (conceptual)
const boostTerms = {
  revenue: 1.5, margin: 1.5, growth: 1.5,
  earnings: 1.5, guidance: 1.5, outlook: 1.5
};

function vectorize(text) {
  const tokens = tokenize(text);
  const tf = computeTermFrequency(tokens);
  for (const [term, boost] of Object.entries(boostTerms)) {
    if (tf[term]) tf[term] *= boost;
  }
  return { indices, values };
}`}
            />
          </div>

          {/* Tool use */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-800">Tool orchestration (bounded, evidence-first)</h3>
            </div>
            <p className="text-slate-600 mb-6">
              The model doesn’t “browse the whole dataset.” Instead it calls a small set of tools.
              Tool selection is driven by intent: numeric questions pull structured metrics; narrative questions search transcripts.
            </p>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm bg-white">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-600">
                    <th className="text-left py-3 px-4 font-semibold">Query type</th>
                    <th className="text-left py-3 px-4 font-semibold">Typical tools</th>
                    <th className="text-left py-3 px-4 font-semibold">Evidence source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-4 text-slate-700">Exact metric lookup</td>
                    <td className="py-3 px-4 font-mono text-blue-700">get_financial_metrics</td>
                    <td className="py-3 px-4 text-slate-600">Structured financial JSON</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-700">Trends (“last 4 quarters”)</td>
                    <td className="py-3 px-4 font-mono text-blue-700">get_multi_quarter_metrics</td>
                    <td className="py-3 px-4 text-slate-600">Structured financial JSON</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-700">Strategy / guidance / narrative</td>
                    <td className="py-3 px-4 font-mono text-blue-700">search_earnings_transcript</td>
                    <td className="py-3 px-4 text-slate-600">Transcript chunks (vector search)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-700">Growth deltas (YoY/QoQ)</td>
                    <td className="py-3 px-4 font-mono text-blue-700">compute_growth_rate</td>
                    <td className="py-3 px-4 text-slate-600">Computed from structured metrics</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Streaming */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-800">Streaming UX (Server-Sent Events)</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Clarity uses Server-Sent Events (SSE) so the UI can show progress and stream tokens as they’re generated.
              This reduces “dead time” and makes the pipeline observable.
            </p>

            <div className="grid md:grid-cols-2 gap-6 items-start">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Event types (high-level)</h4>
                <div className="space-y-2 text-sm">
                  {[
                    { type: 'metadata', desc: 'Request ID + dataset freshness' },
                    { type: 'status', desc: 'Human-readable progress (“Analyzing…”)' },
                    { type: 'tool_start', desc: 'A tool began running' },
                    { type: 'tool_result', desc: 'Tool output + latency' },
                    { type: 'content', desc: 'Text tokens/chunks' },
                    { type: 'metrics', desc: 'TTFT, total time, retrieval stats' },
                    { type: 'end', desc: 'Stream complete' }
                  ].map((e) => (
                    <div key={e.type} className="flex items-center gap-2">
                      <code className="text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200">{e.type}</code>
                      <span className="text-slate-600">{e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <CodeBlock
                title="SSE format (example)"
                language="plaintext"
                code={`data: {"type":"status","message":"Analyzing your question..."}

data: {"type":"tool_start","tool":"get_multi_quarter_metrics","id":"auto-financials"}

data: {"type":"tool_result","tool":"get_multi_quarter_metrics","success":true,"latencyMs":312}

data: {"type":"content","content":"Here’s the trend..."}

data: {"type":"metrics","metrics":{"timeToFirstTokenMs":16500,"totalTimeMs":20900}}

data: {"type":"end"}`}
              />
            </div>
          </div>

          {/* Reliability */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-800">Reliability & operational guardrails</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Clarity leans on production patterns that keep responses predictable: validated inputs, bounded tool usage,
              and explicit failure states (including transparent “not found” answers).
            </p>

            <div className="space-y-4 text-slate-600">
              <div className="space-y-2">
                <p className="text-sm">
                  <strong className="text-slate-800">Guardrails:</strong>
                </p>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  <li>Input validation and size limits</li>
                  <li>Tool loop bounds (prevents runaway agent loops)</li>
                  <li>Grounding rules that prefer refusal over hallucination</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm">
                  <strong className="text-slate-800">Troubleshooting tips:</strong>
                </p>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  <li>If an answer is thin, add ticker + quarter/year</li>
                  <li>If you want metrics, name the metric explicitly (“gross margin”, “EPS”)</li>
                  <li>If a provider is overloaded, retry (or the system may fall back to data-only answers)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Metrics (grounded in repo docs) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Gauge className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-800">Measured performance</h3>
            </div>
            <p className="text-slate-600 mb-6">
              These are the concrete performance improvements documented during development (see the project’s improvement notes).
            </p>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm bg-white">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-600">
                    <th className="text-left py-3 px-4 font-semibold">Metric</th>
                    <th className="text-left py-3 px-4 font-semibold">Before</th>
                    <th className="text-left py-3 px-4 font-semibold">After</th>
                    <th className="text-left py-3 px-4 font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-4 text-slate-700">Time to first token (TTFT)</td>
                    <td className="py-3 px-4 font-mono text-slate-700">22.8s</td>
                    <td className="py-3 px-4 font-mono text-slate-700">16.5s</td>
                    <td className="py-3 px-4 text-emerald-700 font-semibold">28% faster</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-700">Total response time</td>
                    <td className="py-3 px-4 font-mono text-slate-700">30.0s</td>
                    <td className="py-3 px-4 font-mono text-slate-700">20.9s</td>
                    <td className="py-3 px-4 text-emerald-700 font-semibold">30% faster</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-slate-700">Retrieval time</td>
                    <td className="py-3 px-4 font-mono text-slate-700">1716ms</td>
                    <td className="py-3 px-4 font-mono text-slate-700">985ms</td>
                    <td className="py-3 px-4 text-emerald-700 font-semibold">~42% faster</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 mt-12">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-slate-500">
          Built with Next.js, Claude, Voyage AI, and Pinecone
        </div>
      </footer>
    </div>
  );
}
