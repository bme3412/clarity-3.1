'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, FlaskConical, TrendingUp, Clock, Tag, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Lightbulb, ArrowUpRight, Zap } from 'lucide-react';
import { ragStrategies } from '../lib/data/ragStrategies.js';
import { blogPosts } from '../lib/data/blogPosts.js';

// Animated sparkline for light theme
function MiniChart({ data, color = 'blue' }) {
  if (!data || data.length < 2) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 70 - 15;
    return `${x},${y}`;
  }).join(' ');

  const colors = {
    blue: { stroke: '#2563eb', fill: '#3b82f6' },
    emerald: { stroke: '#059669', fill: '#10b981' },
    rose: { stroke: '#e11d48', fill: '#f43f5e' },
  };

  const c = colors[color] || colors.emerald;
  
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-14">
      {/* Background area fill */}
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c.fill} stopOpacity="0.2" />
          <stop offset="100%" stopColor={c.fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area under line */}
      <path
        d={`M 0,100 L ${points.split(' ').map(p => p.replace(',', ' ')).join(' L ')} L 100,100 Z`}
        fill={`url(#gradient-${color})`}
      />
      {/* Line */}
      <polyline
        fill="none"
        stroke={c.stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* End dot */}
      <circle
        cx={points.split(' ').pop().split(',')[0]}
        cy={points.split(' ').pop().split(',')[1]}
        r="4"
        fill={c.stroke}
        className="animate-pulse"
      />
    </svg>
  );
}

// Experiment card with light editorial aesthetic
function ExperimentCard({ experiment, index }) {
  return (
    <div 
      className="group relative bg-white rounded-xl border border-slate-200 p-5 space-y-4 
                 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-mono text-xs flex items-center justify-center font-semibold">
            {index + 1}
          </span>
          <h4 className="font-semibold text-slate-900 tracking-tight">{experiment.name}</h4>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-mono uppercase tracking-wider
          ${experiment.verdict === 'ship' 
            ? 'bg-emerald-100 text-emerald-700' 
            : experiment.verdict === 'skip' 
            ? 'bg-rose-100 text-rose-700' 
            : 'bg-amber-100 text-amber-700'}`}>
          {experiment.verdict === 'ship' ? '✓ Shipped' : experiment.verdict === 'skip' ? '✗ Skip' : '◐ Test'}
        </span>
      </div>
      
      {/* Description */}
      <p className="text-sm text-slate-600 leading-relaxed">{experiment.description || experiment.change}</p>
      
      {/* Impact metrics */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-emerald-700 font-mono text-sm font-medium">{experiment.impact}</span>
        </div>
        <div className="text-slate-400 text-xs font-mono">{experiment.cost}</div>
      </div>
      
      {/* Lessons */}
      {experiment.lessons && experiment.lessons.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <ul className="space-y-1.5">
            {experiment.lessons.map((lesson, i) => (
              <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5 font-mono">→</span>
                <span>{lesson}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Lesson callout with light editorial style
function LessonCallout({ lesson, index }) {
  const accents = [
    { border: 'border-l-blue-500', bg: 'bg-blue-50', num: 'bg-blue-500 text-white' },
    { border: 'border-l-emerald-500', bg: 'bg-emerald-50', num: 'bg-emerald-500 text-white' },
    { border: 'border-l-indigo-500', bg: 'bg-indigo-50', num: 'bg-indigo-500 text-white' },
    { border: 'border-l-rose-500', bg: 'bg-rose-50', num: 'bg-rose-500 text-white' },
    { border: 'border-l-violet-500', bg: 'bg-violet-50', num: 'bg-violet-500 text-white' },
    { border: 'border-l-amber-500', bg: 'bg-amber-50', num: 'bg-amber-500 text-white' },
  ];
  
  const accent = accents[index % accents.length];
  
  return (
    <div 
      className={`relative ${accent.bg} rounded-r-xl border-l-4 ${accent.border} p-5
                  hover:shadow-md transition-all duration-300 group`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Lesson number */}
      <span className={`absolute -left-3 top-4 w-6 h-6 rounded-full ${accent.num} 
                       flex items-center justify-center text-xs font-mono font-bold shadow-sm`}>
        {index + 1}
      </span>
      
      <div className="pl-2">
        <h4 className="font-semibold text-slate-900 mb-2 tracking-tight">
          {lesson.title}
        </h4>
        <p className="text-sm text-slate-600 leading-relaxed">
          {lesson.content}
        </p>
      </div>
    </div>
  );
}

// Blog post card – simplified, skimmable
function BlogPostCard({ post }) {
  return (
    <article className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-4">
      <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
        <span className={`px-2 py-1 rounded-full border ${post.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {post.status === 'published' ? 'Published' : 'Draft'}
        </span>
        <span>{post.date}</span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> {post.readingTime}
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">{post.title}</h3>
        {post.subtitle && <p className="text-sm text-blue-700 font-medium">{post.subtitle}</p>}
        {post.summary && <p className="text-sm text-slate-600 leading-relaxed">{post.summary}</p>}
        {post.coreInsight && (
          <p className="text-sm text-slate-700 italic border-l-4 border-blue-200 pl-3">
            “{post.coreInsight}”
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {post.tags?.slice(0, 3).map((tag) => (
          <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded font-mono">
            {tag}
          </span>
        ))}
      </div>

      <div className="pt-2">
        <a
          href={`/blog/${post.id}`}
          className="text-sm text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
        >
          Read full article <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
    </article>
  );
}

// Strategy card component with light theme
function StrategyCard({ strategy, isLast }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <article className="space-y-5">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-blue-600 bg-blue-100 px-2 py-1 rounded-full font-semibold">
            {strategy.version}
          </span>
          <span className="text-xs text-slate-400 font-mono">{strategy.period}</span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}>
          {strategy.codename}
        </h2>
      </header>
      
      <p className="text-base text-slate-600 leading-relaxed">{strategy.summary}</p>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">How it works</p>
        <p className="text-base text-slate-600">{strategy.howItWorks}</p>
      </div>

      {strategy.effectivenessGrade && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900">
            Effectiveness grade:{' '}
            <span className="text-lg font-bold">{strategy.effectivenessGrade}</span>
          </p>
          {strategy.effectivenessRationale && (
            <p className="text-sm text-amber-800">{strategy.effectivenessRationale}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">Why we run it</p>
        <p className="text-base text-slate-600">{strategy.goals}</p>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
      >
        <span className="w-6 h-6 rounded-full border border-blue-200 flex items-center justify-center hover:bg-blue-50">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
        {expanded ? 'Hide details' : 'Show code refs & evaluation'}
      </button>

      {expanded && (
        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <p className="text-sm font-mono uppercase tracking-wider text-slate-400 font-semibold">Code References</p>
            <div className="space-y-2">
              {strategy.codeRefs.map((ref) => (
                <p key={ref.path} className="text-sm">
                  <code className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{ref.path}</code>
                  <span className="text-slate-500 ml-2">— {ref.description}</span>
                </p>
              ))}
            </div>
          </div>

          {strategy.iterationIdeas?.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-mono uppercase tracking-wider text-slate-400 font-semibold">Next Ideas</p>
              <div className="space-y-1 text-sm text-slate-600">
                {strategy.iterationIdeas.map((idea) => (
                  <p key={idea} className="flex items-start gap-2">
                    <span className="text-blue-500">→</span> {idea}
                  </p>
                ))}
              </div>
            </div>
          )}

          {strategy.latestEvaluation && (
            <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-900">Latest Evaluation</p>
              <p className="text-sm text-blue-800">
                <code className="font-mono bg-blue-100 px-2 py-0.5 rounded">{strategy.latestEvaluation.command}</code>
              </p>
              <p className="text-sm text-blue-700 font-mono">
                Run {strategy.latestEvaluation.runId} · {strategy.latestEvaluation.samples} samples
              </p>
              <div className="grid grid-cols-4 gap-3 py-2">
                <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                  <p className="text-lg font-bold text-blue-600">{strategy.latestEvaluation.averages.relevance.toFixed(0)}%</p>
                  <p className="text-xs text-slate-500">Relevance</p>
                </div>
                <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                  <p className="text-lg font-bold text-emerald-600">{strategy.latestEvaluation.averages.faithfulness.toFixed(0)}%</p>
                  <p className="text-xs text-slate-500">Faithfulness</p>
                </div>
                <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                  <p className="text-lg font-bold text-amber-600">{strategy.latestEvaluation.averages.accuracy.toFixed(0)}%</p>
                  <p className="text-xs text-slate-500">Accuracy</p>
                </div>
                <div className="text-center bg-white rounded-lg p-2 shadow-sm">
                  <p className="text-lg font-bold text-slate-700">{(strategy.latestEvaluation.averages.totalLatencyMs / 1000).toFixed(1)}s</p>
                  <p className="text-xs text-slate-500">Latency</p>
                </div>
              </div>
              {strategy.latestEvaluation.observations?.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-blue-200">
                  {strategy.latestEvaluation.observations.map((note) => (
                    <p key={note} className="text-xs text-blue-700">• {note}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!isLast && <hr className="border-t border-slate-200 mt-8" />}
    </article>
  );
}

export default function RAGStrategyPage() {
  const [activeTab, setActiveTab] = useState('blog');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 py-12 space-y-10">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to home
        </Link>

        {/* Header with staggered animation */}
        <header className={`space-y-4 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-blue-400/50 to-transparent" />
            <span className="text-xs font-mono uppercase tracking-[0.3em] text-blue-600">
              RAG Development Journal
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-blue-400/50 to-transparent" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-center leading-tight tracking-tight text-slate-900"
              style={{ fontFamily: "var(--font-serif)" }}>
            A lean log of RAG experiments
          </h1>
          
          <p className="text-base text-slate-600 text-center max-w-2xl mx-auto leading-relaxed"
             style={{ fontFamily: "var(--font-serif)" }}>
            Skim short summaries of the RAG work that moved the needle. No tables, no walls of metrics—just the why, what changed, and where to read more.
          </p>
        </header>

        {/* Tab Navigation */}
        <nav className={`flex justify-center gap-2 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <button
            onClick={() => setActiveTab('blog')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-300 ${
              activeTab === 'blog'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Blog Posts
            <span className={`ml-1 text-xs font-mono ${activeTab === 'blog' ? 'opacity-80' : 'opacity-50'}`}>({blogPosts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('strategies')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-300 ${
              activeTab === 'strategies'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            Strategy Archive
            <span className={`ml-1 text-xs font-mono ${activeTab === 'strategies' ? 'opacity-80' : 'opacity-50'}`}>({ragStrategies.length})</span>
          </button>
        </nav>

        {/* Blog Posts Tab */}
        {activeTab === 'blog' && (
          <div className={`space-y-4 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {blogPosts.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-mono text-sm">No posts yet. Add to <code className="text-blue-600">blogPosts.js</code></p>
              </div>
            ) : (
              blogPosts.slice(0, 2).map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))
            )}
          </div>
        )}

        {/* Strategies Tab */}
        {activeTab === 'strategies' && (
          <section className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8 space-y-8
                              transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div>
              <p className="text-base text-slate-600 leading-relaxed">
                Track historical and future RAG strategies by adding new entries to{' '}
                <code className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-sm">ragStrategies.js</code>.
                Each entry documents how the pipeline works, why it exists, and where the code lives.
              </p>
            </div>

            {ragStrategies.map((strategy, index) => (
              <StrategyCard 
                key={strategy.version} 
                strategy={strategy} 
                isLast={index === ragStrategies.length - 1}
              />
            ))}
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-12 border-t border-slate-200">
          <p className="text-xs text-slate-400 font-mono">
            Add posts to <code className="text-blue-600">src/app/lib/data/blogPosts.js</code>
          </p>
        </footer>
      </div>
    </div>
  );
}
