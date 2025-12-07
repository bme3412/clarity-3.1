import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { ScoreCard, StatusBadge } from './components/ui';

export const dynamic = 'force-dynamic';

const REPORTS_DIR = path.join(process.cwd(), 'evaluation_reports');

function getLegacyReport() {
  const reportPath = path.join(process.cwd(), 'evaluation_report.json');
  try {
    if (fs.existsSync(reportPath)) {
      const data = fs.readFileSync(reportPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading evaluation report:', err);
  }
  return null;
}

function getRunSummaries() {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  const entries = fs.readdirSync(REPORTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const runs = [];
  for (const dir of entries) {
    const summaryPath = path.join(REPORTS_DIR, dir, 'run.json');
    if (!fs.existsSync(summaryPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      runs.push({ ...data, run_id: dir });
    } catch (err) {
      console.error(`Failed to parse run summary ${dir}:`, err);
    }
  }

  return runs.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

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

function RunCard({ run }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-muted-foreground">Run ID: {run.run_id}</p>
          <h3 className="text-lg font-semibold">{new Date(run.created_at).toLocaleString()}</h3>
          <p className="text-sm text-muted-foreground">Dataset: {run.dataset}</p>
        </div>
        <Link
          href={`/evaluation/${run.run_id}`}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
        >
          View Report
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge score={run.summary?.avg_relevance ?? 0} />
        <StatusBadge score={run.summary?.avg_faithfulness ?? 0} />
        <StatusBadge score={run.summary?.avg_accuracy ?? 0} />
        <span className="text-xs font-mono text-muted-foreground">
          Cases: {run.total_cases}
        </span>
        {run.summary?.avg_latency_ms != null && (
          <span className="text-xs font-mono text-muted-foreground">
            Avg latency: {formatMs(run.summary.avg_latency_ms)}
          </span>
        )}
        {run.summary?.avg_input_tokens != null && (
          <span className="text-xs font-mono text-muted-foreground">
            Tokens: in {formatTokens(run.summary.avg_input_tokens)} / out {formatTokens(run.summary.avg_output_tokens ?? 0)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function EvaluationPage() {
  const runs = getRunSummaries();

  if (runs.length === 0) {
    const legacy = getLegacyReport();

    if (!legacy) {
      return (
        <div className="min-h-screen bg-background text-foreground p-8 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">No Evaluation Runs Found</h1>
            <p className="text-muted-foreground">
              Run <code className="font-mono">node scripts/evaluate-rag.js</code> to generate the first report.
            </p>
          </div>
        </div>
      );
    }

    const { summary, details, timestamp } = legacy;

    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <div className="max-w-6xl mx-auto p-6 md:p-12">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">RAG Evaluation Report</h1>
            <p className="text-sm text-muted-foreground font-mono">
              Last Run: {new Date(timestamp).toLocaleString()}
            </p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <ScoreCard label="Relevance" value={summary.avg_relevance} colorClass="text-blue-500" />
            <ScoreCard label="Faithfulness" value={summary.avg_faithfulness} colorClass="text-purple-500" />
            <ScoreCard label="Accuracy" value={summary.avg_accuracy} colorClass="text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            Legacy view detected. Generate a new run to unlock per-query drill downs.
          </p>
        </div>
      </div>
    );
  }

  const latestRun = runs[0];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-7xl mx-auto p-6 md:p-12 space-y-12">
        <header className="border border-border rounded-2xl p-6 bg-card shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Latest Run
              </p>
              <h1 className="text-3xl font-bold tracking-tight">
                {new Date(latestRun.created_at).toLocaleString()}
              </h1>
              <p className="text-sm text-muted-foreground">
                Dataset: {latestRun.dataset} • {latestRun.total_cases} cases
              </p>
              <div className="flex flex-wrap gap-3 text-xs font-mono text-muted-foreground">
                {latestRun.summary?.avg_latency_ms != null && (
                  <span>Avg latency: {formatMs(latestRun.summary.avg_latency_ms)}</span>
                )}
                {latestRun.summary?.avg_input_tokens != null && (
                  <span>
                    Tokens in/out: {formatTokens(latestRun.summary.avg_input_tokens)} /{' '}
                    {formatTokens(latestRun.summary.avg_output_tokens ?? 0)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/rag-lab"
                className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted"
              >
                RAG Lab
              </Link>
              <Link
                href="/how-it-works"
                className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted"
              >
                How It Works
              </Link>
              <Link
                href={`/evaluation/${latestRun.run_id}`}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold text-center"
              >
                View Detailed Report
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
            <ScoreCard label="Relevance" value={latestRun.summary?.avg_relevance ?? 0} colorClass="text-blue-500" />
            <ScoreCard label="Faithfulness" value={latestRun.summary?.avg_faithfulness ?? 0} colorClass="text-purple-500" />
            <ScoreCard label="Accuracy" value={latestRun.summary?.avg_accuracy ?? 0} colorClass="text-emerald-500" />
            <ScoreCard
              label="Avg Latency"
              value={latestRun.summary?.avg_latency_ms ? latestRun.summary.avg_latency_ms / 1000 : 0}
              suffix="s"
              colorClass="text-amber-500"
            />
            <ScoreCard
              label="Avg Input Tokens"
              value={latestRun.summary?.avg_input_tokens ?? 0}
              colorClass="text-slate-500"
            />
          </div>
        </header>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Evaluation Runs</h2>
              <p className="text-sm text-muted-foreground">Click into any run to explore per-query metrics.</p>
            </div>
            <p className="text-xs font-mono text-muted-foreground">{runs.length} run(s) stored</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {runs.map((run) => (
              <RunCard key={run.run_id} run={run} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
