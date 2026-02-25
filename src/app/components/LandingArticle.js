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

export default function LandingArticle() {
  return (
    <article className="max-w-none">
      <header className="space-y-4">
        <h2
          className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Building Production-Grade RAG in Clarity 3.1
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
          5,000 public companies report quarterly earnings. That&apos;s 20,000 earnings calls a year — 20,000 hours of strategic commentary from management teams explaining what happened, why it happened, and what they think comes next. Each call has two layers that matter: the structured numbers (revenue, margins, guidance) and the narrative around them (competitive positioning, product bets, hedged language about risks). Investors manually reconcile both to build a thesis. It doesn&apos;t scale.
        </p>
        <p className="text-base md:text-lg">
          Clarity 3.1 is an attempt to fix that. It&apos;s a RAG application built on 200+ MegaCap Tech earnings calls — transcripts parsed, cleaned, and embedded in Pinecone alongside structured financial JSON. Instead of reading through filings to find one number or one management quote, you ask a question and get the answer with a source you can verify. &quot;What were NVIDIA&apos;s data center revenues last quarter?&quot; Pull it from structured JSON. &quot;How is management framing competitive positioning in AI chips?&quot; Retrieve the actual transcript chunks. Both in seconds rather than hours.
        </p>
        <p className="text-base md:text-lg">
          The interesting part isn&apos;t the architecture. It&apos;s what breaks.
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
            The numbers matter less than what they represent. Each improvement traces back to a specific failure mode that got fixed — not a prompt rewrite, not a model upgrade.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">What &quot;production-grade&quot; actually meant here</h3>
          <p className="text-slate-700">
            Not scale. The system handles a few hundred queries a day, not millions. &quot;Production-grade&quot; meant: it behaves predictably when the query is ambiguous, the data is incomplete, or retrieval comes back weak. Three concrete requirements fell out of that.
          </p>
          <div className="space-y-2">
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Quality is measurable.</span> Relevance, faithfulness, and accuracy are scored against a fixed golden dataset on every run. The key distinction is that faithfulness and accuracy fail differently — you can be fully grounded but wrong (retrieved Q3 instead of Q4), or correct by accident (the model guessed right with no supporting evidence). Catching those separately matters.
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Performance is measurable.</span> TTFT and total latency are tracked per evaluation run, treated like product metrics. The UX changes qualitatively at different thresholds — ~2s feels instant, ~8s is acceptable, ~15s is where people start abandoning.
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Answers are auditable.</span> The UI shows what was retrieved and which tools ran — not for debugging, but for trust. If a user can see the exact transcript chunk and tool output behind an answer, they can decide whether to trust it. A good answer is one you can <em>inspect</em>: which quarter, which segment, which transcript chunk, which tool output.
            </p>
          </div>
          <p className="text-slate-700">
            The core realization: <span className="font-semibold text-slate-900">RAG quality is mostly decided before generation</span>. Wrong retrieval means the model synthesizes garbage, and it&apos;ll do it confidently. Prompting doesn&apos;t fix evidence selection.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">The queries Clarity is designed for</h3>
          <p className="text-slate-700">
            Each of these maps to a different retrieval path or failure mode.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li>
              <span className="font-semibold text-slate-900">Exact metric (structured JSON lane):</span>{' '}
              &quot;AAPL latest quarter revenue and gross margin&quot;
            </li>
            <li>
              <span className="font-semibold text-slate-900">Trend (multi-quarter structured):</span>{' '}
              &quot;NVDA data center revenue trend over the last 4 quarters&quot;
            </li>
            <li>
              <span className="font-semibold text-slate-900">Strategy narrative (transcripts):</span>{' '}
              &quot;How is Google monetizing AI? Focus on Search + Cloud.&quot;
            </li>
            <li>
              <span className="font-semibold text-slate-900">Executive commentary (hard mode):</span>{' '}
              &quot;What did AMD&apos;s CEO say about AI demand in the latest call?&quot;
            </li>
            <li>
              <span className="font-semibold text-slate-900">Cross-company comparison (hard mode):</span>{' '}
              &quot;Compare MSFT vs GOOGL cloud growth and margins — latest quarter for each.&quot;
            </li>
          </ul>
          <p className="text-sm text-slate-600">
            A practical note: include a ticker and timeframe for numeric questions. Include a topic focus for strategy questions. If the data isn&apos;t there, Clarity should say so rather than interpolating.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">The evaluation loop</h3>
          <p className="text-slate-700">
            Before touching retrieval, I built the evaluation infrastructure: a golden dataset, repeatable runs, and strategy versioning so each change could be tested against a fixed baseline. Without it, &quot;improvements&quot; are anecdotes, and there&apos;s no way to know whether a change helped or just shifted which questions break.
          </p>
          <p className="text-slate-700 font-semibold">What the breakdown revealed</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
            <li><span className="font-semibold text-slate-900">Unanswerable:</span> 80–100% accuracy (refuses to hallucinate)</li>
            <li><span className="font-semibold text-slate-900">Financial:</span> 85–100% accuracy (when the metric exists)</li>
            <li><span className="font-semibold text-slate-900">Strategy:</span> 75–100% accuracy (narrative questions)</li>
            <li><span className="font-semibold text-slate-900">Market/comparison:</span> 30–60% accuracy (hardest category)</li>
            <li><span className="font-semibold text-slate-900">Executive/guidance:</span> 20–60% accuracy (needs better chunking + attribution)</li>
          </ul>
          <p className="text-slate-700">
            The eval dashboard became the source of truth. It made it possible to stop debating and start fixing things in order of how badly they hurt.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Why prompting didn&apos;t help</h3>
          <p className="text-slate-700">
            In early versions, most failures traced back to evidence selection, not generation. When the model was shown the wrong type of context — or no context at all — it did what models do: it tried to be helpful. In finance, &quot;helpful guessing&quot; is the enemy.
          </p>
          <div className="space-y-2">
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Wrong content type:</span> strategy questions retrieved financial context → the model &quot;fills in&quot; narrative → faithfulness collapses.
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Coverage gaps:</span> missing embeddings = no relevant context → plausible-sounding nonsense.
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Exactness misses:</span> dense embeddings blur Q3 vs Q2; &quot;close&quot; semantically is wrong factually.
            </p>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-900">Fiscal calendar traps:</span> &quot;latest quarter&quot; differs across companies; comparisons silently misalign.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">The actual engineering decisions</h3>
          <p className="text-slate-700">
            The improvements came from fixing failure modes in the order they actually hurt users: stop making up numbers, stop retrieving the wrong kind of context, stop confusing quarters, then make it fast and debuggable.
          </p>

          <div className="space-y-6">
            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">1. Separate numbers from narrative</h4>
              <p className="text-slate-700">
                Early on, asking &quot;AAPL latest quarter gross margin&quot; might return a transcript paragraph <em>discussing</em> margins without containing the actual figure. The model would then do what models do when shown partial evidence: fill in the gap. In finance, that&apos;s a hallucination risk, not a rounding error.
              </p>
              <p className="text-slate-700">
                The fix was two evidence lanes: <span className="font-semibold text-slate-900">structured financial JSON</span> for metrics, <span className="font-semibold text-slate-900">transcript chunks</span> for narrative. Numbers come from deterministic tool output, not prose extraction. A Q3 FY2025 gross margin is a lookup, not an inference.
              </p>
              <p className="text-slate-700">
                Trade-off: two retrieval paths to maintain. Worth it — financial questions became reliable, and the failure mode shifted from &quot;wrong number&quot; to &quot;data not available,&quot; which is honest.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">2. Hybrid retrieval for exact terms</h4>
              <p className="text-slate-700">
                Dense embeddings are good at semantic similarity and surprisingly bad at exact match. &quot;Q2 FY2025&quot; and &quot;Q3 FY2025&quot; are semantically close. They are not interchangeable. Ask any earnings analyst.
              </p>
              <p className="text-slate-700">
                Hybrid search — dense + sparse/BM25-style — lets exact tokens matter again. Tickers, product names, period strings. &quot;NVDA Blackwell demand&quot; can still match on semantic similarity; &quot;Q3 FY2025 gross margin&quot; needs to match the exact period, not the adjacent one.
              </p>
              <p className="text-slate-700">
                The cost was index migration and re-embedding work. The payoff was fewer adjacent-quarter retrievals and fewer cases where the model answered confidently from the wrong period.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">3. Per-company fiscal calendars</h4>
              <p className="text-slate-700">
                &quot;Latest quarter&quot; sounds trivial. NVIDIA&apos;s fiscal year ends in January. Most others end in December. &quot;Compare NVDA vs AMD latest quarter&quot; without handling fiscal calendars silently compares mismatched periods — the answer looks right, the comparison is meaningless.
              </p>
              <p className="text-slate-700">
                Clarity resolves &quot;latest&quot; per ticker using the most recent available quarter for that company. When quarters don&apos;t align across a comparison, it surfaces that explicitly rather than quietly proceeding. A silent accuracy bug becomes an auditable edge case.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">4. Fallback chains for structured data extraction</h4>
              <p className="text-slate-700">
                Even &quot;structured&quot; JSON isn&apos;t. Margin fields, EPS fields, and cash flow structures drift across sources and quarters. A single hard-coded extraction path produces false &quot;not found&quot; results because the field moved slightly.
              </p>
              <p className="text-slate-700">
                The fix was explicit fallback chains for each key metric — check primary path, then secondary, then tertiary. Unglamorous. It converts brittle extraction failures into robust retrieval.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">5. Latency as two separate problems</h4>
              <p className="text-slate-700">
                Real latency reduction: fewer unnecessary tool loops, faster retrieval, model selection that fits interactive UX instead of maximizing capability at the cost of speed.
              </p>
              <p className="text-slate-700">
                Perceived latency: streaming status (&quot;analyzing / searching / generating&quot;), tool start events, tool results, end-of-run metrics. People will sit through 10 seconds if they can see what&apos;s happening. They abandon after 3 seconds of a blank screen, even if the answer is coming. Both are real and both need engineering.
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="text-lg font-semibold text-slate-900">6. Route by intent</h4>
              <p className="text-slate-700">
                &quot;What is Google monetizing AI?&quot; and &quot;AAPL Q3 FY2025 gross margin&quot; shouldn&apos;t use the same retrieval path. One is thematic, requiring broad transcript coverage. The other is exact, requiring precision over recall.
              </p>
              <p className="text-slate-700">
                The system classifies intent first: exact numeric queries go hybrid, narrative/strategy queries go dense, multi-part comparative queries get deeper retrieval patterns. It adds branching complexity. It eliminates the &quot;wrong kind of context&quot; failure mode, where a precise metric question returns narrative context the model then has to work around.
              </p>
            </section>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Closing</h3>
          <p className="text-slate-700">
            The lesson isn&apos;t &quot;use hybrid search&quot; or &quot;pick the right model.&quot; It&apos;s that <span className="font-semibold text-slate-900">RAG is systems engineering</span>. The quality ceiling is set by coverage, retrieval design, grounding rules, and how rigorously you measure failure. Once those hold, the model does what it&apos;s actually good at: synthesis.
          </p>
          <p className="text-slate-700">
            The problem is when retrieval is weak enough that the model has to do something else — and in finance, &quot;something else&quot; means guessing, and guessing means wrong numbers presented confidently.
          </p>
          <p className="text-slate-700">
            Fix the retrieval. Measure everything. The model handles the rest.
          </p>
        </section>
      </div>
    </article>
  );
}
