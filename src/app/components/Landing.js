'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowRight, TrendingUp, Search, Clock,
  Layers, GitMerge, Zap, FileText, BookOpen
} from 'lucide-react';
import LandingArticle from './LandingArticle';

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

const LandingPage = () => {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      // Keep the default behavior, but remove the strategy picker UI.
      router.push(`/chat?q=${encodeURIComponent(query)}&strategy=auto`);
    }
  };

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

      </div>


      {/* Landing article */}
      <div className={`relative z-10 max-w-5xl mx-auto px-6 pb-24 transition-all duration-1000 delay-700 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}>
        <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="p-6 md:p-10">
            <LandingArticle />
          </div>
        </div>
      </div>


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
      `}</style>
    </div>
  );
};

export default LandingPage;
