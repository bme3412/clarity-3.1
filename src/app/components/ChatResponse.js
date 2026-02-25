'use client';

import React, { useMemo } from 'react';
import { 
  MessageCircle, RefreshCw, ChevronRight, 
  TrendingUp, BarChart3, Building2, Lightbulb,
  FileText, Database, Calculator, BookOpen
} from 'lucide-react';

// Parse markdown tables into structured data
function parseMarkdownTable(tableStr) {
  const lines = tableStr.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  
  // Check if it's a table (has | characters)
  if (!lines[0].includes('|')) return null;
  
  const parseRow = (row) => {
    return row.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell && !cell.match(/^-+$/));
  };
  
  const headers = parseRow(lines[0]);
  
  // Find separator line and skip it
  const separatorIndex = lines.findIndex(l => l.match(/^\|?\s*[-:]+\s*\|/));
  const dataStartIndex = separatorIndex >= 0 ? separatorIndex + 1 : 1;
  
  const rows = lines.slice(dataStartIndex)
    .map(parseRow)
    .filter(row => row.length > 0);
  
  return { headers, rows };
}

// Render a nice table
function RenderedTable({ data, title }) {
  if (!data || !data.rows.length) return null;
  
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {title && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {data.headers.map((header, i) => (
                <th 
                  key={i} 
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                {row.map((cell, j) => (
                  <td 
                    key={j} 
                    className={`px-4 py-3 ${j === 0 ? 'font-medium text-slate-900' : 'text-slate-600'}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Parse and render content blocks
function parseContent(text) {
  if (!text) return [];
  
  const blocks = [];
  const lines = text.split('\n');
  let currentBlock = { type: 'paragraph', content: [] };
  let inTable = false;
  let tableLines = [];
  let tableTitle = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check for section headers (like "BY PRODUCT CATEGORY")
    if (trimmed.match(/^[A-Z][A-Z\s&]+$/)) {
      if (currentBlock.content.length > 0) {
        blocks.push({ ...currentBlock });
        currentBlock = { type: 'paragraph', content: [] };
      }
      tableTitle = trimmed;
      continue;
    }
    
    // Check for table start
    if (trimmed.includes('|') && !inTable) {
      if (currentBlock.content.length > 0) {
        blocks.push({ ...currentBlock });
        currentBlock = { type: 'paragraph', content: [] };
      }
      inTable = true;
      tableLines = [line];
      continue;
    }
    
    // Continue table
    if (inTable) {
      if (trimmed.includes('|') || trimmed.match(/^-+$/)) {
        tableLines.push(line);
      } else {
        // End of table
        const tableData = parseMarkdownTable(tableLines.join('\n'));
        if (tableData) {
          blocks.push({ type: 'table', data: tableData, title: tableTitle });
        }
        tableLines = [];
        tableTitle = null;
        inTable = false;
        // Process current line
        if (trimmed) {
          currentBlock.content.push(trimmed);
        }
      }
      continue;
    }
    
    // Check for bullet points
    if (trimmed.match(/^[-•*]\s+/)) {
      if (currentBlock.type !== 'list') {
        if (currentBlock.content.length > 0) {
          blocks.push({ ...currentBlock });
        }
        currentBlock = { type: 'list', content: [] };
      }
      currentBlock.content.push(trimmed.replace(/^[-•*]\s+/, ''));
      continue;
    }
    
    // Check for headers
    if (trimmed.match(/^#+\s+/) || trimmed.match(/^[A-Z][a-z]+.*:$/)) {
      if (currentBlock.content.length > 0) {
        blocks.push({ ...currentBlock });
        currentBlock = { type: 'paragraph', content: [] };
      }
      blocks.push({ 
        type: 'header', 
        content: trimmed.replace(/^#+\s+/, '').replace(/:$/, '')
      });
      continue;
    }
    
    // Regular text
    if (trimmed) {
      if (currentBlock.type === 'list') {
        if (currentBlock.content.length > 0) {
          blocks.push({ ...currentBlock });
        }
        currentBlock = { type: 'paragraph', content: [] };
      }
      currentBlock.content.push(trimmed);
    } else if (currentBlock.content.length > 0) {
      blocks.push({ ...currentBlock });
      currentBlock = { type: 'paragraph', content: [] };
    }
  }
  
  // Handle remaining table
  if (inTable && tableLines.length > 0) {
    const tableData = parseMarkdownTable(tableLines.join('\n'));
    if (tableData) {
      blocks.push({ type: 'table', data: tableData, title: tableTitle });
    }
  }
  
  // Push remaining content
  if (currentBlock.content.length > 0) {
    blocks.push({ ...currentBlock });
  }
  
  return blocks;
}

// Format text with inline styling
function FormatText({ text }) {
  if (!text) return null;
  
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Render content block
function ContentBlock({ block }) {
  switch (block.type) {
    case 'table':
      return <RenderedTable data={block.data} title={block.title} />;
    
    case 'header':
      return (
        <h3 className="text-base font-semibold text-slate-900 mt-6 mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full" />
          {block.content}
        </h3>
      );
    
    case 'list':
      return (
        <div className="my-4 space-y-2 bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-4 border border-blue-100">
          {block.content.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
              <span className="text-slate-700 leading-relaxed">
                <FormatText text={item} />
              </span>
            </div>
          ))}
        </div>
      );
    
    case 'paragraph':
    default:
      const text = block.content.join(' ');
      if (!text.trim()) return null;
      return (
        <p className="text-slate-700 leading-relaxed my-3">
          <FormatText text={text} />
        </p>
      );
  }
}

// Follow-up question suggestions
function FollowUpSuggestions({ query, onAsk }) {
  const suggestions = useMemo(() => {
    const q = (query || '').toLowerCase();
    const suggestions = [];
    
    // Context-aware suggestions based on query
    if (q.includes('revenue') || q.includes('segment')) {
      suggestions.push({
        icon: TrendingUp,
        text: "How does this compare to last quarter?",
        color: "blue"
      });
      suggestions.push({
        icon: BarChart3,
        text: "What's driving the growth in each segment?",
        color: "emerald"
      });
    }
    
    if (q.includes('apple') || q.includes('aapl')) {
      suggestions.push({
        icon: Building2,
        text: "How is Apple's Services business performing?",
        color: "violet"
      });
      suggestions.push({
        icon: Lightbulb,
        text: "What AI investments is Apple making?",
        color: "amber"
      });
    }
    
    if (q.includes('nvidia') || q.includes('nvda')) {
      suggestions.push({
        icon: BarChart3,
        text: "What's the data center revenue breakdown?",
        color: "emerald"
      });
      suggestions.push({
        icon: TrendingUp,
        text: "What's the guidance for next quarter?",
        color: "blue"
      });
    }
    
    if (q.includes('amd')) {
      suggestions.push({
        icon: Building2,
        text: "How is AMD's MI300 competing with Nvidia?",
        color: "violet"
      });
      suggestions.push({
        icon: BarChart3,
        text: "What's AMD's data center segment growth?",
        color: "emerald"
      });
    }
    
    if (q.includes('microsoft') || q.includes('msft')) {
      suggestions.push({
        icon: Lightbulb,
        text: "How is Azure AI performing?",
        color: "amber"
      });
      suggestions.push({
        icon: TrendingUp,
        text: "What's Microsoft's cloud growth rate?",
        color: "blue"
      });
    }
    
    if (q.includes('google') || q.includes('googl') || q.includes('alphabet')) {
      suggestions.push({
        icon: Building2,
        text: "How is Google Cloud performing?",
        color: "violet"
      });
      suggestions.push({
        icon: Lightbulb,
        text: "What's Google's AI strategy?",
        color: "amber"
      });
    }
    
    // Default suggestions
    if (suggestions.length < 2) {
      suggestions.push({
        icon: TrendingUp,
        text: "What's the year-over-year growth?",
        color: "blue"
      });
      suggestions.push({
        icon: Lightbulb,
        text: "What are the key risks mentioned?",
        color: "amber"
      });
    }
    
    return suggestions.slice(0, 3);
  }, [query]);
  
  const colorStyles = {
    blue: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
    violet: "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200",
    amber: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
  };
  
  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Continue the conversation
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, i) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={i}
              onClick={() => onAsk(suggestion.text)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${colorStyles[suggestion.color]}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{suggestion.text}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Source citations component
function SourceCitations({ sources }) {
  // Deduplicate and organize sources
  const organizedSources = useMemo(() => {
    const safeSources = sources ?? [];
    const byType = {
      financial: [],
      transcript: [],
      computed: []
    };
    
    safeSources.forEach(source => {
      if (source.type && byType[source.type]) {
        byType[source.type].push(source);
      }
    });
    
    return byType;
  }, [sources]);
  
  const getIcon = (type) => {
    switch (type) {
      case 'financial': return Database;
      case 'transcript': return BookOpen;
      case 'computed': return Calculator;
      default: return FileText;
    }
  };
  
  const getTypeLabel = (type) => {
    switch (type) {
      case 'financial': return 'Financial Data';
      case 'transcript': return 'Earnings Transcripts';
      case 'computed': return 'Computed Metrics';
      default: return 'Source';
    }
  };
  
  const getTypeColor = (type) => {
    switch (type) {
      case 'financial': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'transcript': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'computed': return 'bg-violet-50 text-violet-700 border-violet-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };
  
  const hasAnySources = Object.values(organizedSources).some(arr => arr.length > 0);
  if (!hasAnySources) return null;
  
  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Data Sources
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {Object.entries(organizedSources).map(([type, items]) => {
          if (items.length === 0) return null;
          
          const Icon = getIcon(type);
          const allPeriods = [...new Set(items.flatMap(item => 
            item.periods || (item.period ? [item.period] : [])
          ))];
          const allTickers = [...new Set(items.map(item => item.ticker).filter(Boolean))];
          
          return (
            <div 
              key={type}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${getTypeColor(type)}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <div className="flex flex-col">
                <span className="font-medium">{getTypeLabel(type)}</span>
                <span className="opacity-75">
                  {allTickers.length > 0 && `${allTickers.join(', ')} · `}
                  {allPeriods.length > 0 
                    ? allPeriods.slice(0, 4).join(', ') + (allPeriods.length > 4 ? ` +${allPeriods.length - 4} more` : '')
                    : 'Multiple periods'
                  }
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Main chat response component
export default function ChatResponse({ content, query, isStreaming, onFollowUp, onReset, sources }) {
  const blocks = useMemo(() => parseContent(content), [content]);
  
  if (!content) return null;
  
  return (
    <div className="max-w-3xl">
      {/* Main content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="prose prose-slate max-w-none">
          {blocks.map((block, i) => (
            <ContentBlock key={i} block={block} />
          ))}
        </div>
        
        {/* Source citations */}
        {!isStreaming && sources && sources.length > 0 && (
          <SourceCitations sources={sources} />
        )}
        
        {/* Streaming indicator */}
        {isStreaming && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>Analyzing...</span>
          </div>
        )}
      </div>
      
      {/* Follow-up hint - removed hardcoded suggestions */}
      
      {/* Reset button */}
      {!isStreaming && onReset && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Start new analysis
          </button>
        </div>
      )}
    </div>
  );
}

