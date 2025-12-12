'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatResponse from './ChatResponse';
import StrategySelector from './StrategySelector';
import OnboardingModal from './OnboardingModal';
import { 
  AlertCircle, Loader2, Bot, Send, FileText, 
  ChevronRight, ChevronDown, Activity, HelpCircle, 
  FlaskConical, Search, Building2, Calendar, TrendingUp,
  Clock, Zap, Database, BarChart3
} from 'lucide-react';
import Link from 'next/link';

// Pipeline Stages Component - Shows progress through RAG pipeline
function PipelineStages({ stage, activeTools, totalVectors = 11929 }) {
  const stages = [
    { id: 'analyze', label: 'Analyzing query', icon: '🔍' },
    { id: 'retrieve', label: `Searching ${totalVectors.toLocaleString()} vectors`, icon: '📚' },
    { id: 'process', label: 'Processing results', icon: '⚙️' },
    { id: 'generate', label: 'Generating response', icon: '✨' }
  ];
  
  const getStageStatus = (stageId) => {
    const stageOrder = ['analyze', 'retrieve', 'process', 'generate'];
    const currentIndex = stageOrder.indexOf(stage);
    const stageIndex = stageOrder.indexOf(stageId);
    
    if (stageIndex < currentIndex) return 'complete';
    if (stageIndex === currentIndex) return 'active';
    return 'pending';
  };
  
  return (
    <div className="space-y-2">
      {stages.map((s) => {
        const status = getStageStatus(s.id);
        return (
          <div 
            key={s.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
              status === 'complete' ? 'bg-emerald-50 text-emerald-700' :
              status === 'active' ? 'bg-blue-50 text-blue-700' :
              'bg-slate-50 text-slate-400'
            }`}
          >
            <span className="text-base">
              {status === 'complete' ? '✓' : status === 'active' ? '●' : '○'}
            </span>
            <span className="text-sm font-medium">{s.label}</span>
            {status === 'active' && (
              <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Confidence Indicator Component
function ConfidenceIndicator({ citations, metrics }) {
  if (!citations || citations.length === 0) return null;
  
  const avgScore = metrics?.avgRetrievalScore || 0;
  const sourceCount = citations.length;
  
  // Determine confidence level
  let confidence = 'medium';
  let message = '';
  let color = 'amber';
  
  if (sourceCount >= 5 && avgScore >= 0.6) {
    confidence = 'high';
    message = `High confidence: Based on ${sourceCount} verified sources`;
    color = 'emerald';
  } else if (sourceCount >= 3 && avgScore >= 0.4) {
    confidence = 'medium';
    message = `Moderate confidence: ${sourceCount} sources found`;
    color = 'amber';
  } else {
    confidence = 'low';
    message = `Limited data: Only ${sourceCount} source${sourceCount !== 1 ? 's' : ''} found`;
    color = 'rose';
  }
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-${color}-50 text-${color}-700 border border-${color}-200`}>
      {confidence === 'high' && <span>✅</span>}
      {confidence === 'medium' && <span>⚡</span>}
      {confidence === 'low' && <span>⚠️</span>}
      <span>{message}</span>
    </div>
  );
}

// Behind the Scenes Panel - Shows RAG pipeline details
function BehindTheScenes({ isOpen, onToggle, toolCalls, citations, systemInfo }) {
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 transition-colors mt-4"
      >
        <FlaskConical className="w-3.5 h-3.5" />
        <span>Show how this was generated</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    );
  }
  
  return (
    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-sm text-slate-700">Behind the Scenes</span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      
      <div className="p-4 space-y-4 bg-white">
        {/* Tool Calls */}
        {toolCalls && toolCalls.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Tool Calls ({toolCalls.length})
            </h4>
            <div className="space-y-2">
              {toolCalls.map((tool, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <code className="font-mono text-blue-600">{tool.tool}</code>
                    <span className={`px-2 py-0.5 rounded-full ${tool.success ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {tool.latencyMs}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Retrieved Chunks Preview */}
        {citations && citations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Retrieved Chunks ({citations.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {citations.slice(0, 5).map((c, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-700">{c.source}</span>
                    <span className="text-slate-400">{c.quarter} FY{c.fiscalYear}</span>
                  </div>
                  <p className="text-slate-600 line-clamp-2">{c.text?.slice(0, 150)}...</p>
                </div>
              ))}
              {citations.length > 5 && (
                <p className="text-xs text-slate-400 text-center">
                  +{citations.length - 5} more chunks
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* System Info */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            System Configuration
          </h4>
          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Embedding Model</span>
              <span className="font-mono text-slate-700">voyage-3.5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">LLM</span>
              <span className="font-mono text-slate-700">claude-sonnet-4</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vector DB</span>
              <span className="font-mono text-slate-700">Pinecone</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Search Type</span>
              <span className="font-mono text-slate-700">Hybrid (Dense + BM25)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// RAG Metrics Panel - Shows pipeline performance
function RAGMetricsPanel({ metrics, isVisible }) {
  if (!isVisible || !metrics) return null;
  
  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-blue-600" />
        <span className="font-semibold text-sm text-slate-700">Pipeline Metrics</span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Time to First Token */}
        <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-slate-500">First Token</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {metrics.timeToFirstTokenMs ? `${(metrics.timeToFirstTokenMs / 1000).toFixed(1)}s` : '—'}
          </div>
        </div>
        
        {/* Total Time */}
        <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-slate-500">Total Time</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {metrics.totalTimeMs ? `${(metrics.totalTimeMs / 1000).toFixed(1)}s` : '—'}
          </div>
        </div>
        
        {/* Retrieved Chunks */}
        <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-slate-500">Retrieved</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {metrics.retrievalResults || 0} <span className="text-xs font-normal text-slate-400">chunks</span>
          </div>
        </div>
        
        {/* Relevance Score */}
        <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs text-slate-500">Avg Score</span>
          </div>
          <div className="text-lg font-bold text-slate-800">
            {metrics.avgRetrievalScore 
              ? metrics.avgRetrievalScore > 1 
                ? metrics.avgRetrievalScore.toFixed(2)  // dotproduct scores (not normalized)
                : `${(metrics.avgRetrievalScore * 100).toFixed(0)}%`  // cosine scores (0-1)
              : '—'}
          </div>
        </div>
      </div>
      
      {/* Tool breakdown */}
      {metrics.toolBreakdown && metrics.toolBreakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 mb-2">Tool Execution</div>
          <div className="flex flex-wrap gap-2">
            {metrics.toolBreakdown.map((tool, i) => (
              <div 
                key={i}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                  tool.success 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                <span>{tool.tool.replace(/_/g, ' ')}</span>
                <span className="text-slate-400">•</span>
                <span className="font-mono">{tool.latencyMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [ragMetrics, setRagMetrics] = useState(null);
const [dataFreshness, setDataFreshness] = useState(null);
  const [showBehindScenes, setShowBehindScenes] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const inputRef = useRef(null);
  const responseAreaRef = useRef(null);
  const hasHandledInitialQuery = useRef(false);
  
  // Auto-scroll to bottom when response updates
  useEffect(() => {
    if (responseAreaRef.current && (currentResponse || loading)) {
      responseAreaRef.current.scrollTop = responseAreaRef.current.scrollHeight;
    }
  }, [currentResponse, loading, activeTools]);
  
  // Auto-focus input after response completes (for follow-up questions)
  useEffect(() => {
    if (!loading && currentResponse && inputRef.current) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, currentResponse]);
  
  const handleSubmit = useCallback(async (e, customQuery = null) => {
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
    setRagMetrics(null);
    setShowBehindScenes(false);
    setStatusMessage('');
    
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
                  if (data.dataFreshness) setDataFreshness(data.dataFreshness);
                  break;
                case 'status':
                  setStatusMessage(data.message);
                  break;
                case 'content':
                  analysis += data.content;
                  setCurrentResponse(analysis);
                  break;
                case 'metrics':
                  metrics = data.metrics;
                  setCurrentMetrics(metrics);
                  setRagMetrics(data.metrics);
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
  }, [query, setError, setLoading, setCurrentResponse, setCurrentCitations, setCurrentMetadata, setCurrentMetrics, setIsFirstQuery, setActiveTools, setDataSources, setRagMetrics, setShowBehindScenes, setStatusMessage]);
  
  // Handle initial query from URL
  useEffect(() => {
    if (initialQuery && !hasHandledInitialQuery.current) {
      hasHandledInitialQuery.current = true;
      setQuery(initialQuery);
      setTimeout(() => {
        handleSubmit({ preventDefault: () => {} }, initialQuery);
      }, 100);
    }
  }, [initialQuery, handleSubmit]);
  
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
      {/* Onboarding Modal for first-time visitors */}
      <OnboardingModal />
      
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
        
        <div className="flex items-center gap-4">
          <Link 
            href="/how-it-works"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span>How it Works</span>
          </Link>
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
        
        {/* Right Panel - Response + Query (chat-style layout) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Response Area - scrollable */}
          <div ref={responseAreaRef} className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-rose-700">Error</p>
                  <p className="text-sm text-rose-600">{error}</p>
                </div>
              </div>
            )}
            
            {/* Empty state - Enhanced welcome */}
            {!currentResponse && !loading && isFirstQuery && (
              <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto px-4">
                {/* Logo and title */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg mb-4">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  Clarity <span className="text-blue-600">3.0</span>
                </h2>
                <p className="text-slate-500 text-center mb-6">
                  AI-powered analysis of Big Tech earnings calls, financial metrics, and strategic initiatives
                </p>
                
                {/* Available tickers */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {['AAPL', 'AMD', 'NVDA', 'GOOGL', 'META', 'MSFT', 'AMZN', 'AVGO', 'CRM', 'ORCL'].map(ticker => (
                    <span 
                      key={ticker}
                      className="px-3 py-1 text-xs font-mono font-semibold bg-slate-100 text-slate-700 rounded-full"
                    >
                      {ticker}
                    </span>
                  ))}
                </div>
                
                {/* What you can ask */}
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <div className="bg-blue-50 rounded-xl p-4 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-800">Financial Metrics</span>
                    </div>
                    <p className="text-xs text-blue-600">Revenue, EPS, margins, cash flow, segment breakdowns</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">Strategy &amp; Guidance</span>
                    </div>
                    <p className="text-xs text-emerald-600">AI initiatives, market positioning, executive commentary</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-4 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-violet-600" />
                      <span className="text-sm font-semibold text-violet-800">Comparisons</span>
                    </div>
                    <p className="text-xs text-violet-600">Cross-company analysis, YoY growth, trend analysis</p>
                  </div>
                </div>
                
                {/* Powered by */}
                <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                  <span>Powered by</span>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 rounded">Claude Sonnet</span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded">Voyage AI</span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded">Pinecone</span>
                  </div>
                </div>
                
                {dataFreshness?.latestHuman && (
                  <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
                    <span className="font-semibold">Data as of</span>
                    <span className="font-mono">{dataFreshness.latestHuman}</span>
                  </div>
                )}
                
                <p className="text-xs text-slate-400">
                  11,929 vectors • FY2020-FY2026 • Hybrid search (dense + sparse)
                </p>
              </div>
            )}
            
            {/* Loading state with pipeline stages */}
            {loading && !currentResponse && (
              <div className="max-w-md">
                {/* Progress header */}
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <span className="text-white text-[10px]">AI</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-800">Processing your query</span>
                    <p className="text-xs text-slate-500">
                      {statusMessage || (activeTools.length > 0 
                        ? `${activeTools.filter(t => t.status === 'complete').length}/${activeTools.length} tools complete`
                        : 'Initializing pipeline...'
                      )}
                    </p>
                  </div>
                </div>
                
                {/* Pipeline stages visualization */}
                <PipelineStages 
                  stage={
                    activeTools.length === 0 ? 'analyze' :
                    activeTools.some(t => t.status === 'running') ? 'retrieve' :
                    activeTools.every(t => t.status === 'complete') ? 'generate' : 'process'
                  }
                  activeTools={activeTools}
                />
                
                {/* Tool cards */}
                {activeTools.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-2">Active Tools</p>
                    <div className="space-y-2">
                      {activeTools.map((t) => (
                        <ToolIndicator key={t.id} tool={t.name} status={t.status} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Response */}
            {currentResponse && (
              <>
                {/* Confidence indicator - show after streaming */}
                {!loading && currentCitations.length > 0 && (
                  <div className="mb-4">
                    <ConfidenceIndicator citations={currentCitations} metrics={ragMetrics} />
                  </div>
                )}
                
                <ChatResponse
                  content={currentResponse}
                  query={query}
                  isStreaming={loading}
                  onFollowUp={handleFollowUpQuestion}
                  onReset={handleReset}
                  sources={dataSources}
                />
                
                {/* RAG Metrics - show after streaming completes */}
                <RAGMetricsPanel metrics={ragMetrics} isVisible={!loading && ragMetrics} />
                
                {/* Behind the Scenes - show after streaming */}
                {!loading && (
                  <BehindTheScenes
                    isOpen={showBehindScenes}
                    onToggle={() => setShowBehindScenes(!showBehindScenes)}
                    toolCalls={ragMetrics?.toolBreakdown}
                    citations={currentCitations}
                  />
                )}
              </>
            )}
          </div>
          
          {/* Query Input - fixed at bottom */}
          <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  id="chat-query"
                  name="query"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={currentResponse && !loading 
                    ? "Ask a follow-up question..." 
                    : "Ask about Apple, AMD, Nvidia, Microsoft, Google, Meta..."
                  }
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
              <div className="mt-3">
                <p className="text-xs text-slate-400 mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { text: "Compare NVDA vs AMD vs AVGO latest revenue", color: "blue" },
                    { text: "What is Google's AI strategy?", color: "emerald" },
                    { text: "NVIDIA data center revenue trend", color: "violet" },
                    { text: "Apple gross margin by segment", color: "amber" }
                  ].map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(example.text)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors border
                        ${example.color === 'blue' ? 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' : ''}
                        ${example.color === 'emerald' ? 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' : ''}
                        ${example.color === 'violet' ? 'text-violet-600 bg-violet-50 border-violet-200 hover:bg-violet-100' : ''}
                        ${example.color === 'amber' ? 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' : ''}
                      `}
                    >
                      {example.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
