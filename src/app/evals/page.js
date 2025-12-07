import fs from 'fs';
import path from 'path';
import Link from 'next/link';

function loadReport() {
  const reportPath = path.join(process.cwd(), 'evaluation_report.json');
  try {
    const raw = fs.readFileSync(reportPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function formatPercent(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

export default function EvalsPage() {
  const report = loadReport();
  const summary = report?.summary;
  const runId = report?.run_id;
  const strategyId = report?.strategy_id;
  const cases = report?.details || [];
  const showCount = Math.min(cases.length, 100); // keep page light
  const sampleCases = cases.slice(0, showCount);
  const datasetLabel = report?.dataset || report?.summary?.dataset || 'unknown';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-slate-500">RAG Evaluation Dashboard</p>
            <h1 className="text-3xl font-semibold tracking-tight">Latest Eval Run</h1>
            {report?.run_id && (
              <p className="text-sm text-slate-500 mt-1">
                Run {report.run_id} · {report.timestamp}
              </p>
            )}
          </div>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            ← Back to app
          </Link>
        </div>

        {!summary && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
            <p className="text-slate-600">
              No evaluation_report.json found yet. Run{' '}
              <code className="px-2 py-1 bg-slate-100 rounded">npm run eval:full</code>{' '}
              to generate it.
            </p>
          </div>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard label="Relevance" value={formatPercent(summary.avg_relevance)} />
              <MetricCard label="Faithfulness" value={formatPercent(summary.avg_faithfulness)} />
              <MetricCard label="Accuracy" value={formatPercent(summary.avg_accuracy)} />
              <MetricCard
                label="Avg Latency"
                value={
                  summary.timings_ms?.totalMs
                    ? `${summary.timings_ms.totalMs.toFixed(0)} ms`
                    : 'N/A'
                }
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Eval cases</h2>
                  <p className="text-sm text-slate-500">
                    Showing {sampleCases.length} of {cases.length} total cases
                  </p>
                </div>
                <div className="text-sm text-slate-500">
                  Dataset: {datasetLabel}
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {sampleCases.map((c) => (
                  <CaseRow key={c.id} item={c} runId={runId} strategyId={strategyId} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
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

function CaseRow({ item, runId, strategyId }) {
  const href =
    runId && strategyId
      ? `/evals/${encodeURIComponent(item.id)}?run=${encodeURIComponent(runId)}&strategy=${encodeURIComponent(strategyId)}`
      : undefined;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          {href ? (
            <Link href={href} className="text-sm font-medium text-blue-700 hover:underline">
              {item.question}
            </Link>
          ) : (
            <p className="text-sm font-medium text-slate-900">{item.question}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            {item.category || 'uncategorized'} · {item.duration_ms ? `${item.duration_ms} ms` : ''}
          </p>
        </div>
        <div className="flex gap-3 text-sm text-slate-700">
          <Badge label="Rel" value={formatPercent(item.metrics?.relevance?.score)} />
          <Badge label="Faith" value={formatPercent(item.metrics?.faithfulness?.score)} />
          <Badge label="Acc" value={formatPercent(item.metrics?.accuracy?.score)} />
        </div>
      </div>
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700">
      <span className="text-[11px] uppercase tracking-wide font-semibold">{label}</span>
      <span className="text-[12px] font-semibold">{value}</span>
    </span>
  );
}

