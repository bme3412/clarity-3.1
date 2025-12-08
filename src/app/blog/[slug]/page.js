'use client';

import Link from 'next/link';
import { use } from 'react';
import { ArrowLeft, Clock, Tag, ListChecks, Lightbulb } from 'lucide-react';
import { blogPosts } from '../../lib/data/blogPosts';

export default function BlogPostPage({ params }) {
  const { slug } = use(params);
  const post = blogPosts.find((p) => p.id === slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="max-w-xl text-center space-y-4">
          <p className="text-sm text-slate-500">Not found</p>
          <h1 className="text-2xl font-semibold text-slate-900">That post isn&apos;t available.</h1>
          <Link href="/rag-strategy" className="text-blue-600 hover:text-blue-700 text-sm font-semibold">
            Back to RAG strategy
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/rag-strategy" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600">
            <ArrowLeft className="w-4 h-4" />
            Back to RAG strategy
          </Link>
          <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
            {post.status === 'published' ? 'Published' : 'Draft'}
          </span>
        </div>

        <header className="space-y-3">
          <p className="text-sm text-slate-500 font-mono">{post.date}</p>
          <h1 className="text-4xl font-bold text-slate-900 leading-tight tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            {post.title}
          </h1>
          {post.subtitle && <p className="text-lg text-blue-700 font-medium">{post.subtitle}</p>}
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4 text-slate-400" /> {post.readingTime}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {post.tags?.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-700 font-mono">
                  <Tag className="w-3 h-3 text-slate-400" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </header>

        {post.summary && (
          <p className="text-base text-slate-700 leading-relaxed">
            {post.summary}
          </p>
        )}

        {post.tldr && post.tldr.length > 0 && (
          <section className="space-y-3 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ListChecks className="w-4 h-4 text-blue-600" />
              TL;DR
            </div>
            <ul className="space-y-2">
              {post.tldr.map((item, idx) => (
                <li key={idx} className="text-sm text-slate-700 flex gap-2">
                  <span className="text-emerald-500">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {post.coreInsight && (
          <section className="border-l-4 border-blue-500 bg-blue-50 rounded-r-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
              <Lightbulb className="w-4 h-4" />
              Core insight
            </div>
            <p className="text-base text-slate-800 italic">“{post.coreInsight}”</p>
          </section>
        )}

        {post.metricsProgression && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Metrics progression</h2>
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                    <th className="text-left py-2 px-3 font-mono text-xs uppercase">Version</th>
                    {post.metricsProgression[0]?.faithfulness != null && <th className="text-right py-2 px-3 font-mono text-xs uppercase text-emerald-600">Faith.</th>}
                    {post.metricsProgression[0]?.relevance != null && <th className="text-right py-2 px-3 font-mono text-xs uppercase">Rel.</th>}
                    {post.metricsProgression[0]?.accuracy != null && <th className="text-right py-2 px-3 font-mono text-xs uppercase">Acc.</th>}
                    {post.metricsProgression[0]?.latency != null && <th className="text-right py-2 px-3 font-mono text-xs uppercase">Latency</th>}
                  </tr>
                </thead>
                <tbody>
                  {post.metricsProgression.map((row) => (
                    <tr key={row.version} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 px-3 font-medium text-slate-900">{row.version}</td>
                      {row.faithfulness != null && <td className="py-2 px-3 text-right font-mono text-slate-700">{row.faithfulness.toFixed(1)}%</td>}
                      {row.relevance != null && <td className="py-2 px-3 text-right font-mono text-slate-700">{row.relevance.toFixed(1)}%</td>}
                      {row.accuracy != null && <td className="py-2 px-3 text-right font-mono text-slate-700">{row.accuracy.toFixed(1)}%</td>}
                      {row.latency != null && <td className="py-2 px-3 text-right font-mono text-slate-700">{(row.latency / 1000).toFixed(1)}s</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {post.experiments && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Experiments</h2>
            <div className="space-y-3">
              {post.experiments.map((exp) => (
                <div key={exp.name} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{exp.name}</p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${exp.verdict === 'ship' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : exp.verdict === 'skip' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {exp.verdict === 'ship' ? 'Shipped' : exp.verdict === 'skip' ? 'Skip' : 'Test'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{exp.description}</p>
                  {exp.impact && <p className="text-xs text-emerald-700 font-mono">Impact: {exp.impact}</p>}
                  {exp.cost && <p className="text-xs text-slate-500 font-mono">Cost: {exp.cost}</p>}
                  {exp.lessons && exp.lessons.length > 0 && (
                    <ul className="text-xs text-slate-600 space-y-1">
                      {exp.lessons.map((l, i) => (
                        <li key={i}>→ {l}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {post.lessons && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Key lessons</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {post.lessons.map((lesson, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-1">
                  <p className="font-semibold text-slate-900">{lesson.title}</p>
                  <p className="text-sm text-slate-700">{lesson.content}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
