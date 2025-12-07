'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatResponse from './ChatResponse';
import StrategySelector from './StrategySelector';
import PipelineMetrics from './PipelineMetrics';
import { 
  AlertCircle, Loader2, Bot, Send, FileText, 
  ChevronRight, ChevronDown, Activity, HelpCircle, 
  FlaskConical, Search, Building2, Calendar, TrendingUp
} from 'lucide-react';
import Link from 'next/link';

// Context Panel - Shows retrieved sources (same as workbook)
function ContextPanel({ citations, loading, detectedTickers, strategy }) {
  const [expandedSource, setExpandedSource] = useState(null);
  
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-3" />
        <p className="text-sm">Searching knowledge base...</p>
      </div>
    );
  }
  
  if (!citations || citations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6">
        <FileText className="w-10 h-10 mb-3 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No sources yet</p>
        <p className="text-xs text-slate-400 mt-1 text-center">Ask a question to retrieve relevant earnings data</p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-900 text-sm">Retrieved Sources</span>
          </div>
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
            {citations.length} found
          </span>
        </div>
        
        {/* Detected tickers */}
        {detectedTickers && detectedTickers.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Building2 className="w-3 h-3 text-slate-400" />
            <div className="flex flex-wrap gap-1">
              {detectedTickers.map(ticker => (
                <span key={ticker} className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-mono">
                  {ticker}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Strategy badge */}
        {strategy && (
          <div className="flex items-center gap-2 mt-2">
            <FlaskConical className="w-3 h-3 text-slate-400" />
            <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded capitalize">
              {strategy.replace('-', ' ').replace('bm25', '')}
            </span>
          </div>
        )}
      </div>
      
      {/* Sources list */}
      <div className="flex-1 overflow-y-auto">
        {citations.map((citation, i) => (
          <div 
            key={i}
            className="border-b border-slate-100 last:border-0"
          >
            <button
              onClick={() => setExpandedSource(expandedSource === i ? null : i)}
              className="w-full p-3 text-left hover:bg-slate-50 transition-colors flex items-start gap-3"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-slate-500 truncate">
                    {citation.source}
                  </span>
                  {citation.score && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                      {parseFloat(citation.score) > 1 
                        ? parseFloat(citation.score).toFixed(2)  // Hybrid scores (can be >1)
                        : (parseFloat(citation.score) * 100).toFixed(0) + '%'  // Dense scores (0-1)
                      }
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {citation.fiscalYear && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      FY{citation.fiscalYear}
                    </span>
                  )}
                  {citation.quarter && (
                    <span>{citation.quarter}</span>
                  )}
                </div>
              </div>
              {expandedSource === i ? (
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
            </button>
            
            {/* Expanded content */}
            {expandedSource === i && (
              <div className="px-3 pb-3">
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed border border-slate-100 max-h-48 overflow-y-auto">
                  {citation.text}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolIndicator({ tool, status }) {
  const toolInfo = {
    get_financial_metrics: { icon: '📊', label: 'Fetching financial data', color: 'emerald' },
    get_multi_quarter_metrics: { icon: '📈', label: 'Loading quarterly trends', color: 'blue' },
    compute_growth_rate: { icon: '📉', label: 'Calculating growth', color: 'violet' },
    search_earnings_transcript: { icon: '🔍', label: 'Searching transcripts', color: 'amber' },
    list_available_data: { icon: '📁', label: 'Checking available data', color: 'slate' }
  };
  
  const info = toolInfo[tool] || { icon: '🔧', label: tool, color: 'slate' };
  const isRunning = status === 'running';
  
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
      isRunning 
        ? 'bg-blue-50 border border-blue-200' 
        : 'bg-slate-50 border border-slate-200'
    }`}>
      <span className="text-lg">{info.icon}</span>
      <span className={`text-sm ${isRunning ? 'text-blue-700' : 'text-slate-600'}`}>
        {info.label}
      </span>
      {isRunning ? (
        <div className="flex gap-1 ml-auto">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      ) : (
        <span className="ml-auto text-emerald-500">✓</span>
      )}
    </div>
  );
}

export default function Chatbox() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q');
  const initialStrategy = searchParams.get('strategy');
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentResponse, setCurrentResponse] = useState(null);
  const [currentCitations, setCurrentCitations] = useState([]);
  const [currentMetadata, setCurrentMetadata] = useState(null);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(initialStrategy || 'auto');
  const [isFirstQuery, setIsFirstQuery] = useState(true);
  const [activeTools, setActiveTools] = useState([]);
  const [dataSources, setDataSources] = useState([]);
  
  const inputRef = useRef(null);
  const hasHandledInitialQuery = useRef(false);
  
  // Handle initial query from URL
  useEffect(() => {
    if (initialQuery && !hasHandledInitialQuery.current) {
      hasHandledInitialQuery.current = true;
      setQuery(initialQuery);
      setTimeout(() => {
        handleSubmit({ preventDefault: () => {} }, initialQuery);
      }, 100);
    }
  }, [initialQuery]);
  
  async function handleSubmit(e, customQuery = null) {
    e.preventDefault();
    const queryToSubmit = customQuery || query;
    console.log('[Chatbox] handleSubmit called with query:', queryToSubmit);
    if (!queryToSubmit.trim()) {
      console.log('[Chatbox] Empty query, returning');
      return;
    }
    
    setLoading(true);
    setError(null);
    setCurrentResponse(null);
    setCurrentCitations([]);
    setCurrentMetadata(null);
    setCurrentMetrics(null);
    setIsFirstQuery(false);
    setActiveTools([]);
    setDataSources([]);
    
    try {
      console.log('[Chatbox] Sending request to /api/chat/stream');
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: queryToSubmit,
          chatHistory: []
        }),
      });
      
      console.log('[Chatbox] Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Chatbox] Error response:', errorText);
        throw new Error(`Request failed: ${errorText}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let analysis = '';
      let metadata = {};
      let citations = [];
      let metrics = null;
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'metadata':
                  metadata = data;
                  setCurrentMetadata(data);
                  break;
                case 'content':
                  analysis += data.content;
                  setCurrentResponse(analysis);
                  break;
                case 'metrics':
                  metrics = data.metrics;
                  setCurrentMetrics(metrics);
                  break;
                case 'tool_start':
                  setActiveTools((prev) => [...prev, { id: data.id, name: data.tool, status: 'running' }]);
                  // Extract ticker from tool input if available
                  if (data.input?.ticker) {
                    setCurrentMetadata(prev => ({
                      ...prev,
                      detectedTickers: [...new Set([...(prev?.detectedTickers || []), data.input.ticker])]
                    }));
                  }
                  break;
                case 'tool_result':
                  setActiveTools((prev) =>
                    prev.map((t) => t.id === data.id ? { ...t, status: 'complete' } : t)
                  );
                  // Extract source citations from tool results
                  if (data.success && data.result) {
                    const result = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
                    const actualResult = result.result || result;
                    
                    // Extract detected ticker from result
                    if (actualResult.ticker) {
                      setCurrentMetadata(prev => ({
                        ...prev,
                        detectedTickers: [...new Set([...(prev?.detectedTickers || []), actualResult.ticker])]
                      }));
                    }
                    
                    // Extract source info based on tool type
                    if (data.tool === 'get_financial_metrics' && actualResult.found) {
                      const newCitation = {
                        source: `${actualResult.ticker} Financial Data`,
                        fiscalYear: actualResult.period?.split(' ')[1]?.replace('FY', ''),
                        quarter: actualResult.period?.split(' ')[0],
                        text: `Financial metrics: ${Object.entries(actualResult.metrics || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
                        score: '1.0',
                        type: 'financial',
                        _key: `fin-${actualResult.ticker}-${actualResult.period}`
                      };
                      setCurrentCitations(prev => {
                        if (prev.some(c => c._key === newCitation._key)) return prev;
                        return [...prev, newCitation];
                      });
                      setDataSources(prev => [...prev, {
                        type: 'financial',
                        ticker: actualResult.ticker,
                        period: actualResult.period,
                        metrics: Object.keys(actualResult.metrics || {}),
                        source: 'Quarterly Financial Data'
                      }]);
                    } else if (data.tool === 'get_multi_quarter_metrics' && actualResult.periods) {
                      const periods = actualResult.periods.filter(p => Object.keys(p.metrics || {}).length > 0);
                      if (periods.length > 0) {
                        // Add a citation for each period (with deduplication)
                        periods.forEach(p => {
                          const newCitation = {
                            source: `${actualResult.ticker} Financial Data`,
                            fiscalYear: p.period?.split(' ')[1]?.replace('FY', ''),
                            quarter: p.period?.split(' ')[0],
                            text: `Financial metrics: ${Object.entries(p.metrics || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
                            score: '1.0',
                            type: 'financial',
                            _key: `fin-${actualResult.ticker}-${p.period}`
                          };
                          setCurrentCitations(prev => {
                            if (prev.some(c => c._key === newCitation._key)) return prev;
                            return [...prev, newCitation];
                          });
                        });
                        setDataSources(prev => [...prev, {
                          type: 'financial',
                          ticker: actualResult.ticker,
                          periods: periods.map(p => p.period),
                          source: 'Quarterly Financial Data'
                        }]);
                      }
                    } else if (data.tool === 'search_earnings_transcript' && actualResult.results?.length) {
                      // Add each transcript result as a citation (with deduplication)
                      actualResult.results.slice(0, 10).forEach(r => {
                        const newCitation = {
                          source: `${actualResult.ticker || r.company} Earnings Transcript`,
                          fiscalYear: r.fiscalYear,
                          quarter: r.quarter,
                          text: r.text || r.content || 'Transcript excerpt',
                          score: r.score?.toString() || '0.9',
                          type: 'transcript',
                          // Unique key for deduplication
                          _key: `${actualResult.ticker}-${r.fiscalYear}-${r.quarter}-${(r.text || '').slice(0, 50)}`
                        };
                        setCurrentCitations(prev => {
                          // Check for duplicates
                          if (prev.some(c => c._key === newCitation._key)) {
                            return prev;
                          }
                          return [...prev, newCitation];
                        });
                      });
                      const uniqueSources = [...new Set(actualResult.results.slice(0, 5).map(r => 
                        `${r.quarter || ''} FY${r.fiscalYear || ''}`
                      ))].filter(s => s.trim() !== 'FY');
                      if (uniqueSources.length > 0) {
                        setDataSources(prev => [...prev, {
                          type: 'transcript',
                          ticker: actualResult.ticker,
                          periods: uniqueSources,
                          source: 'Earnings Call Transcripts'
                        }]);
                      }
                    } else if (data.tool === 'compute_growth_rate' && actualResult.success) {
                      const newCitation = {
                        source: `${actualResult.ticker} Growth Calculation`,
                        fiscalYear: actualResult.comparisonPeriod?.period?.split(' ')[1]?.replace('FY', ''),
                        quarter: actualResult.comparisonPeriod?.period?.split(' ')[0],
                        text: `${actualResult.metric} growth: ${actualResult.growthRate} (${actualResult.basePeriod?.period} → ${actualResult.comparisonPeriod?.period})`,
                        score: '1.0',
                        type: 'computed',
                        _key: `growth-${actualResult.ticker}-${actualResult.metric}-${actualResult.comparisonPeriod?.period}`
                      };
                      setCurrentCitations(prev => {
                        if (prev.some(c => c._key === newCitation._key)) return prev;
                        return [...prev, newCitation];
                      });
                      setDataSources(prev => [...prev, {
                        type: 'computed',
                        ticker: actualResult.ticker,
                        metric: actualResult.metric,
                        periods: [actualResult.basePeriod?.period, actualResult.comparisonPeriod?.period].filter(Boolean),
                        source: 'Computed Metrics'
                      }]);
                    }
                  }
                  break;
                case 'end':
                  setLoading(false);
                  setActiveTools([]);
                  break;
                case 'error':
                  throw new Error(data.error);
                default:
                  break;
              }
            } catch (parseError) {
              console.error('Parse error:', parseError);
            }
          }
        }
      }
      
      setQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  const handleFollowUpQuestion = (question) => {
    setQuery(question);
    setTimeout(() => {
      handleSubmit({ preventDefault: () => {} }, question);
    }, 100);
  };

  const handleReset = () => {
    setCurrentResponse(null);
    setCurrentCitations([]);
    setCurrentMetadata(null);
    setCurrentMetrics(null);
    setIsFirstQuery(true);
    setError(null);
    setQuery('');
  };
  
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900">
              Clarity <span className="text-blue-600">3.0</span>
            </h1>
            <p className="text-xs text-slate-500">Financial Intelligence</p>
          </div>
        </Link>
        
        <div className="flex items-center gap-3">
          <StrategySelector 
            selectedStrategy={selectedStrategy}
            onStrategyChange={setSelectedStrategy}
            compact={true}
          />
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Context/Sources */}
        <div className="w-80 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
          <ContextPanel 
            citations={currentCitations}
            loading={loading && currentCitations.length === 0 && activeTools.length > 0}
            detectedTickers={currentMetadata?.detectedTickers}
            strategy={selectedStrategy}
          />
        </div>
        
        {/* Right Panel - Query + Response */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Query Input */}
          <div className="p-4 bg-white border-b border-slate-200 flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  id="chat-query"
                  name="query"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about Apple, AMD, Nvidia, Microsoft, Google, Meta..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                  disabled={loading}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-5 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Ask</span>
              </button>
            </form>
            
            {/* Example queries - only show before first query */}
            {isFirstQuery && (
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  "What was NVIDIA's data center revenue in Q3?",
                  "How is Apple investing in AI?",
                  "Compare AMD and Intel's GPU strategies"
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(example);
                      handleSubmit({ preventDefault: () => {} }, example);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Response Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-rose-700">Error</p>
                  <p className="text-sm text-rose-600">{error}</p>
                </div>
              </div>
            )}
            
            {/* Empty state */}
            {!currentResponse && !loading && isFirstQuery && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Bot className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-lg font-medium text-slate-500">Ask a financial question</p>
                <p className="text-sm text-slate-400 mt-1">
                  I&apos;ll retrieve relevant earnings data and provide analysis
                </p>
              </div>
            )}
            
            {/* Loading state with tool progress */}
            {loading && !currentResponse && (
              <div className="max-w-xl">
                {/* Progress header */}
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">
                    {activeTools.length > 0 
                      ? `Gathering data (${activeTools.filter(t => t.status === 'complete').length}/${activeTools.length} complete)`
                      : 'Analyzing your question...'
                    }
                  </span>
                </div>
                
                {/* Tool cards */}
                {activeTools.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {activeTools.map((t) => (
                      <ToolIndicator key={t.id} tool={t.name} status={t.status} />
                    ))}
                  </div>
                )}
                
                {/* Tip */}
                {activeTools.length === 0 && (
                  <div className="text-xs text-slate-400 italic">
                    The AI is deciding which data sources to query...
                  </div>
                )}
              </div>
            )}
            
            {/* Response */}
            {currentResponse && (
              <>
                <ChatResponse
                  content={currentResponse}
                  query={query}
                  isStreaming={loading}
                  onFollowUp={handleFollowUpQuestion}
                  onReset={handleReset}
                  sources={dataSources}
                />
                
                {/* Pipeline Metrics - show after streaming completes */}
                {!loading && currentMetrics && (
                  <div className="mt-6 max-w-3xl">
                    <PipelineMetrics 
                      metrics={currentMetrics}
                      strategy={selectedStrategy}
                      isStreaming={loading}
                      hydeDoc={currentMetadata?.hydeDoc}
                      multiQueryVariations={currentMetadata?.multiQueryVariations}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
