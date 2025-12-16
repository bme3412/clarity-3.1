import React from 'react';

function MetricTable({ title, rows }) {
  return (
    <section className="space-y-3">
      {title ? <h3 className="text-lg font-semibold text-slate-900">{title}</h3> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left py-2.5 px-3 font-semibold">Metric</th>
              <th className="text-right py-2.5 px-3 font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.metric} className={`border-t border-slate-100 ${idx % 2 ? 'bg-slate-50/30' : 'bg-white'}`}>
                <td className="py-2.5 px-3 text-slate-800">{r.metric}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeltaTable({ title, columns, rows }) {
  return (
    <section className="space-y-3">
      {title ? <h3 className="text-lg font-semibold text-slate-900">{title}</h3> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`py-2.5 px-3 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.metric} className={`border-t border-slate-100 ${idx % 2 ? 'bg-slate-50/30' : 'bg-white'}`}>
                <td className="py-2.5 px-3 text-slate-800">{r.metric}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">{r.baseline}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">{r.current}</td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">{r.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LabeledParagraph({ label, children }) {
  return (
    <p className="text-slate-700 leading-relaxed">
      <span className="font-semibold text-slate-900">{label}: </span>
      {children}
    </p>
  );
}

function Decision({ number, title, problem, change, tradeoff, impact }) {
  return (
    <section className="space-y-2">
      <h4 className="text-lg font-semibold text-slate-900">
        {number}. {title}
      </h4>
      <div className="space-y-1.5">
        <LabeledParagraph label="Problem">{problem}</LabeledParagraph>
        <LabeledParagraph label="Change">{change}</LabeledParagraph>
        <LabeledParagraph label="Trade-off">{tradeoff}</LabeledParagraph>
        <LabeledParagraph label="Impact">{impact}</LabeledParagraph>
      </div>
    </section>
  );
}

export default function LandingArticle() {
  return (
    <article className="max-w-none">
      <header className="space-y-4">
        <h2
          className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Building Production-Grade RAG in Clarity 3.0
        </h2>
        <p className="text-base md:text-lg font-semibold text-slate-800">
          The engineering decisions that moved accuracy, faithfulness, and latency in a financial-intelligence RAG system
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
          <span className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50">10 min read</span>
          <span className="text-slate-300" aria-hidden="true">•</span>
          <span className="text-slate-500">
            <span className="uppercase tracking-wider text-slate-400">Published</span>{' '}
            <span className="font-semibold text-slate-600">Dec 10, 2025</span>
          </span>
        </div>
      </header>

      <div className="mt-8 space-y-6 text-slate-700 leading-relaxed">
        <p className="text-base md:text-lg">
          Approximately 5,000 publicly traded companies report quarterly earnings, generating 20,000 earnings calls annually—representing 20,000 hours of strategic commentary (833 days of continuous listening, or 2.28 years). Each call contains two distinct but interconnected data streams: structured financial results (revenue, margins, guidance) and unstructured narrative commentary (management insights, market positioning, risk factors, strategic priorities). Traditionally, investors manually sift through both quantitative metrics and qualitative discourse to build investment theses—a process that&apos;s time-intensive and doesn&apos;t scale.
        </p>
        <p className="text-base md:text-lg">
          This massive corpus of financial data and strategic commentary can be transformed into embeddings and semantically analyzed at scale. Clarity 3.0 demonstrates this approach: it&apos;s an enterprise-grade RAG application that has ingested 200+ MegaCap Tech earnings calls—both the structured financials and full transcript narratives—parsed, cleaned, and converted into vector embeddings stored in a Pinecone database. Users can query both dimensions of the data: &quot;What were NVIDIA&apos;s data center revenues last quarter?&quot; (quantitative) or &quot;How is management describing competitive positioning in AI chips?&quot; (qualitative narrative analysis).
        </p>
        <p className="text-base md:text-lg">
          The goal is simple: save time and leverage AI to write semantically robust queries that retrieve precise information from the vector database—whether that&apos;s specific financial metrics, thematic commentary patterns, or cross-company competitive analysis—in seconds rather than hours of manual review.
        </p>
        <p className="text-base md:text-lg">
          Key focuses for the app include: accuracy first—ensuring the right context is retrieved from 200+ earnings calls and correctly incorporated into generated responses—then optimize for speed. I built comprehensive evaluation systems to continuously monitor retrieval quality and response accuracy, catching hallucinations or misattributed data before they reach users. But latency matters too: enterprise users expect sub-3-second responses, not 30-second waits. The rest of this article covers the engineering decisions—and trade-offs—that balance these competing demands: maximizing retrieval precision while maintaining production-grade response times.
        </p>

        <section className="space-y-4">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Current performance</h3>
          <MetricTable
            title="Latest evaluation run (December 10, 2025)"
            rows={[
              { metric: 'Relevance', value: '82.1%' },
              { metric: 'Faithfulness', value: '89.5%' },
              { metric: 'Accuracy', value: '79.5%' },
              { metric: 'Avg latency', value: '8.8s' },
            ]}
          />
          <DeltaTable
            title="Baseline → current"
            columns={[
              { key: 'metric', label: 'Metric', align: 'left' },
              { key: 'baseline', label: 'Baseline', align: 'right' },
              { key: 'current', label: 'Current', align: 'right' },
              { key: 'change', label: 'Change', align: 'right' },
            ]}
            rows={[
              { metric: 'Relevance', baseline: '77.3%', current: '82.1%', change: '+4.8pp' },
              { metric: 'Faithfulness', baseline: '77.0%', current: '89.5%', change: '+12.5pp' },
              { metric: 'Accuracy', baseline: '65.0%', current: '79.5%', change: '+14.5pp' },
              { metric: 'Latency', baseline: '19.5s', current: '8.8s', change: '55% faster' },
            ]}
          />
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">Note:</span> The bigger win wasn’t “number go up.” It was learning{' '}
            <span className="italic">which questions fail and why</span>, and fixing the system bottlenecks upstream of generation.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Focus on “production-grade”</h3>
          <p className="text-slate-700">
            For Clarity, “production‑grade” didn’t mean scale. It meant the system behaves predictably under real usage, even when the query is ambiguous,
            the data is incomplete, or retrieval returns weak evidence. In practice, that translated to three requirements: quality is measurable, performance
            is measurable, and the answer is explainable (so you can verify it without trusting the model’s tone).
          </p>
          <div className="space-y-2">
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Measurable quality:</span> relevance, faithfulness, and accuracy are scored against a fixed golden dataset.
              The key nuance is that faithfulness and accuracy fail differently: you can be grounded but wrong (retrieved the wrong quarter), or correct by accident (guessed right with no evidence).
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Measurable performance:</span> TTFT and total latency are tracked per run.
              I treat latency like a product metric because the UX changes completely once responses cross “feels instant” thresholds (e.g. ~2s, ~8s, ~15s).
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Operational trust:</span> the UI shows what was retrieved and which tools ran — so you can audit the evidence behind the answer.
              A good answer is one you can <em>inspect</em>: which quarter, which segment, which transcript chunk, which tool output.
            </p>
          </div>
          <p className="text-slate-700">
            The core realization is simple: <span className="font-semibold text-slate-900">RAG quality is mostly decided before generation</span>.
            If retrieval is wrong, prompting can’t save you — the model can only synthesize what’s on the desk.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Example queries:</h3>
          <p className="text-slate-700">
            These are the kinds of prompts Clarity is designed for — each one maps to a specific retrieval path or failure mode.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>
              <span className="font-semibold text-slate-900">Exact metric (structured JSON lane):</span>{' '}
              “AAPL latest quarter revenue and gross margin”
            </li>
            <li>
              <span className="font-semibold text-slate-900">Trend (multi-quarter structured):</span>{' '}
              “NVDA data center revenue trend over the last 4 quarters”
            </li>
            <li>
              <span className="font-semibold text-slate-900">Strategy narrative (transcripts):</span>{' '}
              “How is Google monetizing AI? Focus on Search + Cloud.”
            </li>
            <li>
              <span className="font-semibold text-slate-900">Executive commentary (hard mode):</span>{' '}
              “What did AMD’s CEO say about AI demand in the latest call?”
            </li>
            <li>
              <span className="font-semibold text-slate-900">Cross-company comparison (hard mode):</span>{' '}
              “Compare MSFT vs GOOGL cloud growth and margins — latest quarter for each.”
            </li>
          </ul>
          <p className="text-sm text-slate-600">
            Best practice: include a ticker and timeframe for numbers, and include a topic focus for strategy questions. If the data isn’t available,
            Clarity should say so rather than guessing.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">The evaluation loop:</h3>
          <p className="text-slate-700">
            Before making “clever” retrieval changes, I built evaluation infrastructure: a golden dataset, repeatable runs, and strategy versioning so each
            change was testable and reversible. The goal was to stop debating improvements and start shipping the ones that moved specific metrics.
          </p>
          <p className="text-slate-700 font-semibold">What the breakdown revealed</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li><span className="font-semibold text-slate-900">Unanswerable:</span> mostly 80–100% accuracy (refuses to hallucinate)</li>
            <li><span className="font-semibold text-slate-900">Financial:</span> 85–100% accuracy (when the metric exists)</li>
            <li><span className="font-semibold text-slate-900">Strategy:</span> 75–100% accuracy (narrative questions)</li>
            <li><span className="font-semibold text-slate-900">Market/comparison:</span> 30–60% accuracy (hardest category)</li>
            <li><span className="font-semibold text-slate-900">Executive/guidance:</span> 20–60% accuracy (needs better chunking + attribution)</li>
          </ul>
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">Why this mattered:</span> without a fixed dataset and repeatable runs, “improvements” are just anecdotes.
            The eval dashboard became the source of truth that made it possible to actually iterate.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Baseline failure modes - why prompting didn&apos;t help:</h3>
          <p className="text-slate-700">
            In early versions, most failures traced back to evidence selection, not generation. When the model was shown the wrong type of context — or no context at all —
            it did what models do: it tried to be helpful. In finance, “helpful guessing” is the enemy.
          </p>
          <div className="space-y-2">
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Wrong content type:</span> strategy questions retrieved financial context → the model “fills in” narrative → faithfulness collapses.
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Coverage gaps:</span> missing embeddings = no relevant context → plausible-sounding nonsense.
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Exactness misses:</span> dense embeddings blur Q3 vs Q2; “close” semantically is wrong factually.
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Fiscal calendar traps:</span> “latest quarter” differs across companies; comparisons silently misalign.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Engineered decisions:</h3>
          <p className="text-slate-700">
            I didn’t “prompt my way” to better results. The improvements came from fixing failure modes in the order they actually hurt users:
            stop making up numbers, stop retrieving the wrong kind of context, stop confusing quarters, then make it fast and debuggable.
          </p>

          <div className="space-y-6">
            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">1) Separate numbers from narrative</h4>
              <p className="text-slate-700">
                Early on, numeric questions behaved like a trap. If you asked “AAPL latest quarter gross margin,” the system might retrieve a transcript paragraph
                that <em>talks about margins</em> but doesn’t contain the number — and the model would guess anyway.
              </p>
              <p className="text-slate-700">
                The fix was to split evidence into two lanes: <span className="font-semibold text-slate-900">structured financial JSON</span> for metrics, and
                <span className="font-semibold text-slate-900"> transcript chunks</span> for narrative. Numbers come from deterministic tool output, not from text.
              </p>
              <p className="text-slate-700">
                Result: financial questions became reliable (when the data exists) because the model is no longer asked to “extract” precise numbers from messy prose.
                The cost is maintaining two retrieval paths, but it’s worth it.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">2) Add hybrid retrieval for exact terms</h4>
              <p className="text-slate-700">
                Dense retrieval is great for “what does this mean?” and surprisingly bad for “which quarter did you mean?” Dense embeddings happily treat Q2 and Q3 as
                “close,” which is fatal in finance.
              </p>
              <p className="text-slate-700">
                Hybrid search (dense + sparse/BM25-style) fixes that by letting exact tokens matter again — tickers, product names, and period strings like “Q3 FY2025.”
                Example: “NVDA Blackwell demand” should still hit semantically relevant text, but “Q3 FY2025 gross margin” must match the exact period.
              </p>
              <p className="text-slate-700">
                The trade-off is index migration and re-embedding work. The payoff is fewer “adjacent quarter” retrievals and fewer confident-but-wrong answers.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">3) Teach the system what “latest” means (per company)</h4>
              <p className="text-slate-700">
                “Latest quarter” sounds simple until you compare companies with different fiscal calendars. Without fiscal-year intelligence, “Compare NVDA vs AMD latest quarter”
                can silently compare mismatched periods.
              </p>
              <p className="text-slate-700">
                Clarity resolves “latest” per ticker using the most recent available quarter for that company and surfaces the risk when quarters don’t align.
                That turns a silent accuracy bug into an explicit, fixable behavior.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">4) Harden structured data extraction (because “structured” isn’t)</h4>
              <p className="text-slate-700">
                Even the financial JSON isn’t perfectly consistent. Margin and EPS fields drift across sources and quarters, so a single hard-coded path produces false
                “not found” results.
              </p>
              <p className="text-slate-700">
                The fix was explicit fallback chains for key metrics. It’s not glamorous, but it converts brittle failures into robust retrieval.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">5) Treat latency as two separate problems</h4>
              <p className="text-slate-700">
                Real latency is reducing wasted work: fewer unnecessary tool loops, faster retrieval, and an LLM choice that fits interactive UX.
                Perceived latency is making the system legible while it works.
              </p>
              <p className="text-slate-700">
                That’s why Clarity streams status (“analyzing / searching / generating”), tool start/results, and end-of-run metrics. People tolerate 10 seconds when they can
                see what’s happening — they abandon after 3 seconds of a blank screen.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">6) Route queries by intent (instead of one-size-fits-all)</h4>
              <p className="text-slate-700">
                “What is Google monetizing AI?” and “AAPL Q3 FY2025 gross margin” should not use the same retrieval behavior. One is thematic; the other is exact.
              </p>
              <p className="text-slate-700">
                The system routes by intent: precision/hybrid for exact terms, dense for narrative strategy, and deeper retrieval patterns for multi-part asks.
                It adds branching, but it avoids “wrong kind of context” failures.
              </p>
            </section>
          </div>
        </section>

        

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Closing thought</h3>
          <p className="text-slate-700">
            The lesson isn’t “hybrid search wins” or “use model X.” It’s this: <span className="font-semibold text-slate-900">RAG is systems engineering</span>.
          </p>
          <p className="text-slate-700">
            Quality comes from coverage, retrieval, grounding rules, and evaluation discipline. Once those are strong, the model becomes what it should be:
            a synthesis engine — not a guesser.
          </p>
        </section>
      </div>
    </article>
  );
}

