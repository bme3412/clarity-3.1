'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowRight, TrendingUp, Search, Clock,
  Layers, GitMerge, Sparkles, Wand2, CheckCircle2, Zap, ChevronDown,
  Hash, MessageSquare, FileText, Network, Settings2, BookOpen
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
  const primaryPost = blogPosts[0];

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
    { text: "What is NVIDIA's data center growth strategy?", color: "blue" },
    { text: "Apple gross margin trend over last 4 quarters", color: "emerald" },
    { text: "How is Google monetizing AI?", color: "violet" },
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
            href="/how-it-works"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            How It Works
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
          Big Tech <span className="text-blue-600">Earnings</span> Intelligence
        </h1>
        
        <p className={`text-lg text-slate-600 leading-relaxed mb-6 max-w-xl transition-all duration-1000 delay-200 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          Over 200 MegaCap Tech earnings calls + financials at your fingertips. Use AI to surface cross-company trends, strategy shifts, and AI bets.
        </p>
        
        {/* Available Tickers */}
        <div className={`flex flex-wrap justify-center gap-2 mb-8 transition-all duration-1000 delay-250 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          {['AAPL', 'AMD', 'NVDA', 'GOOGL', 'META', 'MSFT', 'AMZN', 'AVGO', 'CRM', 'ORCL'].map(ticker => (
            <span 
              key={ticker}
              className="px-3 py-1 text-xs font-mono font-bold bg-white/80 text-slate-700 rounded-full border border-slate-200 shadow-sm"
            >
              {ticker}
            </span>
          ))}
        </div>

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
        <div className={`mb-6 transition-all duration-1000 delay-400 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <p className="text-xs text-slate-400 mb-3">Try these examples:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {exampleQueries.map((q, i) => (
              <button
                key={i}
                onClick={() => setQuery(q.text)}
                className={`px-4 py-2 rounded-full text-sm transition-all duration-200 shadow-sm border
                  ${q.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : ''}
                  ${q.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : ''}
                  ${q.color === 'violet' ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' : ''}
                  ${q.color === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : ''}
                `}
              >
                {q.text}
              </button>
            ))}
          </div>
        </div>

        {/* Data Coverage Stats */}
        <div className={`flex items-center justify-center gap-6 mb-6 text-xs text-slate-400 transition-all duration-1000 delay-450 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span><strong className="text-slate-700">241</strong> earnings-call quarters</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span><strong className="text-slate-700">FY2020–FY2026</strong> quarterly coverage</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-violet-500"></div>
            <span><strong className="text-slate-700">Hybrid</strong> (dense + sparse) retrieval</span>
          </div>
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
              <span className="text-sm text-slate-700">Search mode</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${selectedColors.badge}`}>
                {React.createElement(selectedStrategyData?.icon || Wand2, { className: 'w-3 h-3' })}
                {selectedStrategyData?.name || 'Smart (auto)'}
              </span>
              {selectedStrategy === 'auto' && (
                <span className="text-xs text-slate-500">Auto-picks dense vs hybrid per query</span>
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


      {/* Blog Highlight - minimal styling */}
      {primaryPost && (
        <div className={`relative z-10 max-w-4xl mx-auto px-6 pb-24 transition-all duration-1000 delay-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm px-6 py-8 md:px-10 md:py-10 space-y-6">
            {/* Header */}
            <div className="space-y-3">
              <h3 className="text-3xl font-serif font-semibold text-slate-900 leading-snug">
                Building Production-Grade RAG: Engineering Trade-offs in Clarity 3.0
              </h3>
              <p className="text-base text-slate-700">
                How we improved retrieval, latency, and trust—one bottleneck at a time.
              </p>
            </div>

            <div className="space-y-7 text-slate-800 leading-relaxed">
              <p>
                When we started optimizing Clarity 3.0—our AI-powered financial intelligence platform—we had a working system but nowhere near production quality. First token time hovered around 22 seconds, dense-only search retrieved irrelevant results, and users had no visibility into what the system was actually doing. Over several optimization sprints, we systematically addressed each bottleneck. This is the story of those changes, the trade-offs we made, and what we learned about building RAG systems for real-world use.
              </p>

              <div className="space-y-2">
                <h4 className="text-xl font-serif font-semibold text-slate-900">The Starting Point: 22 Seconds Is Not Good Enough</h4>
                <p className="text-sm">
                  Time to First Token was 22.8 seconds. Average relevance was 51%. User observability was zero. Search was dense-only. The model was Claude Opus 4.5. For a portfolio-grade build, this was a clear signal we were leaving performance and trust on the table.
                </p>
                <p className="text-sm">
                  The question became: which bottleneck should we attack first?
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xl font-serif font-semibold text-slate-900">Strategy: Attack Bottlenecks in Order of Impact</h4>
                <p className="text-sm">
                  We profiled before optimizing and found three buckets: retrieval quality (affecting everything downstream), model latency (the long pole once retrieval is fixed), and user perception (status/transparency so waits feel acceptable). Fix retrieval first, speed the model second, improve perception third.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-slate-900">Change 1: Hybrid Search via Sparse Vectors</h4>
                <p className="text-sm">
                  Dense vectors missed exact terms like “Q3 FY2025 gross margin.” We built hybrid search combining dense (semantic) and sparse (BM25) with a dotproduct index, then re-embedded all 11,929 vectors. Retrieval dropped from 1716ms to 985ms (43% faster) and relevance for financial terms improved. Trade-off: re-indexing took 63.8 minutes and required code changes for dotproduct metrics, but creating a new index kept rollback safety and documented the migration path.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-slate-900">Change 2: Model Selection — Power vs. Speed</h4>
                <p className="text-sm">
                  After hybrid search, retrieval was fast (985ms) but TTFT stayed ~22s. The agentic RAG flow required two calls: “should I search and which tools?” (~3s) plus tool time (~1s), then “generate the response” (~12s). We swapped Opus 4.5 for Sonnet 4.5, keeping the model env-configurable. TTFT fell from 22.8s to 16.5s (28% faster) and total time from 30.0s to 20.9s (30% faster). Trade-off: slightly less nuanced reasoning, but still excellent for finance and faster UX.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-slate-900">Change 3: Fiscal Year Intelligence</h4>
                <p className="text-sm">
                  Different fiscal calendars (NVIDIA on FY2026 vs. AMD on FY2025) meant “latest revenue” could be three quarters old. We added fiscal year auto-detection in the data layer (`getMostRecentQuarter()`), allowed `fiscalYear: "latest"` in the tool, and instructed the model accordingly. Comparisons now stay apples-to-apples.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-slate-900">Change 4: Building Observability</h4>
                <p className="text-sm">
                  Silence for 22 seconds eroded trust. We added real-time status messages (“Analyzing…”, “Searching…”), an expandable behind-the-scenes panel showing tools, retrieved chunks with sources, and confidence scores, plus a lightweight metrics view (TTFT, latency, retrieval score). Users now see what’s happening; debugging is faster.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-slate-900">Change 5: Data Extraction Fixes</h4>
                <p className="text-sm">
                  Gross margin data existed but schema drift hid it. We added defensive extraction with fallbacks and derived metrics (gross_profit, net_margin, diluted EPS). Real-world finance data is messy; strict-but-flexible parsing is required.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-slate-900">Change 6: UX Improvements</h4>
                <p className="text-sm">
                  The chat felt like a form. We moved input to the bottom, made responses stream with status, auto-focused after answers, and stopped auto-submitting example queries. The landing page now clearly states value, shows supported tickers, better sample queries, and coverage stats (11,929 vectors, FY2020–FY2026, hybrid search). UX now feels like a real conversation.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xl font-serif font-semibold text-slate-900">The Architecture: How It Fits Together</h4>
                <p className="text-sm">
                  User input flows from the landing page into a bottom-anchored chat. The route handler calls LLM #1 to decide tools, runs hybrid Pinecone search and financial metric lookups, then calls LLM #2 to generate. Responses stream with status, confidence, behind-the-scenes details, and metrics (TTFT, relevance, retrieval time).
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xl font-serif font-semibold text-slate-900">Results: Before and After</h4>
                <p className="text-sm">
                  TTFT improved from 22.8s to 16.5s (28%). Total time improved from 30.0s to 20.9s (30%). Retrieval time improved from 1716ms to 985ms (43%). Relevance rose from 51% to 65%. Faithfulness rose from 0.63 to 0.94. Search moved from dense-only to hybrid. Observability moved from none to full, and UX shifted from confusing to natural.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xl font-serif font-semibold text-slate-900">Key Lessons Learned</h4>
                <p className="text-sm">
                  Measure before optimizing: retrieval was only ~5% of total time, so fixing latency mattered more. Trade-offs are everywhere: hybrid re-indexing takes time, Sonnet is faster but slightly less capable, observability adds frontend code, and defensive extraction adds edge-case handling—be intentional. Preserve optionality: new index for hybrid and env-configurable LLMs keep escape hatches open. Real-world data is messy: build strict-yet-flexible fallbacks. Observability is not optional: metrics and behind-the-scenes views transform trust and debugging. UX matters as much as performance: status messages alone improved perceived speed.
                </p>
              </div>
            </div>
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
