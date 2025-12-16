import fs from 'fs';
import path from 'path';
import Link from 'next/link';

function loadReport() {
  const reportPath = path.join(process.cwd(), '_cleanup', 'evals', 'evaluation_report.json');
  try {
    const raw = fs.readFileSync(reportPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function loadCase({ strategyId, runId, caseId }) {
  const casePath = path.join(
    process.cwd(),
    '_cleanup',
    'evals',
    'evaluation_reports',
    strategyId,
    runId,
    `${caseId}.json`
  );
  if (!fs.existsSync(casePath)) return null;
  try {
    const raw = fs.readFileSync(casePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function formatPercent(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

export default function EvalCasePage({ params, searchParams }) {
  const caseId = params.caseId;
  const report = loadReport();

  const strategyId = searchParams.strategy || report?.strategy_id;
  const runId = searchParams.run || report?.run_id;
  const datasetLabel = report?.dataset || report?.summary?.dataset || 'unknown';

  const orderedIds = (report?.details || []).map((c) => c.id).filter(Boolean);
  const currentIdx = orderedIds.indexOf(caseId);
  const prevId = currentIdx > 0 ? orderedIds[currentIdx - 1] : null;
  const nextId = currentIdx >= 0 && currentIdx < orderedIds.length - 1 ? orderedIds[currentIdx + 1] : null;
  const baseQuery =
    strategyId && runId ? `?run=${encodeURIComponent(runId)}&strategy=${encodeURIComponent(strategyId)}` : '';

  if (!strategyId || !runId) {
    return (
      <NotFound message="Missing run/strategy. Re-run evals to generate evaluation_report.json." />
    );
  }

  const caseData = loadCase({ strategyId, runId, caseId });
  if (!caseData) {
    return <NotFound message="Case not found. Make sure the run and case ID are correct." />;
  }

  const metrics = caseData.metrics || {};
  const timings = caseData.pipeline_metrics?.timings || {};
  const retrieval = caseData.pipeline_metrics?.retrieval || {};
  const fallbacks = caseData.pipeline_metrics?.fallbacks || {};
  const llm = caseData.pipeline_metrics?.llm || {};
  const filtersApplied = retrieval.filtersApplied || caseData.pipeline_metrics?.filtersApplied;
  const contextItems = caseData.context || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-slate-500">Eval case</p>
            <h1 className="text-2xl font-semibold tracking-tight">{caseData.question}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Run {runId} · Strategy {strategyId} · {caseData.category || 'uncategorized'} · Dataset {datasetLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {prevId && (
              <Link
                href={`/evals/${encodeURIComponent(prevId)}${baseQuery}`}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:border-slate-300 transition-colors"
              >
                ← Prev
              </Link>
            )}
            {nextId && (
              <Link
                href={`/evals/${encodeURIComponent(nextId)}${baseQuery}`}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:border-slate-300 transition-colors"
              >
                Next →
              </Link>
            )}
            <Link
              href="/evals"
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              ← Back to evals
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Relevance" value={formatPercent(metrics.relevance?.score)} />
          <MetricCard label="Faithfulness" value={formatPercent(metrics.faithfulness?.score)} />
          <MetricCard label="Accuracy" value={formatPercent(metrics.accuracy?.score)} />
          <MetricCard
            label="Latency"
            value={caseData.duration_ms ? `${caseData.duration_ms} ms` : 'N/A'}
          />
        </div>

        <Section title="Run metadata">
          <div className="flex flex-wrap gap-2 text-xs">
            <Chip label={`Run ${runId}`} />
            <Chip label={`Strategy ${strategyId}`} />
            <Chip label={`Category ${caseData.category || 'uncategorized'}`} />
            <Chip label={`Dataset ${datasetLabel}`} />
            {caseData.context_count !== undefined && <Chip label={`Context ${caseData.context_count}`} />}
          </div>
        </Section>

        <Section title="Key signals">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Retrieval</p>
              <MetricList data={retrieval} />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Fallbacks</p>
              <MetricList data={fallbacks} />
            </div>
          </div>
        </Section>

        <Section title="Ground truth">
          <p className="text-sm text-slate-800">{caseData.ground_truth || 'N/A'}</p>
        </Section>

        <Section title="Generated answer">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">
            {caseData.generated_answer || 'N/A'}
          </p>
        </Section>

        <Section title="Context">
          {contextItems.length > 0 ? (
            <div className="space-y-3">
              {contextItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="rounded-lg border border-slate-200 bg-white shadow-sm p-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                    <div className="flex items-center gap-2">
                      <Chip label={`#${idx + 1}`} />
                      {item.metadata?.company && <Chip label={item.metadata.company} />}
                      {item.metadata?.quarter && <Chip label={`Q ${item.metadata.quarter}`} />}
                      {item.metadata?.fiscalYear && <Chip label={`FY ${item.metadata.fiscalYear}`} />}
                      {item.metadata?.type && <Chip label={item.metadata.type} />}
                      {item.metadata?.retrieval && <Chip label={`retrieval:${item.metadata.retrieval}`} />}
                    </div>
                    <div className="text-xs text-slate-500">Score: {item.score ?? 'N/A'}</div>
                  </div>
                  <details>
                    <summary className="text-sm text-blue-700 cursor-pointer select-none">
                      View text
                    </summary>
                    <pre className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap mt-2">
                      {item.metadata?.text || JSON.stringify(item.metadata || {}, null, 2)}
                    </pre>
                  </details>
                  {item.metadata?.source && (
                    <p className="text-[11px] text-slate-500 mt-1">Source: {item.metadata.source}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No context captured.</p>
          )}

          {caseData.formatted_context && (
            <details className="mt-3">
              <summary className="text-sm text-blue-700 cursor-pointer">View formatted context</summary>
              <pre className="text-xs text-slate-700 bg-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap mt-2">
                {caseData.formatted_context}
              </pre>
            </details>
          )}
        </Section>

        <Section title="Metric reasoning">
          <ReasoningRow label="Relevance" value={metrics.relevance?.reasoning} />
          <ReasoningRow label="Faithfulness" value={metrics.faithfulness?.reasoning} />
          <ReasoningRow label="Accuracy" value={metrics.accuracy?.reasoning} />
        </Section>

        <Section title="Pipeline metrics">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-800">
            <div>
              <p className="font-semibold mb-1">Timings (ms)</p>
              <MetricList data={timings} />
            </div>
            <div>
              <p className="font-semibold mb-1">Retrieval</p>
              <MetricList data={retrieval} />
            </div>
            <div>
              <p className="font-semibold mb-1">Fallbacks</p>
              <MetricList data={fallbacks} />
            </div>
            <div>
              <p className="font-semibold mb-1">LLM usage</p>
              <MetricList data={llm} />
            </div>
            <div>
              <p className="font-semibold mb-1">Filters applied</p>
              <pre className="text-xs text-slate-700 bg-slate-100 rounded-lg p-3 overflow-x-auto">
                {filtersApplied ? JSON.stringify(filtersApplied, null, 2) : 'None'}
              </pre>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      {children}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function Chip({ label }) {
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-700">
      {label}
    </span>
  );
}

function ReasoningRow({ label, value }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">
        {value || 'No reasoning provided.'}
      </p>
    </div>
  );
}

function MetricList({ data }) {
  const entries = Object.entries(data || {});
  if (!entries.length) {
    return <p className="text-sm text-slate-500">No data.</p>;
  }
  return (
    <ul className="text-sm text-slate-800 space-y-1">
      {entries.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-2">
          <span className="text-slate-600">{k}</span>
          <span className="font-medium">{String(v)}</span>
        </li>
      ))}
    </ul>
  );
}

function NotFound({ message }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
      <div className="max-w-xl w-full rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Eval details unavailable</h1>
        <p className="text-sm text-slate-600 mb-4">{message}</p>
        <Link
          href="/evals"
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:border-blue-300 hover:text-blue-700 transition-colors inline-block"
        >
          ← Back to evals
        </Link>
      </div>
    </div>
  );
}

