'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, FileText, Sparkles, Calendar, Building2, 
  ChevronRight, Loader2, RefreshCw, Eye, X,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { EarningsDigestDisplay } from '../../components/EarningsDigest';
import TranscriptViewer from '../../components/TranscriptViewer';

// Visual Period Selector Component
function PeriodSelector({ onSelect, selectedPeriod }) {
  const [tickers, setTickers] = useState([]);
  const [periods, setPeriods] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedTicker, setExpandedTicker] = useState(null);
  
  // Load all available tickers and their periods
  useEffect(() => {
    const loadAllPeriods = async () => {
      setLoading(true);
      try {
        // Get list of tickers
        const tickerRes = await fetch('/api/reports/earnings-digest');
        const tickerData = await tickerRes.json();
        
        if (tickerData.tickers) {
          setTickers(tickerData.tickers);
          
          // Load periods for each ticker in parallel
          const periodPromises = tickerData.tickers.map(async (ticker) => {
            const res = await fetch(`/api/reports/earnings-digest?ticker=${ticker}`);
            const data = await res.json();
            return { ticker, periods: data.periods || [] };
          });
          
          const allPeriods = await Promise.all(periodPromises);
          const periodsMap = {};
          allPeriods.forEach(({ ticker, periods }) => {
            periodsMap[ticker] = periods;
          });
          setPeriods(periodsMap);
        }
      } catch (e) {
        console.error('Error loading periods:', e);
      } finally {
        setLoading(false);
      }
    };
    
    loadAllPeriods();
  }, []);
  
  const handleSelect = (ticker, fiscalYear, quarter) => {
    onSelect({ ticker, fiscalYear, quarter });
  };
  
  const isSelected = (ticker, fiscalYear, quarter) => {
    return selectedPeriod?.ticker === ticker && 
           selectedPeriod?.fiscalYear === fiscalYear && 
           selectedPeriod?.quarter === quarter;
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-slate-600">Loading available earnings...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Select Earnings Period
        </h2>
        <p className="text-sm text-slate-500 mt-1">Click any period to generate a digest</p>
      </div>
      
      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
        {tickers.map(ticker => (
          <div key={ticker}>
            <button
              onClick={() => setExpandedTicker(expandedTicker === ticker ? null : ticker)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                  {ticker.substring(0, 2)}
                </div>
                <div className="text-left">
                  <span className="font-semibold text-slate-900">{ticker}</span>
                  <p className="text-xs text-slate-500">
                    {periods[ticker]?.length || 0} quarters available
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${
                expandedTicker === ticker ? 'rotate-90' : ''
              }`} />
            </button>
            
            {expandedTicker === ticker && periods[ticker] && (
              <div className="bg-slate-50 px-4 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {periods[ticker].map(period => (
                    <button
                      key={`${period.fiscalYear}-${period.quarter}`}
                      onClick={() => handleSelect(ticker, period.fiscalYear, period.quarter)}
                      className={`
                        p-3 rounded-xl text-left transition-all
                        ${isSelected(ticker, period.fiscalYear, period.quarter)
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow'
                        }
                      `}
                    >
                      <p className={`font-semibold ${
                        isSelected(ticker, period.fiscalYear, period.quarter) ? 'text-white' : 'text-slate-900'
                      }`}>
                        {period.quarter}
                      </p>
                      <p className={`text-xs ${
                        isSelected(ticker, period.fiscalYear, period.quarter) ? 'text-blue-100' : 'text-slate-500'
                      }`}>
                        FY {period.fiscalYear}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Analysis stages for progress tracking
const ANALYSIS_STAGES = [
  { id: 'loading', label: 'Loading transcript data', icon: '📄' },
  { id: 'connecting', label: 'Connecting to AI', icon: '🔌' },
  { id: 'headline', label: 'Extracting key headline', icon: '📰' },
  { id: 'tone', label: 'Analyzing management tone', icon: '🎯' },
  { id: 'highlights', label: 'Identifying key highlights', icon: '✨' },
  { id: 'segments', label: 'Reviewing segment performance', icon: '📊' },
  { id: 'guidance', label: 'Parsing forward guidance', icon: '🔮' },
  { id: 'concerns', label: 'Extracting analyst concerns', icon: '❓' },
  { id: 'risks', label: 'Identifying risks', icon: '⚠️' },
  { id: 'complete', label: 'Analysis complete', icon: '✅' }
];

// Detect which stage we're at based on JSON content
function detectStage(rawText) {
  if (!rawText) return 0;
  const text = rawText.toLowerCase();
  
  if (text.includes('"strategicinitiatives"') || text.includes('"strategic_initiatives"')) return 9;
  if (text.includes('"risksandchallenges"') || text.includes('"risks')) return 8;
  if (text.includes('"analystconcerns"') || text.includes('"analyst')) return 7;
  if (text.includes('"guidancechanges"') || text.includes('"guidance')) return 6;
  if (text.includes('"segmentperformance"') || text.includes('"segment')) return 5;
  if (text.includes('"keyhighlights"') || text.includes('"key')) return 4;
  if (text.includes('"managementtone"') || text.includes('"management')) return 3;
  if (text.includes('"headline"')) return 2;
  if (rawText.length > 10) return 1;
  return 0;
}

// Progress bar component
function AnalysisProgress({ currentStage, rawTextLength }) {
  const progress = Math.min(100, (currentStage / (ANALYSIS_STAGES.length - 1)) * 100);
  
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-violet-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
            </div>
            <span className="font-semibold text-slate-900">AI Analysis in Progress</span>
          </div>
          <span className="text-sm text-slate-500">{Math.round(progress)}%</span>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Stages */}
      <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
        {ANALYSIS_STAGES.map((stage, idx) => {
          const isComplete = idx < currentStage;
          const isCurrent = idx === currentStage;
          const isPending = idx > currentStage;
          
          return (
            <div 
              key={stage.id}
              className={`
                flex items-center gap-3 p-2 rounded-lg transition-all duration-300
                ${isComplete ? 'bg-emerald-50' : ''}
                ${isCurrent ? 'bg-blue-50 ring-2 ring-blue-200' : ''}
                ${isPending ? 'opacity-40' : ''}
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center text-lg
                ${isComplete ? 'bg-emerald-100' : ''}
                ${isCurrent ? 'bg-blue-100 animate-pulse' : ''}
                ${isPending ? 'bg-slate-100' : ''}
              `}>
                {isComplete ? '✅' : stage.icon}
              </div>
              <div className="flex-1">
                <p className={`
                  text-sm font-medium
                  ${isComplete ? 'text-emerald-700' : ''}
                  ${isCurrent ? 'text-blue-700' : ''}
                  ${isPending ? 'text-slate-400' : ''}
                `}>
                  {stage.label}
                </p>
              </div>
              {isCurrent && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Footer with raw stats */}
      <div className="p-3 bg-slate-50 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Processing {rawTextLength.toLocaleString()} characters</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Streaming response
          </span>
        </div>
      </div>
    </div>
  );
}

// Skeleton section for streaming preview
function DigestSectionSkeleton({ title, isActive }) {
  return (
    <div className={`
      rounded-xl border p-4 transition-all duration-300
      ${isActive ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50/50'}
    `}>
      <div className="flex items-center gap-2 mb-3">
        {isActive ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        ) : (
          <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />
        )}
        <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-slate-400'}`}>
          {title}
        </span>
      </div>
      <div className="space-y-2">
        <div className={`h-4 rounded ${isActive ? 'bg-blue-200' : 'bg-slate-200'} animate-pulse`} style={{ width: '80%' }} />
        <div className={`h-4 rounded ${isActive ? 'bg-blue-200' : 'bg-slate-200'} animate-pulse`} style={{ width: '60%' }} />
      </div>
    </div>
  );
}

// Streaming Digest Display with immediate feedback
function StreamingDigestDisplay({ ticker, fiscalYear, quarter, onClose }) {
  const [metadata, setMetadata] = useState(null);
  const [rawText, setRawText] = useState('');
  const [digest, setDigest] = useState(null);
  const [status, setStatus] = useState('connecting'); // connecting, streaming, complete, error
  const [error, setError] = useState(null);
  const [startTime] = useState(Date.now());
  
  // Detect current analysis stage
  const currentStage = status === 'complete' ? ANALYSIS_STAGES.length - 1 : detectStage(rawText);
  
  useEffect(() => {
    if (!ticker || !fiscalYear || !quarter) return;
    
    setStatus('connecting');
    setMetadata(null);
    setRawText('');
    setDigest(null);
    setError(null);
    
    const fetchStream = async () => {
      try {
        const response = await fetch(
          `/api/reports/earnings-digest?stream=true`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, fiscalYear, quarter })
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate digest');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                
                if (event.type === 'metadata') {
                  setMetadata(event.data);
                  setStatus('streaming');
                } else if (event.type === 'chunk') {
                  setRawText(prev => prev + event.data);
                } else if (event.type === 'complete') {
                  setDigest(event.data);
                  setStatus('complete');
                } else if (event.type === 'error') {
                  setError(event.data);
                  setStatus('error');
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        setError(e.message);
        setStatus('error');
      }
    };
    
    fetchStream();
  }, [ticker, fiscalYear, quarter]);
  
  // Connecting state
  if (status === 'connecting') {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{ticker}</h1>
              <p className="text-slate-300">{quarter} FY{fiscalYear} Earnings Digest</p>
            </div>
          </div>
        </div>
        
        {/* Loading state */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-900">Preparing Analysis</p>
              <p className="text-sm text-slate-500 mt-1">Loading transcript and financial data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (status === 'error') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <X className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="font-medium text-rose-900">Analysis Failed</p>
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-rose-500 hover:text-rose-700">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }
  
  // Streaming state - show progress with visual stages
  if (status === 'streaming' && metadata) {
    return (
      <div className="space-y-4">
        {/* Header with metadata */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{metadata.ticker}</h1>
                <p className="text-slate-300">{metadata.quarter} FY{metadata.fiscalYear} Earnings Digest</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Key metrics shown immediately */}
          {metadata.keyMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {metadata.keyMetrics.revenue && (
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-slate-400 uppercase">Revenue</p>
                  <p className="text-xl font-bold">${metadata.keyMetrics.revenue}B</p>
                  {metadata.keyMetrics.revenueGrowth && (
                    <p className="text-sm text-emerald-400">{metadata.keyMetrics.revenueGrowth}</p>
                  )}
                </div>
              )}
              {metadata.keyMetrics.eps && (
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-xs text-slate-400 uppercase">EPS</p>
                  <p className="text-xl font-bold">${metadata.keyMetrics.eps}</p>
                  {metadata.keyMetrics.epsGrowth && (
                    <p className="text-sm text-emerald-400">{metadata.keyMetrics.epsGrowth}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Visual progress tracker */}
        <AnalysisProgress currentStage={currentStage} rawTextLength={rawText.length} />
        
        {/* Preview skeleton sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DigestSectionSkeleton title="Key Headline" isActive={currentStage >= 2 && currentStage < 3} />
          <DigestSectionSkeleton title="Management Tone" isActive={currentStage >= 3 && currentStage < 4} />
          <DigestSectionSkeleton title="Key Highlights" isActive={currentStage >= 4 && currentStage < 5} />
          <DigestSectionSkeleton title="Segment Performance" isActive={currentStage >= 5 && currentStage < 6} />
          <DigestSectionSkeleton title="Forward Guidance" isActive={currentStage >= 6 && currentStage < 7} />
          <DigestSectionSkeleton title="Analyst Concerns" isActive={currentStage >= 7 && currentStage < 8} />
        </div>
      </div>
    );
  }
  
  // Complete - show full digest
  if (status === 'complete' && digest && metadata) {
    return (
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/80 rounded-full shadow hover:bg-white transition-colors"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
        <EarningsDigestDisplay 
          data={{
            ...metadata,
            digest,
            metadata: {
              hasEarningsTranscript: metadata.hasEarningsTranscript,
              hasQATranscript: metadata.hasQATranscript,
              hasFinancialData: metadata.hasFinancialData
            }
          }} 
        />
      </div>
    );
  }
  
  return null;
}

// Main Page Component
export default function EarningsDigestPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [activeTab, setActiveTab] = useState('digest'); // 'digest' | 'transcript'
  
  const handleSelectPeriod = (period) => {
    setSelectedPeriod(period);
    setActiveTab('digest');
  };
  
  const handleClose = () => {
    setSelectedPeriod(null);
    setShowTranscript(false);
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Earnings Digest</h1>
                  <p className="text-xs text-slate-500">AI-powered analysis + Interactive Transcript</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Streaming AI</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Period Selector */}
          <div className="lg:col-span-1">
            <PeriodSelector 
              onSelect={handleSelectPeriod} 
              selectedPeriod={selectedPeriod}
            />
          </div>
          
          {/* Right: Content Area */}
          <div className="lg:col-span-2">
            {selectedPeriod ? (
              <div className="space-y-4">
                {/* Tabs */}
                <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-slate-200 w-fit">
                  <button
                    onClick={() => setActiveTab('digest')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'digest'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      AI Digest
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'transcript'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Interactive Transcript
                    </span>
                  </button>
                </div>
                
                {/* Content */}
                {activeTab === 'digest' ? (
                  <StreamingDigestDisplay
                    ticker={selectedPeriod.ticker}
                    fiscalYear={selectedPeriod.fiscalYear}
                    quarter={selectedPeriod.quarter}
                    onClose={handleClose}
                  />
                ) : (
                  <TranscriptViewer
                    ticker={selectedPeriod.ticker}
                    fiscalYear={selectedPeriod.fiscalYear}
                    quarter={selectedPeriod.quarter}
                  />
                )}
              </div>
            ) : (
              /* Empty State */
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Select an Earnings Period
                </h2>
                <p className="text-slate-600 max-w-md mx-auto mb-8">
                  Choose a company and quarter from the list to generate an AI-powered 
                  earnings digest or explore the interactive transcript.
                </p>
                
                {/* Feature cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
                  <div className="bg-blue-50 rounded-xl p-4 text-left">
                    <Sparkles className="w-6 h-6 text-blue-600 mb-2" />
                    <h3 className="font-semibold text-slate-900 mb-1">AI Digest</h3>
                    <p className="text-sm text-slate-600">
                      Instant summary with key metrics, tone analysis, and analyst concerns
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 text-left">
                    <Eye className="w-6 h-6 text-emerald-600 mb-2" />
                    <h3 className="font-semibold text-slate-900 mb-1">Interactive Transcript</h3>
                    <p className="text-sm text-slate-600">
                      Filter by speaker, topic, or sentiment. Dim or hide sections.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-sm text-slate-500 text-center">
            Data sourced from earnings call transcripts and financial reports. 
            AI analysis streams in real-time for faster feedback.
          </p>
        </div>
      </footer>
    </div>
  );
}
