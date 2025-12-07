import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ScoreCard, StatusBadge } from '../../components/ui';

export const dynamic = 'force-dynamic';

const REPORTS_DIR = path.join(process.cwd(), 'evaluation_reports');

function loadCase(runId, caseId) {
  const casePath = path.join(REPORTS_DIR, runId, `${caseId}.json`);
  if (!fs.existsSync(casePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(casePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse case ${caseId} for run ${runId}:`, err);
    return null;
  }
}

export default function CaseDetailPage({ params }) {
  const { runId, caseId } = params;
  const caseData = loadCase(runId, caseId);

  if (!caseData) {
    notFound();
  }

  const metrics = caseData.metrics || {};
  const contextItems = caseData.context || [];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-mono text-muted-foreground">Run ID: {runId}</p>
            <h1 className="text-3xl font-bold tracking-tight">Case {caseId}</h1>
            <p className="text-sm text-muted-foreground">Question: {caseData.question}</p>
          </div>
          <div className="flex flex-col text-right text-sm text-muted-foreground">
            <Link href={`/evaluation/${runId}`} className="hover:text-foreground">
              ← Back to Run
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreCard label="Relevance" value={metrics.relevance?.score ?? 0} colorClass="text-blue-500" />
          <ScoreCard label="Faithfulness" value={metrics.faithfulness?.score ?? 0} colorClass="text-purple-500" />
          <ScoreCard label="Accuracy" value={metrics.accuracy?.score ?? 0} colorClass="text-emerald-500" />
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                Generated Answer
              </h2>
              <div className="prose prose-sm dark:prose-invert bg-muted/20 p-4 rounded-lg border border-border text-sm leading-relaxed whitespace-pre-wrap">
                {caseData.generated_answer}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                Ground Truth
              </h2>
              <div className="bg-green-500/5 p-4 rounded-lg border border-green-500/10 text-sm whitespace-pre-wrap">
                {caseData.ground_truth}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">Reasoning</h2>
            <div className="space-y-3">
              <div className="p-3 rounded border border-blue-500/10 bg-blue-500/5">
                <div className="text-xs font-bold text-blue-500 mb-1">RELEVANCE</div>
                <p className="text-xs text-muted-foreground">{metrics.relevance?.reasoning}</p>
              </div>
              <div className="p-3 rounded border border-purple-500/10 bg-purple-500/5">
                <div className="text-xs font-bold text-purple-500 mb-1">FAITHFULNESS</div>
                <p className="text-xs text-muted-foreground">{metrics.faithfulness?.reasoning}</p>
              </div>
              <div className="p-3 rounded border border-emerald-500/10 bg-emerald-500/5">
                <div className="text-xs font-bold text-emerald-500 mb-1">ACCURACY</div>
                <p className="text-xs text-muted-foreground">{metrics.accuracy?.reasoning}</p>
              </div>
            </div>
            <div className="text-xs font-mono text-muted-foreground border-t border-border pt-4">
              Duration: {caseData.duration_ms}ms • Context Chunks: {caseData.context_count}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Retrieved Context</h2>
            <p className="text-sm text-muted-foreground">
              Showing {contextItems.length} chunk(s) merged into the final answer.
            </p>
          </div>

          {contextItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No context was captured for this case.</p>
          )}

          <div className="space-y-4">
            {contextItems.map((chunk, idx) => (
              <div key={chunk.id || idx} className="border border-border rounded-xl p-4 bg-card/50 space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                  <span>Score: {chunk.score?.toFixed(3) ?? 'N/A'}</span>
                  {chunk.metadata?.retrieval && (
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                      {chunk.metadata.retrieval}
                    </span>
                  )}
                  {chunk.metadata?.company && <span>{chunk.metadata.company}</span>}
                  {chunk.metadata?.quarter && chunk.metadata?.fiscalYear && (
                    <span>{chunk.metadata.quarter} {chunk.metadata.fiscalYear}</span>
                  )}
                  {chunk.metadata?.type && <span>{chunk.metadata.type}</span>}
                </div>
                {chunk.metadata?.source && (
                  <p className="text-[11px] font-mono text-muted-foreground">Source: {chunk.metadata.source}</p>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {chunk.metadata?.text || 'No text available'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}


