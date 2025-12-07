'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, FileText, ArrowUp, ArrowDown } from 'lucide-react';


// Main Transcript Viewer - Full transcript with search/highlight
export default function TranscriptViewer({ ticker, fiscalYear, quarter }) {
  const [rawTranscript, setRawTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const matchRefs = useRef([]);
  
  // Load transcript data
  useEffect(() => {
    if (!ticker || !fiscalYear || !quarter) return;
    
    setLoading(true);
    setError(null);
    
    fetch(`/api/reports/transcript?ticker=${ticker}&fiscalYear=${fiscalYear}&quarter=${quarter}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setRawTranscript(data.rawTranscript);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker, fiscalYear, quarter]);
  
  // Process transcript with search highlighting
  const { processedContent, totalMatches } = useMemo(() => {
    if (!rawTranscript) return { processedContent: null, totalMatches: 0 };
    if (!searchTerm || searchTerm.length < 2) {
      return { processedContent: rawTranscript, totalMatches: 0 };
    }
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = rawTranscript.split(regex);
    let matchIndex = 0;
    
    const content = parts.map((part, i) => {
      if (regex.test(part)) {
        const idx = matchIndex++;
        return (
          <mark 
            key={i} 
            ref={el => matchRefs.current[idx] = el}
            className={`px-0.5 rounded transition-colors ${
              idx === currentMatch 
                ? 'bg-orange-400 text-orange-950 ring-2 ring-orange-500' 
                : 'bg-yellow-200 text-yellow-900'
            }`}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
    
    return { processedContent: content, totalMatches: matchIndex };
  }, [rawTranscript, searchTerm, currentMatch]);
  
  // Update match count when it changes
  useEffect(() => {
    setMatchCount(totalMatches);
    setCurrentMatch(0);
    matchRefs.current = [];
  }, [totalMatches]);
  
  // Navigate to current match
  useEffect(() => {
    if (matchRefs.current[currentMatch]) {
      matchRefs.current[currentMatch].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [currentMatch]);
  
  const goToNextMatch = () => {
    if (matchCount > 0) {
      setCurrentMatch((currentMatch + 1) % matchCount);
    }
  };
  
  const goToPrevMatch = () => {
    if (matchCount > 0) {
      setCurrentMatch((currentMatch - 1 + matchCount) % matchCount);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          Loading transcript...
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700">
        {error}
      </div>
    );
  }
  
  if (!rawTranscript) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <FileText className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-amber-700 font-medium">Transcript not available</p>
        <p className="text-amber-600 text-sm mt-1">
          No raw transcript file found for this period.
        </p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Search Bar - Fixed at top */}
      <div className="bg-white border-b border-slate-200 p-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="transcript-search"
              name="searchTerm"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search transcript... (Enter to find next, Shift+Enter for previous)"
              className="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Match navigation */}
          {matchCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 whitespace-nowrap">
                <span className="font-medium text-slate-900">{currentMatch + 1}</span>
                {' / '}
                <span className="font-medium">{matchCount}</span>
                <span className="text-slate-400 ml-1">matches</span>
              </span>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={goToPrevMatch}
                  className="p-1.5 hover:bg-slate-100 transition-colors border-r border-slate-200"
                  title="Previous match (Shift+Enter)"
                >
                  <ArrowUp className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  onClick={goToNextMatch}
                  className="p-1.5 hover:bg-slate-100 transition-colors"
                  title="Next match (Enter)"
                >
                  <ArrowDown className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
          
          {searchTerm && matchCount === 0 && searchTerm.length >= 2 && (
            <span className="text-sm text-slate-500">No matches</span>
          )}
        </div>
      </div>
      
      {/* Transcript Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-slate-500" />
              <span className="font-semibold text-slate-900">
                {ticker} {quarter} FY{fiscalYear} Earnings Call Transcript
              </span>
            </div>
            <span className="text-sm text-slate-500">
              {rawTranscript.length.toLocaleString()} characters
            </span>
          </div>
          
          {/* Transcript */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <pre className="p-6 whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed overflow-x-hidden">
              {processedContent}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

