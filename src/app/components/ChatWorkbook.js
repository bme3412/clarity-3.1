'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnalysisDisplay } from './Display';
import StrategySelector from './StrategySelector';
import { 
  AlertCircle, Loader2, Bot, User, Send, FileText, 
  ChevronRight, ChevronDown, Activity, HelpCircle, 
  FlaskConical, Search, Clock, Building2, Calendar
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Context Panel - Shows retrieved sources
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
        <p className="text-xs text-slate-400 mt-1">Ask a question to retrieve context</p>
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
            <span className="font-semibold text-slate-900 text-sm">Retrieved Context</span>
          </div>
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
            {citations.length} sources
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
            <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded">
              {strategy.replace('-', ' ')}
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
                      {(citation.score * 100).toFixed(0)}%
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
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed border border-slate-100">
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

// Main Workbook Chat
export default function ChatWorkbook() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q');
  const initialStrategy = searchParams.get('strategy');
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentResponse, setCurrentResponse] = useState(null);
  const [currentCitations, setCurrentCitations] = useState([]);
  const [currentMetadata, setCurrentMetadata] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState(initialStrategy || 'auto');
  const [showHistory, setShowHistory] = useState(false);
  
  const inputRef = useRef(null);
  const hasHandledInitialQuery = useRef(false);
  
  const handleSubmit = useCallback(async (e, customQuery = null) => {
    e.preventDefault();
    const queryToSubmit = customQuery || query;
    if (!queryToSubmit.trim()) return;
    
    setLoading(true);
    setError(null);
    setCurrentResponse(null);
    setCurrentCitations([]);
    setCurrentMetadata(null);
    
    try {
      const response = await fetch('/api/chat/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: queryToSubmit,
          strategy: selectedStrategy 
        }),
      });
      
      if (!response.ok) throw new Error('Request failed');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let analysis = '';
      let metadata = {};
      let citations = [];
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
              
              if (data.type === 'metadata') {
                metadata = data;
                citations = data.citations || [];
                setCurrentCitations(citations);
                setCurrentMetadata(data);
              } else if (data.type === 'content') {
                analysis += data.content;
                setCurrentResponse(analysis);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              } else if (data.type === 'end') {
                // Save to history
                setConversationHistory(prev => [...prev, {
                  id: uuidv4(),
                  query: queryToSubmit,
                  response: analysis,
                  citations,
                  metadata,
                  timestamp: new Date().toISOString(),
                  strategy: selectedStrategy
                }]);
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
  }, [query, selectedStrategy]);
  
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
  
  const loadFromHistory = (item) => {
    setCurrentResponse(item.response);
    setCurrentCitations(item.citations);
    setCurrentMetadata(item.metadata);
    setShowHistory(false);
  };
  
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900">
              Invest<span className="text-blue-600">AI</span> Workbook
            </h1>
            <p className="text-xs text-slate-500">Financial Intelligence</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <StrategySelector 
            selectedStrategy={selectedStrategy}
            onStrategyChange={setSelectedStrategy}
            compact={true}
          />
          
          {/* History toggle */}
          {conversationHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                showHistory 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              History ({conversationHistory.length})
            </button>
          )}
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Context/Sources */}
        <div className="w-80 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
          <ContextPanel 
            citations={currentCitations}
            loading={loading && currentCitations.length === 0}
            detectedTickers={currentMetadata?.detectedTickers}
            strategy={currentMetadata?.strategy}
          />
        </div>
        
        {/* Right Panel - Query + Response */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Query Input */}
          <div className="p-4 bg-white border-b border-slate-200">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  id="workbook-query"
                  name="query"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about AMD, Apple, NVIDIA, Microsoft, etc..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                  disabled={loading}
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
            
            {/* Example queries */}
            {!currentResponse && !loading && (
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
                    className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
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
            
            {!currentResponse && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Bot className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-lg font-medium text-slate-500">Ask a financial question</p>
                <p className="text-sm text-slate-400 mt-1">
                  I&apos;ll retrieve relevant earnings data and provide analysis
                </p>
              </div>
            )}
            
            {loading && !currentResponse && (
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span>Analyzing...</span>
              </div>
            )}
            
            {currentResponse && (
              <div className="max-w-3xl">
                <AnalysisDisplay 
                  analysis={{ analysis: currentResponse, metadata: currentMetadata }}
                  isStreaming={loading}
                  onQuestionClick={handleFollowUpQuestion}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* History Panel (overlay) */}
        {showHistory && (
          <div className="absolute right-0 top-16 bottom-0 w-80 bg-white border-l border-slate-200 shadow-xl z-20 overflow-y-auto">
            <div className="p-4 border-b border-slate-200 bg-slate-50 sticky top-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Query History</span>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {conversationHistory.slice().reverse().map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadFromHistory(item)}
                  className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <p className="text-sm text-slate-700 line-clamp-2 mb-2">
                    {item.query}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="px-2 py-0.5 bg-slate-100 rounded">
                      {item.citations?.length || 0} sources
                    </span>
                    <span>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

