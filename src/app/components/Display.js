import { useMemo, useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, DollarSign, BarChart2, AlertCircle, Info, Lightbulb, ChevronDown, ChevronUp, Table, ArrowRight } from 'lucide-react';
import FinancialChart from './FinancialChart';
import StructuredFinancialTable from './StructuredFinancialTable';

function parsePipeTable(raw) {
  if (!raw) return null;
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.includes('|'));

  if (lines.length < 2) return null;

  // Remove divider lines like |----|
  const cleanLines = lines.filter((l) => !/^(\|\s*-+)/.test(l.replace(/\s+/g, '')));
  if (cleanLines.length < 2) return null;

  const rows = cleanLines.map((line) =>
    line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)
  );

  if (!rows.length || rows[0].length === 0) return null;

  const headers = rows[0];
  const body = rows.slice(1).filter((r) => r.length === headers.length);

  if (!body.length) return null;

  return { headers, body };
}

// Hook for smooth text rendering
const useSmoothText = (targetText, isStreaming, speed = 15) => {
  const [displayedText, setDisplayedText] = useState('');
  const requestRef = useRef();
  const startTimeRef = useRef();
  const textRef = useRef('');

  useEffect(() => {
    // If not streaming (e.g. initial load or complete), just show full text
    if (!isStreaming) {
      setDisplayedText(targetText || '');
      textRef.current = targetText || '';
      return;
    }

    const animate = (time) => {
      if (!targetText) return;
      
      const currentLength = textRef.current.length;
      const targetLength = targetText.length;
      
      if (currentLength < targetLength) {
        // Calculate how many chars to add based on difference
        // This creates a dynamic speed - faster when further behind
        const diff = targetLength - currentLength;
        const charsToAdd = Math.max(1, Math.ceil(diff / 10)); // Smooth catch-up
        
        const nextText = targetText.slice(0, currentLength + charsToAdd);
        textRef.current = nextText;
        setDisplayedText(nextText);
        requestRef.current = requestAnimationFrame(animate);
      } else {
        // Synced up
        requestRef.current = null;
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [targetText, isStreaming]);

  return displayedText;
};

const formatQuarterlyData = (progression) => {
  if (!progression || !Array.isArray(progression)) return [];
  return progression.map(quarter => ({
    name: quarter.period,
    revenue: parseFloat(quarter.key_metrics.revenue?.replace(/[^0-9.]/g, '')) || 0,
    profit: parseFloat(quarter.key_metrics.profit?.replace(/[^0-9.]/g, '')) || 0,
    margin: parseFloat(quarter.key_metrics.margin?.replace(/[^0-9.]/g, '')) || 0
  }));
};

const MetricCard = ({ title, value, trend, icon: Icon, subtitle, index = 0 }) => (
  <div 
    className="glass-card rounded-2xl p-6 relative overflow-hidden group animate-reveal bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    {/* Ambient Glow Background */}
    <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-50 rounded-full blur-3xl group-hover:bg-blue-100 transition-all duration-500 opacity-60"></div>
    
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium uppercase tracking-wider font-mono">
          <Icon className="w-4 h-4 text-blue-600" />
          {title}
        </div>
        {trend !== null && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full font-mono ${
            trend > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
          }`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </div>
        )}
      </div>
      
      <div className="text-4xl font-bold text-slate-900 mb-1 tracking-tight font-mono-numbers">
        {value}
      </div>
      
      {subtitle && (
        <div className="text-sm text-slate-500 font-medium">
          {subtitle}
        </div>
      )}
    </div>
  </div>
);

const CollapsibleSection = ({ title, count, children, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-t border-slate-200 pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-slate-50 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 group-hover:bg-blue-100 transition-colors">
            <span className="text-xs font-mono text-slate-600 group-hover:text-blue-700">{count}</span>
          </div>
          <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
        )}
      </button>
      
      <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
        isExpanded ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'
      }`}>
        {children}
      </div>
    </div>
  );
};

const FinancialTableButton = ({ onGenerateTable, isGenerating = false }) => {
  return (
    <div className="mt-8 pt-6 border-t border-slate-200">
      <button
        onClick={onGenerateTable}
        disabled={isGenerating}
        className="w-full group relative overflow-hidden p-[1px] rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 opacity-10 group-hover:opacity-20 animate-gradient-xy"></div>
        <div className="relative bg-white rounded-xl p-4 flex items-center justify-center gap-3 border border-slate-200 group-hover:border-blue-300 transition-colors">
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-slate-700 font-medium">Generating Financial Data...</span>
            </>
          ) : (
            <>
              <Table className="w-5 h-5 text-blue-600" />
              <span className="text-slate-700 font-medium group-hover:text-blue-700 transition-colors">View Detailed Financial Table</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </>
          )}
        </div>
      </button>
    </div>
  );
};

const FollowUpQuestions = ({ questions, onQuestionClick }) => {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-wider font-mono">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        Suggested Follow-ups
      </div>
      <div className="grid grid-cols-1 gap-3">
        {questions.slice(0, 3).map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className="text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 group shadow-sm"
          >
            <span className="text-slate-700 group-hover:text-slate-900 text-sm leading-relaxed block pr-6 relative font-medium">
              {question}
              <ArrowRight className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-600" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

const highlightText = (text) => {
  if (!text) return null;
  
  // Split text by regex to find custom markers, company names, and special terms
  // Regex explanations:
  // 1. (\[TWEET\][\s\S]*?\[\/TWEET\]) -> Capture Tweet summary blocks (multiline)
  // 2. (\*\*.*?\*\*) -> Capture bold text
  // 3. (Apple|Google|Microsoft|Nvidia|Meta|Amazon) -> Capture company names
  const parts = text.split(/(\[TWEET\][\s\S]*?\[\/TWEET\]|\*\*.*?\*\*|Apple|Google|Microsoft|Nvidia|Meta|Amazon)/g);
  
  // Track which companies have already been highlighted in this text block
  const highlightedCompanies = new Set();

  return parts.map((part, i) => {
    // Render Tweet Summary Style
    if (part.startsWith('[TWEET]') && part.endsWith('[/TWEET]')) {
      const content = part.slice(7, -8).trim();
      return (
        <div key={i} className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <span className="block text-xs font-bold text-blue-500 uppercase tracking-wide mb-1">Executive Summary</span>
              <span className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{content}</span>
            </div>
          </div>
        </div>
      );
    }
    // Render Bold Text
    else if (part.startsWith('**') && part.endsWith('**')) {
      return <span key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</span>;
    } 
    // Render Company Names in Blue (only first occurrence)
    else if (['Apple', 'Google', 'Microsoft', 'Nvidia', 'Meta', 'Amazon'].includes(part)) {
      if (!highlightedCompanies.has(part)) {
        highlightedCompanies.add(part);
        return <span key={i} className="font-bold text-blue-600">{part}</span>;
      }
      return part;
    }
    return part;
  });
};

const parseAnalysisText = (text) => {
  if (!text) return [];

  const blocks = [];
  const tweetRegex = /\[TWEET\][\s\S]*?\[\/TWEET\]/g;
  const uppercaseHeading = /^[A-Z0-9 '&()\/\-\u2013\u2014]+\s*[A-Z0-9 '&()\/\-\u2013\u2014]*$/;

  const processPlainChunk = (chunk) => {
    if (!chunk) return;
    const lines = chunk.split('\n');
    let listItems = [];

    const flushList = () => {
      if (listItems.length > 0) {
        blocks.push({ type: 'list', items: listItems });
        listItems = [];
      }
    };

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        flushList();
        return;
      }

      const headingMatch = trimmedLine.match(/^(#+)\s*(.*)$/);
      if (headingMatch) {
        flushList();
        const level = Math.min(headingMatch[1].length, 3);
        blocks.push({ type: 'heading', level, content: headingMatch[2] || '' });
        return;
      }

      if (uppercaseHeading.test(trimmedLine) && trimmedLine.length >= 6) {
        flushList();
        blocks.push({ type: 'heading', level: 2, content: trimmedLine });
        return;
      }

      if (/^[-*•]\s+/.test(trimmedLine)) {
        listItems.push(trimmedLine.replace(/^[-*•]\s+/, ''));
        return;
      }

      flushList();
      blocks.push({ type: 'paragraph', content: trimmedLine });
    });

    flushList();
  };

  let lastIndex = 0;
  let match;

  while ((match = tweetRegex.exec(text)) !== null) {
    processPlainChunk(text.slice(lastIndex, match.index));
    blocks.push({ type: 'tweet', content: match[0] });
    lastIndex = match.index + match[0].length;
  }

  processPlainChunk(text.slice(lastIndex));

  return blocks;
};

// Section headers to filter out (these become noise, not useful sections)
const FILTERED_SECTION_HEADERS = [
  'strategic implications',
  'conclusion',
  'historical',
  'context',
  'trajectory',
  'key insights',
  'outlook',
  'summary',
  'overview',
  'analysis',
  'implications',
  'takeaways',
  'key takeaways',
  'final thoughts',
  'in summary',
  'to conclude',
  'looking ahead',
  'going forward',
  'limitation',
  'limitations',
  'note',
  'important note',
  'background',
  'introduction',
  'closing'
];

const shouldFilterHeading = (title) => {
  if (!title) return false;
  const normalized = title.toLowerCase().trim();
  return FILTERED_SECTION_HEADERS.some(filter => 
    normalized.includes(filter) || normalized === filter
  );
};

const buildSections = (blocks) => {
  if (!blocks || blocks.length === 0) return [];

  const sections = [];
  let currentSection = { title: null, headingLevel: 2, blocks: [] };

  const pushSection = () => {
    if (currentSection.blocks.length > 0) {
      sections.push(currentSection);
    }
  };

  blocks.forEach((block) => {
    if (block.type === 'heading') {
      // Filter out unwanted section headers - treat their content as regular paragraphs
      if (shouldFilterHeading(block.content)) {
        // Don't create a new section, just skip this heading entirely
        return;
      }
      pushSection();
      currentSection = {
        title: block.content,
        headingLevel: block.level,
        blocks: []
      };
    } else {
      currentSection.blocks.push(block);
    }
  });

  pushSection();
  return sections;
};

const sectionVariantStyles = {
  summary: {
    container: 'bg-gradient-to-br from-blue-50/50 to-white border-blue-200/50',
    label: 'text-blue-700',
    accent: 'bg-blue-500'
  },
  highlight: {
    container: 'bg-gradient-to-br from-amber-50/30 to-white border-amber-200/50',
    label: 'text-amber-700',
    accent: 'bg-amber-500'
  },
  insight: {
    container: 'bg-slate-50/50 border-slate-200/60',
    label: 'text-slate-600',
    accent: 'bg-slate-400'
  },
  default: {
    container: 'bg-white border-slate-200/50',
    label: 'text-slate-500',
    accent: 'bg-slate-300'
  }
};

const getSectionVariant = (title) => {
  if (!title) return 'default';
  const normalized = title.toLowerCase();
  if (normalized.includes('executive summary')) return 'summary';
  if (normalized.includes('key') || normalized.includes('driver') || normalized.includes('growth')) return 'highlight';
  if (normalized.includes('product') || normalized.includes('margin') || normalized.includes('mix')) return 'insight';
  if (normalized.includes('geographic') || normalized.includes('season')) return 'insight';
  return 'default';
};

const SectionCard = ({ title, children }) => {
  const variant = getSectionVariant(title);
  const styles = sectionVariantStyles[variant] || sectionVariantStyles.default;
  
  // If no title or filtered title, render without header for cleaner look
  const hasTitle = title && title.trim().length > 0;

  return (
    <section className={`rounded-2xl border p-6 relative overflow-hidden ${styles.container}`}>
      {hasTitle && (
        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
          <span className={`inline-flex w-1 h-6 rounded-full ${styles.accent}`}></span>
          <span className={`text-[11px] font-semibold tracking-[0.15em] uppercase ${styles.label}`}>
            {title}
          </span>
        </div>
      )}
      <div className="space-y-5">
        {children}
      </div>
    </section>
  );
};

export function AnalysisDisplay({ analysis, isStreaming = false, onQuestionClick, onGenerateFinancialTable, isGeneratingTable = false }) {
  const formattedData = useMemo(() => formatQuarterlyData(analysis?.progression), [analysis?.progression]);
  
  // Use the smoothing hook for the analysis text
  const smoothAnalysisText = useSmoothText(analysis?.analysis, isStreaming);
  
  // Memoize content parsing - must be before any conditional returns
  const contentBlocks = useMemo(() => parseAnalysisText(smoothAnalysisText), [smoothAnalysisText]);
  const sectionedContent = useMemo(() => buildSections(contentBlocks), [contentBlocks]);
  
  if (!analysis) {
    return (
      <div className="mt-8 p-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-sm mb-4 border border-slate-100">
          <AlertCircle className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-slate-500 font-medium">Awaiting analysis data...</p>
      </div>
    );
  }
  
  const latestData = formattedData[formattedData.length - 1];
  const previousData = formattedData[formattedData.length - 2];

  const calculateGrowth = (current, previous) => {
    if (!current || !previous) return null;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const hasFinancialMetrics = latestData && (latestData.revenue > 0 || latestData.profit > 0);

  return (
    <div className="space-y-8 animate-reveal">
      {/* Key Metrics Grid */}
      {hasFinancialMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            index={0}
            title="Revenue"
            value={`$${(latestData.revenue / 1000).toFixed(1)}B`}
            trend={calculateGrowth(latestData.revenue, previousData?.revenue)}
            icon={DollarSign}
            subtitle="Quarterly revenue"
          />
          <MetricCard
            index={1}
            title="Net Income"
            value={`$${(latestData.profit / 1000).toFixed(1)}B`}
            trend={calculateGrowth(latestData.profit, previousData?.profit)}
            icon={TrendingUp}
            subtitle="Quarterly profit"
          />
          <MetricCard
            index={2}
            title="Margin"
            value={`${latestData.margin.toFixed(1)}%`}
            trend={calculateGrowth(latestData.margin, previousData?.margin)}
            icon={BarChart2}
            subtitle="Profit margin"
          />
        </div>
      )}

      {/* Main Analysis Content */}
      <div className="rounded-2xl p-7 relative overflow-hidden bg-white shadow-lg border border-slate-200/60">
        {/* Subtle top accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/40 via-blue-400/60 to-blue-500/40"></div>
        
        <div className="prose prose-slate max-w-none pt-2">
          {isStreaming && (
            <div className="flex items-center gap-3 mb-6 text-blue-600 font-mono text-sm uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Analyzing live data...
            </div>
          )}
          
          {sectionedContent.length > 0 ? (
            <div className="space-y-6">
              {(() => {
                let blockCounter = -1;
                return sectionedContent.map((section, sectionIdx) => (
                  <SectionCard key={`section-${sectionIdx}`} title={section.title}>
                    {section.blocks.map((block, blockIdx) => {
                      blockCounter += 1;
                      const isLastBlock = blockCounter === contentBlocks.length - 1;
                      const baseAnimation = !isStreaming ? 'animate-reveal' : '';
                      const animationStyle = { animationDelay: `${blockCounter * 40}ms` };

                      if (block.type === 'tweet') {
                        return (
                          <div
                            key={`tweet-${sectionIdx}-${blockIdx}`}
                            className={baseAnimation}
                            style={animationStyle}
                          >
                            {highlightText(block.content)}
                          </div>
                        );
                      }

                      if (block.type === 'list') {
                        return (
                          <div
                            key={`list-${sectionIdx}-${blockIdx}`}
                            className={`bg-gradient-to-br from-slate-50 to-white border border-slate-200/80 rounded-2xl p-6 ${baseAnimation}`}
                            style={animationStyle}
                          >
                            <ul className="space-y-4">
                              {block.items.map((item, itemIdx) => (
                                <li key={itemIdx} className="flex items-start gap-4 text-[15px] text-slate-700 leading-[1.7]">
                                  <span className="w-1.5 h-1.5 mt-[10px] rounded-full bg-blue-500 flex-shrink-0"></span>
                                  <span className="flex-1">{highlightText(item)}</span>
                                </li>
                              ))}
                            </ul>
                            {isStreaming && isLastBlock && (
                              <span className="inline-block w-1.5 h-5 mt-4 bg-blue-500 animate-pulse align-middle"></span>
                            )}
                          </div>
                        );
                      }

                      const isTableLike = typeof block.content === 'string' && block.content.includes('|') && block.content.includes('\n');
                      if (isTableLike) {
                        const parsed = parsePipeTable(block.content);
                        if (parsed) {
                          return (
                            <div
                              key={`table-${sectionIdx}-${blockIdx}`}
                              className={`${baseAnimation} border border-slate-200 rounded-xl overflow-hidden bg-white`}
                              style={animationStyle}
                            >
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm text-left text-slate-700">
                                  <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                      {parsed.headers.map((h, i) => (
                                        <th key={i} className="px-4 py-2 font-semibold text-slate-800 whitespace-nowrap">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {parsed.body.map((row, ri) => (
                                      <tr key={ri} className="hover:bg-slate-50">
                                        {row.map((cell, ci) => (
                                          <td key={ci} className="px-4 py-2 whitespace-nowrap font-mono text-[13px]">{cell}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {isStreaming && isLastBlock && (
                                <div className="px-4 py-2 text-xs text-blue-600 font-mono animate-pulse">streaming…</div>
                              )}
                            </div>
                          );
                        }
                        // fallback to pre if parsing fails
                        return (
                          <pre
                            key={`table-${sectionIdx}-${blockIdx}`}
                            className={`text-[14px] leading-[1.6] text-slate-800 tracking-[-0.01em] bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto font-mono ${baseAnimation}`}
                            style={animationStyle}
                          >
                            {block.content}
                            {isStreaming && isLastBlock && (
                              <span className="inline-block w-1.5 h-5 ml-1 bg-blue-500 animate-pulse align-middle"></span>
                            )}
                          </pre>
                        );
                      }

                      return (
                        <p
                          key={`paragraph-${sectionIdx}-${blockIdx}`}
                          className={`text-[15px] leading-[1.8] text-slate-700 tracking-[-0.01em] ${baseAnimation}`}
                          style={animationStyle}
                        >
                          {highlightText(block.content)}
                          {isStreaming && isLastBlock && (
                            <span className="inline-block w-1.5 h-5 ml-1 bg-blue-500 animate-pulse align-middle"></span>
                          )}
                        </p>
                      );
                    })}
                  </SectionCard>
                ));
              })()}
            </div>
          ) : (
            <p className="text-slate-500 italic">Processing query...</p>
          )}
        </div>

        {/* Financial Actions */}
        {analysis.metadata?.analysis_type === 'financial' && (
          <FinancialTableButton 
            onGenerateTable={onGenerateFinancialTable}
            isGenerating={isGeneratingTable}
          />
        )}

        {/* Generated Table Display */}
        {analysis.metadata?.financialTable && (
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Table className="w-4 h-4 text-blue-600" />
                Consolidated Financials
              </h3>
              <span className="text-xs font-mono text-slate-500">USD (Billions)</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <StructuredFinancialTable data={analysis.metadata.financialTable} />
            </div>
          </div>
        )}
      </div>

      {/* Follow-up Section - Removed as requested */}
      
      {/* Metadata Footer */}
      <div className="space-y-2 pt-4">
        {analysis.metadata?.citations && analysis.metadata.citations.length > 0 && (
          <CollapsibleSection 
            title="Citations & References" 
            count={analysis.metadata.citations.length}
          >
            <div className="grid grid-cols-1 gap-2 pt-2">
              {analysis.metadata.citations.map((citation, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-mono text-xs text-blue-600 mt-0.5">[{index + 1}]</span>
                  <span className="text-sm text-slate-600 leading-relaxed">{citation.source}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Verbatim quotes from sources */}
        {analysis.metadata?.citations && analysis.metadata.citations.length > 0 && (
          <CollapsibleSection 
            title="Verbatim Quotes" 
            count={analysis.metadata.citations.length}
          >
            <div className="space-y-3 pt-2">
              {analysis.metadata.citations
                .slice() // copy
                .sort((a, b) => (parseFloat(b.score || 0) - parseFloat(a.score || 0)))
                .slice(0, 5)
                .map((cite, index) => {
                  const snippet = (cite.text || '').slice(0, 220) + ((cite.text || '').length > 220 ? '…' : '');
                  const score =
                    parseFloat(cite.score || 0) > 1
                      ? parseFloat(cite.score).toFixed(2)
                      : (parseFloat(cite.score || 0) * 100).toFixed(0) + '%';
                  return (
                <div 
                  key={index} 
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <span className="font-mono px-2 py-0.5 bg-white border border-slate-200 rounded">
                      {cite.fiscalYear ? `FY${cite.fiscalYear}` : 'FY ?'} {cite.quarter || ''}
                    </span>
                    <span className="text-slate-400 truncate">{cite.source}</span>
                    {cite.score && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                        {score}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {snippet}
                  </p>
                </div>
              );
            })}
            </div>
          </CollapsibleSection>
        )}

        {analysis.metadata?.sources && analysis.metadata.sources.length > 0 && (
          <CollapsibleSection 
            title="Data Sources" 
            count={analysis.metadata.sources.length}
          >
             <div className="flex flex-wrap gap-2 pt-2">
              {analysis.metadata.sources.map((source, index) => (
                <span key={index} className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors cursor-default">
                  {source}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
