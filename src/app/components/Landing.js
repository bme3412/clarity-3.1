'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowRight, TrendingUp, Search, FlaskConical, Clock,
  Layers, GitMerge, Sparkles, Wand2, CheckCircle2, Zap, ChevronDown,
  Hash, MessageSquare, FileText, Network, Settings2
} from 'lucide-react';
import { blogPosts } from '../lib/data/blogPosts';

const Particle = ({ index }) => {
  const [styles, setStyles] = useState({
    width: '3px',
    height: '3px',
    left: '50%',
    top: '50%',
    animation: 'float 15s linear infinite'
  });

  useEffect(() => {
    setStyles({
      width: `${Math.random() * 6 + 2}px`,
      height: `${Math.random() * 6 + 2}px`,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animation: `float ${Math.random() * 15 + 10}s linear infinite`,
      opacity: Math.random() * 0.5 + 0.2
    });
  }, []);

  return (
    <div
      className="absolute rounded-full bg-blue-400/30"
      style={styles}
    />
  );
};

const RippleCircle = ({ index, mounted }) => (
  <div
    className={`absolute inset-0 border border-blue-200/40 rounded-full transition-all duration-1000 ${
      mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
    }`}
    style={{
      animation: `ripple 10s infinite ease-out ${index * 2}s`,
      transform: `scale(${0.5 + index * 0.2})`
    }}
  />
);

// Strategy definitions - focused on USE CASES for financial professionals
const STRATEGIES = [
  {
    id: 'auto',
    name: 'Smart Mode',
    icon: Wand2,
    useCase: 'Let AI choose the best approach',
    bestFor: 'Any question - we analyze and optimize automatically',
    color: 'amber',
    recommended: true,
  },
  {
    id: 'hybrid-bm25',
    name: 'Precision',
    icon: Hash,
    useCase: 'Specific numbers, dates & metrics',
    bestFor: '"Q3 2025 revenue", "MI300 sales", exact figures',
    color: 'emerald',
  },
  {
    id: 'dense-only',
    name: 'Concepts',
    icon: MessageSquare,
    useCase: 'Strategic & thematic analysis',
    bestFor: '"AI strategy", "competitive positioning", trends',
    color: 'blue',
  },
  {
    id: 'hyde',
    name: 'Exploratory',
    icon: Sparkles,
    useCase: 'Vague or open-ended questions',
    bestFor: '"What\'s driving growth?", "Any concerns?"',
    color: 'violet',
  },
  {
    id: 'multi-query',
    name: 'Deep Dive',
    icon: Network,
    useCase: 'Complex, multi-faceted questions',
    bestFor: '"Compare revenue growth AND margins across segments"',
    color: 'rose',
  },
];

const colorClasses = {
  amber: {
    bg: 'bg-amber-50',
    bgActive: 'bg-amber-100',
    border: 'border-amber-200',
    borderActive: 'border-amber-400 ring-2 ring-amber-200',
    text: 'text-amber-700',
    icon: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  blue: {
    bg: 'bg-blue-50',
    bgActive: 'bg-blue-100',
    border: 'border-blue-200',
    borderActive: 'border-blue-400 ring-2 ring-blue-200',
    text: 'text-blue-700',
    icon: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  emerald: {
    bg: 'bg-emerald-50',
    bgActive: 'bg-emerald-100',
    border: 'border-emerald-200',
    borderActive: 'border-emerald-400 ring-2 ring-emerald-200',
    text: 'text-emerald-700',
    icon: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  violet: {
    bg: 'bg-violet-50',
    bgActive: 'bg-violet-100',
    border: 'border-violet-200',
    borderActive: 'border-violet-400 ring-2 ring-violet-200',
    text: 'text-violet-700',
    icon: 'bg-violet-500',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  rose: {
    bg: 'bg-rose-50',
    bgActive: 'bg-rose-100',
    border: 'border-rose-200',
    borderActive: 'border-rose-400 ring-2 ring-rose-200',
    text: 'text-rose-700',
    icon: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

function StrategyOption({ strategy, isSelected, onSelect }) {
  const colors = colorClasses[strategy.color];
  const Icon = strategy.icon;
  
  return (
    <button
      onClick={() => onSelect(strategy.id)}
      className={`
        relative p-4 rounded-xl border-2 transition-all duration-200 text-left w-full
        ${isSelected 
          ? `${colors.bgActive} ${colors.borderActive}` 
          : `bg-white/60 ${colors.border} hover:${colors.bg} hover:border-slate-300`
        }
      `}
    >
      {strategy.recommended && (
        <span className="absolute -top-2 right-3 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
          Recommended
        </span>
      )}
      
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.icon} text-white flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold text-sm ${isSelected ? colors.text : 'text-slate-900'}`}>
              {strategy.name}
            </span>
            {isSelected && (
              <CheckCircle2 className={`w-4 h-4 ${colors.text}`} />
            )}
          </div>
          <p className="text-xs text-slate-600 font-medium">
            {strategy.useCase}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
            {strategy.bestFor}
          </p>
        </div>
      </div>
    </button>
  );
}

const LandingPage = () => {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('auto');
  const [showStrategyOptions, setShowStrategyOptions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/chat?q=${encodeURIComponent(query)}&strategy=${selectedStrategy}`);
    }
  };

  const selectedStrategyData = STRATEGIES.find(s => s.id === selectedStrategy);
  const selectedColors = colorClasses[selectedStrategyData?.color || 'amber'];

  const exampleQueries = [
    { text: "Apple's Q3 2025 revenue by segment", hint: "Numbers" },
    { text: "How is AMD positioning against Nvidia in AI?", hint: "Strategy" },
    { text: "What are analysts concerned about?", hint: "Exploratory" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/50 via-slate-50 to-slate-50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent" />
      
      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <Particle key={i} index={i} />
        ))}
      </div>

      {/* Main circles background */}
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none opacity-60">
        <div className="w-[800px] h-[800px] relative">
          {Array.from({ length: 3 }).map((_, i) => (
            <RippleCircle key={i} index={i} mounted={mounted} />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative z-20 flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <TrendingUp className="w-5 h-5" />
          </div>
          Clarity 3.0
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/rag-strategy"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-full shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:shadow-blue-600/30 transition-all duration-200"
          >
            <FlaskConical className="w-4 h-4" />
            RAG Lab
          </Link>
          <Link
            href="/evals"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Evals
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[75vh] px-4 text-center max-w-5xl mx-auto pb-12">
        
        {/* Hero Text */}
        <h1 
          className={`text-5xl md:text-6xl font-bold text-slate-900 mb-4 tracking-tight leading-[1.1] transition-all duration-1000 delay-100 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          Financial Intelligence
        </h1>
        
        <p className={`text-lg text-slate-500 leading-relaxed mb-10 max-w-xl transition-all duration-1000 delay-200 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          Instant analysis of Big Tech earnings calls, guidance, and strategic initiatives
        </p>

        {/* SEARCH INPUT - PROMINENT */}
        <div className={`w-full max-w-2xl mx-auto mb-4 transition-all duration-1000 delay-300 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-0 bg-blue-200/30 rounded-2xl blur-xl group-hover:bg-blue-200/40 transition-all duration-500" />
            <div className="relative flex items-center bg-white rounded-2xl shadow-2xl shadow-slate-200/60 border border-slate-200 p-2 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100 transition-all duration-300">
              <div className="pl-4 text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <input
                id="landing-query"
                name="query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about Apple, AMD, Nvidia, Microsoft, Google, Meta..."
                className="w-full px-4 py-4 text-lg bg-transparent border-none focus:outline-none text-slate-900 placeholder-slate-400"
                autoFocus
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-600/20 font-medium flex items-center gap-2"
              >
                <span>Ask</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>

        {/* Example Queries */}
        <div className={`flex flex-wrap justify-center gap-2 mb-6 transition-all duration-1000 delay-400 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {exampleQueries.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(q.text);
                setTimeout(() => {
                  router.push(`/chat?q=${encodeURIComponent(q.text)}&strategy=${selectedStrategy}`);
                }, 100);
              }}
              className="px-4 py-2 bg-white/70 border border-slate-200 rounded-full text-sm text-slate-600 hover:bg-white hover:border-blue-300 hover:text-blue-600 transition-all duration-200 shadow-sm"
            >
              {q.text}
            </button>
          ))}
        </div>

        {/* COLLAPSIBLE STRATEGY SELECTOR */}
        <div className={`w-full max-w-2xl mx-auto transition-all duration-1000 delay-500 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {/* Collapsed State - Shows current mode as a compact bar */}
          <button
            onClick={() => setShowStrategyOptions(!showStrategyOptions)}
            className={`w-full flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl border transition-all duration-200 ${
              showStrategyOptions 
                ? 'border-slate-300 rounded-b-none' 
                : 'border-slate-200 hover:border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600">Search Mode:</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${selectedColors.badge}`}>
                {React.createElement(selectedStrategyData?.icon || Wand2, { className: 'w-3 h-3' })}
                {selectedStrategyData?.name || 'Smart Mode'}
              </span>
              {selectedStrategy === 'auto' && (
                <span className="text-xs text-slate-400">• AI picks the best approach</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showStrategyOptions ? 'rotate-180' : ''}`} />
          </button>

          {/* Expanded State - Shows all options */}
          {showStrategyOptions && (
            <div className="bg-white/90 backdrop-blur-sm rounded-b-xl border border-t-0 border-slate-200 shadow-lg p-4 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STRATEGIES.map((strategy) => (
                  <StrategyOption
                    key={strategy.id}
                    strategy={strategy}
                    isSelected={selectedStrategy === strategy.id}
                    onSelect={(id) => {
                      setSelectedStrategy(id);
                      setShowStrategyOptions(false);
                    }}
                  />
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs text-slate-400">
                  Different modes optimize retrieval for different question types
                </p>
                <Link 
                  href="/rag-strategy" 
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Learn more <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Blog Preview Section */}
      {blogPosts.length > 0 && (
        <div className={`relative z-10 max-w-6xl mx-auto px-6 pb-20 transition-all duration-1000 delay-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {/* Blog Cards Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {blogPosts.slice(0, 2).map((post, index) => (
              <Link
                key={post.id}
                href="/rag-strategy"
                className="group relative bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300"
              >
                {/* Accent line */}
                <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
                
                <div className="p-6">
                  {/* Status & Date */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      post.status === 'published' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {post.status === 'published' ? '● Published' : '◐ Draft'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{post.date}</span>
                  </div>

                  {/* Title & Subtitle */}
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors leading-tight">
                    {post.title}
                  </h3>
                  <p className="text-sm text-blue-600 font-medium mb-3">
                    {post.subtitle}
                  </p>

                  {/* Summary */}
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-2">
                    {post.summary}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {post.readingTime}
                    </div>
                    <div className="flex items-center gap-2">
                      {post.tags?.slice(0, 2).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-500 font-mono">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Metrics Preview (if available) */}
                  {post.metricsProgression && post.metricsProgression[0]?.faithfulness != null && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Metrics journey:</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">
                            {post.metricsProgression[0]?.faithfulness?.toFixed(0)}%
                          </span>
                          <span className="text-slate-300">→</span>
                          <span className="text-emerald-600 font-semibold">
                            {post.metricsProgression[post.metricsProgression.length - 1]?.faithfulness?.toFixed(0)}%
                          </span>
                          <span className="text-emerald-600 text-xs">faithfulness</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hover arrow */}
                <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes ripple {
          0% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @keyframes float {
          0% {
            transform: translateY(0) translateX(0);
          }
          33% {
            transform: translateY(-20px) translateX(10px);
          }
          66% {
            transform: translateY(10px) translateX(-10px);
          }
          100% {
            transform: translateY(0) translateX(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
