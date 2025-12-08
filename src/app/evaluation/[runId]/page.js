import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ScoreCard, StatusBadge } from '../components/ui';

function formatMs(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms > 2000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

function formatTokens(tokens) {
  if (!tokens && tokens !== 0) return '—';
  if (tokens > 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

export const dynamic = 'force-dynamic';

const REPORTS_DIR = path.join(process.cwd(), 'evaluation_reports');

function loadRun(runId) {
  const summaryPath = path.join(REPORTS_DIR, runId, 'run.json');
  if (!fs.existsSync(summaryPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    return { ...data, run_id: runId };
  } catch (err) {
    console.error(`Failed to read run ${runId}:`, err);
    return null;
  }
}

export default function RunDetailPage({ params }) {
  const { runId } = params;
  const run = loadRun(runId);

  if (!run) {
    notFound();
  }

  const cases = run.cases || [];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Run ID</p>
            <h1 className="text-3xl font-bold tracking-tight">{run.run_id}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(run.created_at).toLocaleString()} • Dataset: {run.dataset}
            </p>
            <div className="flex flex-wrap gap-3 text-xs font-mono text-muted-foreground mt-1">
              {run.summary?.avg_latency_ms != null && (
                <span>Avg latency: {formatMs(run.summary.avg_latency_ms)}</span>
              )}
              {run.summary?.avg_input_tokens != null && (
                <span>
                  Tokens in/out: {formatTokens(run.summary.avg_input_tokens)} /{' '}
                  {formatTokens(run.summary.avg_output_tokens ?? 0)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/evaluation" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Runs
            </Link>
            <Link href="/how-it-works" className="text-sm text-violet-600 hover:text-violet-700">
              How It Works
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreCard label="Relevance" value={run.summary?.avg_relevance ?? 0} colorClass="text-blue-500" />
          <ScoreCard label="Faithfulness" value={run.summary?.avg_faithfulness ?? 0} colorClass="text-purple-500" />
          <ScoreCard label="Accuracy" value={run.summary?.avg_accuracy ?? 0} colorClass="text-emerald-500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreCard
            label="Avg Latency"
            value={run.summary?.avg_latency_ms ? run.summary.avg_latency_ms / 1000 : 0}
            suffix="s"
            colorClass="text-amber-500"
          />
          <ScoreCard
            label="Avg Input Tokens"
            value={run.summary?.avg_input_tokens ?? 0}
            colorClass="text-slate-500"
          />
          <ScoreCard
            label="Avg Output Tokens"
            value={run.summary?.avg_output_tokens ?? 0}
            colorClass="text-slate-500"
          />
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Test Cases</h2>
            <p className="text-xs font-mono text-muted-foreground">{cases.length} case(s)</p>
          </div>

          {cases.length === 0 && (
            <p className="text-sm text-muted-foreground">No cases recorded for this run.</p>
          )}

          <div className="space-y-4">
            {cases.map((testCase) => (
              <div key={testCase.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">Case ID: {testCase.id}</p>
                    <h3 className="text-lg font-semibold">{testCase.question}</h3>
                    <p className="text-xs text-muted-foreground">
                      Duration: {formatMs(testCase.duration_ms)} • Context chunks: {testCase.context_count}
                      {testCase.metrics?.tokens && (
                        <>
                          {' '}• Tokens in/out:{' '}
                          {formatTokens(testCase.metrics.tokens.input ?? 0)} / {formatTokens(testCase.metrics.tokens.output ?? 0)}
                        </>
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/evaluation/${run.run_id}/${testCase.id}`}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                  >
                    View Details
                  </Link>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase text-muted-foreground">Relevance</span>
                    <StatusBadge score={testCase.metrics?.relevance?.score ?? 0} />
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase text-muted-foreground">Faithfulness</span>
                    <StatusBadge score={testCase.metrics?.faithfulness?.score ?? 0} />
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase text-muted-foreground">Accuracy</span>
                    <StatusBadge score={testCase.metrics?.accuracy?.score ?? 0} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}


