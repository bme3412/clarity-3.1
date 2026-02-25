'use client';

import { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function clamp01(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return null;
  return Math.max(0, Math.min(1, x));
}

function formatPercent(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function scoreBucket(score, threshold) {
  if (score === null || score === undefined) return 'na';
  if (score >= threshold) return 'good';
  if (score >= threshold - 0.2) return 'warn';
  return 'bad';
}

function Badge({ label, value, tone }) {
  const toneClass =
    tone === 'good'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : tone === 'bad'
          ? 'bg-rose-50 text-rose-800 border-rose-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${toneClass}`}>
      <span className="text-[11px] uppercase tracking-wide font-semibold">{label}</span>
      <span className="text-[12px] font-semibold">{value}</span>
    </span>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
      >
        {children}
      </select>
    </label>
  );
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span className="font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}

export default function EvalsDashboardClient({
  caseSummaries,
  runId,
  strategyId,
  datasetLabel,
  defaultThreshold = 0.8
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'worst';
  const order = searchParams.get('order') || 'asc';
  const failuresOnly = (searchParams.get('failuresOnly') || '0') === '1';
  const threshold = clamp01(searchParams.get('threshold')) ?? defaultThreshold;

  const setParam = useCallback(
    (key, value) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value === null || value === undefined || value === '' || value === 'all') {
        sp.delete(key);
      } else {
        sp.set(key, String(value));
      }
      router.push(`/evals?${sp.toString()}`);
    },
    [router, searchParams]
  );

  const categories = useMemo(() => {
    const set = new Set();
    for (const c of caseSummaries) set.add(c.category || 'uncategorized');
    return ['all', ...Array.from(set).sort()];
  }, [caseSummaries]);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    for (const c of caseSummaries) {
      const key = c.category || 'uncategorized';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [caseSummaries]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const byCategory = category === 'all' ? null : category;

    return caseSummaries.filter((c) => {
      if (byCategory && (c.category || 'uncategorized') !== byCategory) return false;
      if (query) {
        const hay = `${c.question || ''} ${c.id || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (failuresOnly) {
        const rel = c.scores?.relevance ?? null;
        const faith = c.scores?.faithfulness ?? null;
        const acc = c.scores?.accuracy ?? null;
        const min = [rel, faith, acc].filter((v) => v !== null && v !== undefined);
        const minScore = min.length ? Math.min(...min) : null;
        if (minScore === null) return false;
        if (minScore >= threshold) return false;
      }
      return true;
    });
  }, [caseSummaries, q, category, failuresOnly, threshold]);

  const sorted = useMemo(() => {
    const rows = [...filtered];

    const getSortValue = (c) => {
      if (sort === 'relevance') return c.scores?.relevance ?? -1;
      if (sort === 'faithfulness') return c.scores?.faithfulness ?? -1;
      if (sort === 'accuracy') return c.scores?.accuracy ?? -1;
      if (sort === 'latency') return c.duration_ms ?? Number.POSITIVE_INFINITY;
      // default: worst-case (min score across core metrics)
      const rel = c.scores?.relevance ?? null;
      const faith = c.scores?.faithfulness ?? null;
      const acc = c.scores?.accuracy ?? null;
      const vals = [rel, faith, acc].filter((v) => v !== null && v !== undefined);
      return vals.length ? Math.min(...vals) : -1;
    };

    rows.sort((a, b) => {
      const av = getSortValue(a);
      const bv = getSortValue(b);
      if (av === bv) return (a.id || '').localeCompare(b.id || '');
      return order === 'asc' ? av - bv : bv - av;
    });

    return rows;
  }, [filtered, sort, order]);

  const totals = useMemo(() => {
    const all = caseSummaries.length;
    const shown = sorted.length;
    const failures = caseSummaries.filter((c) => {
      const rel = c.scores?.relevance ?? null;
      const faith = c.scores?.faithfulness ?? null;
      const acc = c.scores?.accuracy ?? null;
      const vals = [rel, faith, acc].filter((v) => v !== null && v !== undefined);
      const min = vals.length ? Math.min(...vals) : null;
      return min !== null && min < threshold;
    }).length;
    return { all, shown, failures };
  }, [caseSummaries, sorted, threshold]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <TextInput
              label="Search"
              value={q}
              onChange={(v) => setParam('q', v)}
              placeholder="Search question or case id…"
            />

            <Select label="Category" value={category} onChange={(v) => setParam('category', v)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <Select label="Sort by" value={sort} onChange={(v) => setParam('sort', v)}>
              <option value="worst">Worst score</option>
              <option value="relevance">Relevance</option>
              <option value="faithfulness">Faithfulness</option>
              <option value="accuracy">Accuracy</option>
              <option value="latency">Latency</option>
            </Select>

            <Select label="Order" value={order} onChange={(v) => setParam('order', v)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </Select>

            <label className="flex flex-col gap-1 text-xs text-slate-600">
              <span className="font-medium">Failure threshold</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={threshold}
                onChange={(e) => setParam('threshold', e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
              />
            </label>
          </div>

          <div className="flex items-center gap-4 justify-between lg:justify-end">
            <Toggle label="Only failures" checked={failuresOnly} onChange={(v) => setParam('failuresOnly', v ? '1' : '0')} />
            <Link href="/rag-strategy" className="text-sm font-medium text-blue-700 hover:underline">
              RAG strategy →
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">
            Showing <span className="font-semibold text-slate-900">{totals.shown}</span> of{' '}
            <span className="font-semibold text-slate-900">{totals.all}</span> cases
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">
            Failures below <span className="font-mono font-semibold text-slate-900">{threshold}</span>:{' '}
            <span className="font-semibold text-slate-900">{totals.failures}</span>
          </span>
          {datasetLabel && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">Dataset: {datasetLabel}</span>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {categoryCounts.slice(0, 10).map(([catName, count]) => {
            const active = category !== 'all' && category === catName;
            return (
              <button
                key={catName}
                onClick={() => setParam('category', active ? 'all' : catName)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="font-semibold">{catName}</span>
                <span className="text-slate-400"> · </span>
                <span className="font-mono">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Eval cases</h2>
            <p className="text-sm text-slate-500">
              Click a case to inspect the answer, reasoning, context, and pipeline metrics.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Run {runId || '—'} · Strategy {strategyId || '—'}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {sorted.map((c) => {
            const href =
              runId && strategyId
                ? `/evals/${encodeURIComponent(c.id)}?run=${encodeURIComponent(runId)}&strategy=${encodeURIComponent(strategyId)}`
                : `/evals/${encodeURIComponent(c.id)}`;

            const rel = c.scores?.relevance ?? null;
            const faith = c.scores?.faithfulness ?? null;
            const acc = c.scores?.accuracy ?? null;

            return (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={href} className="text-sm font-medium text-blue-700 hover:underline">
                      {c.question}
                    </Link>
                    <p className="text-xs text-slate-500 mt-1">
                      <span className="font-mono">{c.id}</span>
                      <span className="text-slate-300"> · </span>
                      {c.category || 'uncategorized'}
                      {c.duration_ms != null && (
                        <>
                          <span className="text-slate-300"> · </span>
                          {c.duration_ms} ms
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <Badge label="Rel" value={formatPercent(rel)} tone={scoreBucket(rel, threshold)} />
                    <Badge label="Faith" value={formatPercent(faith)} tone={scoreBucket(faith, threshold)} />
                    <Badge label="Acc" value={formatPercent(acc)} tone={scoreBucket(acc, threshold)} />
                  </div>
                </div>
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-slate-600 font-medium">No cases match your filters.</p>
              <button
                onClick={() => router.push('/evals')}
                className="mt-2 text-sm text-blue-700 hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


