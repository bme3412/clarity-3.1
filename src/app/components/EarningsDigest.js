'use client';

import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Quote, AlertTriangle,
  Target, Users, ChevronDown, ChevronUp, Loader2,
  BarChart3, MessageSquare, Lightbulb, Shield, Rocket,
  CheckCircle2, XCircle, Clock, Building2
} from 'lucide-react';

// Tone indicator component
function ToneIndicator({ rating }) {
  const config = {
    bullish: { color: 'emerald', icon: TrendingUp, label: 'Bullish' },
    neutral: { color: 'slate', icon: Minus, label: 'Neutral' },
    cautious: { color: 'amber', icon: TrendingDown, label: 'Cautious' }
  };
  
  const { color, icon: Icon, label } = config[rating] || config.neutral;
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-${color}-100 text-${color}-700`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

// Metric card component
function MetricCard({ label, value, growth, unit = '' }) {
  if (value === null || value === undefined) return null;
  
  const isPositive = growth && (growth.includes('+') || parseFloat(growth) > 0);
  const isNegative = growth && (growth.includes('-') || parseFloat(growth) < 0);
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">
        {typeof value === 'number' ? value.toLocaleString() : value}{unit}
      </p>
      {growth && (
        <p className={`text-sm font-medium mt-1 ${
          isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-500'
        }`}>
          {growth} YoY
        </p>
      )}
    </div>
  );
}

// Segment performance row
function SegmentRow({ segment }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1">
        <p className="font-medium text-slate-900">{segment.segment}</p>
        <p className="text-sm text-slate-600">{segment.performance}</p>
      </div>
      {segment.outlook && (
        <p className="text-xs text-slate-500 max-w-[200px] text-right">{segment.outlook}</p>
      )}
    </div>
  );
}

// Analyst concern card
function AnalystConcern({ concern }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <MessageSquare className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-900">{concern.topic}</p>
          <p className="text-sm text-amber-700 mt-1">{concern.managementResponse}</p>
        </div>
      </div>
    </div>
  );
}

// Main Earnings Digest Display Component
export function EarningsDigestDisplay({ data, isLoading }) {
  const [expandedSections, setExpandedSections] = useState({
    segments: true,
    analysts: true,
    risks: false,
    initiatives: false
  });
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Generating Earnings Digest...</p>
          <p className="text-sm text-slate-400 mt-1">Analyzing transcripts and financial data</p>
        </div>
      </div>
    );
  }
  
  if (!data) return null;
  
  const { ticker, fiscalYear, quarter, keyMetrics, digest, generatedAt } = data;
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{ticker}</h1>
              <p className="text-slate-300">{quarter} FY{fiscalYear} Earnings Digest</p>
            </div>
          </div>
          <div className="text-right">
            <ToneIndicator rating={digest.managementTone?.rating} />
            <p className="text-xs text-slate-400 mt-2">
              <Clock className="w-3 h-3 inline mr-1" />
              Generated {new Date(generatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        {/* Headline */}
        <div className="bg-white/10 rounded-xl p-4 mt-4">
          <p className="text-lg font-medium leading-relaxed">{digest.headline}</p>
        </div>
      </div>
      
      {/* Key Metrics Grid */}
      {keyMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard 
            label="Revenue" 
            value={keyMetrics.revenue} 
            growth={keyMetrics.revenueGrowth}
            unit={keyMetrics.revenue > 100 ? 'M' : 'B'}
          />
          <MetricCard 
            label="EPS" 
            value={keyMetrics.eps} 
            growth={keyMetrics.epsGrowth}
            unit=""
          />
          <MetricCard 
            label="Gross Margin" 
            value={keyMetrics.grossMargin} 
            unit="%"
          />
          <MetricCard 
            label="Op. Margin" 
            value={keyMetrics.operatingMargin} 
            unit="%"
          />
        </div>
      )}
      
      {/* Key Highlights */}
      {digest.keyHighlights && digest.keyHighlights.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Key Highlights
          </h2>
          <ul className="space-y-3">
            {digest.keyHighlights.map((highlight, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Management Quote */}
      {digest.managementTone?.supportingQuote && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <div className="flex gap-4">
            <Quote className="w-8 h-8 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-blue-900 italic text-lg leading-relaxed">
                &ldquo;{digest.managementTone.supportingQuote}&rdquo;
              </p>
              <p className="text-blue-600 text-sm mt-2 font-medium">— Management</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Segment Performance */}
      {digest.segmentPerformance && digest.segmentPerformance.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => toggleSection('segments')}
            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Segment Performance
            </h2>
            {expandedSections.segments ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>
          {expandedSections.segments && (
            <div className="px-6 pb-6">
              {digest.segmentPerformance.map((segment, i) => (
                <SegmentRow key={i} segment={segment} />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Guidance */}
      {digest.guidanceChanges && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
            <Target className="w-5 h-5 text-violet-500" />
            Guidance
          </h2>
          <p className="text-slate-700 mb-3">{digest.guidanceChanges.summary}</p>
          {digest.guidanceChanges.details && digest.guidanceChanges.details.length > 0 && (
            <ul className="space-y-2">
              {digest.guidanceChanges.details.map((detail, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-violet-500">•</span>
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {/* Analyst Concerns */}
      {digest.analystConcerns && digest.analystConcerns.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => toggleSection('analysts')}
            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Users className="w-5 h-5 text-amber-500" />
              Analyst Concerns ({digest.analystConcerns.length})
            </h2>
            {expandedSections.analysts ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>
          {expandedSections.analysts && (
            <div className="px-6 pb-6 space-y-3">
              {digest.analystConcerns.map((concern, i) => (
                <AnalystConcern key={i} concern={concern} />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Risks */}
      {digest.risksAndChallenges && digest.risksAndChallenges.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => toggleSection('risks')}
            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Risks & Challenges ({digest.risksAndChallenges.length})
            </h2>
            {expandedSections.risks ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>
          {expandedSections.risks && (
            <div className="px-6 pb-6">
              <ul className="space-y-3">
                {digest.risksAndChallenges.map((risk, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Strategic Initiatives */}
      {digest.strategicInitiatives && digest.strategicInitiatives.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => toggleSection('initiatives')}
            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Rocket className="w-5 h-5 text-blue-500" />
              Strategic Initiatives ({digest.strategicInitiatives.length})
            </h2>
            {expandedSections.initiatives ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>
          {expandedSections.initiatives && (
            <div className="px-6 pb-6">
              <ul className="space-y-3">
                {digest.strategicInitiatives.map((initiative, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Rocket className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{initiative}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Metadata footer */}
      <div className="text-center text-xs text-slate-400 pt-4">
        <p>
          Sources: {data.metadata?.hasEarningsTranscript && 'Earnings Transcript'} 
          {data.metadata?.hasQATranscript && ' • Q&A Session'}
          {data.metadata?.hasFinancialData && ' • Financial Data'}
        </p>
      </div>
    </div>
  );
}

// Earnings Digest Selector Component
export function EarningsDigestSelector({ onGenerate, isLoading }) {
  const [ticker, setTicker] = useState('');
  const [fiscalYear, setFiscalYear] = useState('2025');
  const [quarter, setQuarter] = useState('Q3');
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  
  const tickers = ['AAPL', 'AMD', 'AMZN', 'AVGO', 'CRM', 'GOOGL', 'META', 'MSFT', 'NVDA', 'ORCL'];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const years = ['2025', '2024', '2023', '2022', '2021', '2020'];
  
  const handleTickerChange = async (newTicker) => {
    setTicker(newTicker);
    if (newTicker) {
      setLoadingPeriods(true);
      try {
        const res = await fetch(`/api/reports/earnings-digest?ticker=${newTicker}`);
        const data = await res.json();
        setAvailablePeriods(data.periods || []);
        
        // Auto-select most recent period
        if (data.periods && data.periods.length > 0) {
          setFiscalYear(data.periods[0].fiscalYear);
          setQuarter(data.periods[0].quarter);
        }
      } catch (e) {
        console.error('Error fetching periods:', e);
      } finally {
        setLoadingPeriods(false);
      }
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (ticker && fiscalYear && quarter) {
      onGenerate({ ticker, fiscalYear, quarter });
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
      <h2 className="text-xl font-bold text-slate-900 mb-6">Generate Earnings Digest</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Ticker Select */}
        <div>
          <label htmlFor="ticker-select" className="block text-sm font-medium text-slate-700 mb-2">Company</label>
          <select
            id="ticker-select"
            name="ticker"
            value={ticker}
            onChange={(e) => handleTickerChange(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select ticker...</option>
            {tickers.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        
        {/* Year Select */}
        <div>
          <label htmlFor="fiscal-year-select" className="block text-sm font-medium text-slate-700 mb-2">Fiscal Year</label>
          <select
            id="fiscal-year-select"
            name="fiscalYear"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {years.map(y => (
              <option key={y} value={y}>FY {y}</option>
            ))}
          </select>
        </div>
        
        {/* Quarter Select */}
        <div>
          <label htmlFor="quarter-select" className="block text-sm font-medium text-slate-700 mb-2">Quarter</label>
          <select
            id="quarter-select"
            name="quarter"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {quarters.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Available periods hint */}
      {ticker && availablePeriods.length > 0 && (
        <div className="mb-4 text-sm text-slate-500">
          <span className="font-medium">Available:</span>{' '}
          {availablePeriods.slice(0, 5).map(p => `${p.quarter} FY${p.fiscalYear}`).join(', ')}
          {availablePeriods.length > 5 && ` +${availablePeriods.length - 5} more`}
        </div>
      )}
      
      <button
        type="submit"
        disabled={!ticker || isLoading}
        className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <BarChart3 className="w-5 h-5" />
            Generate Digest
          </>
        )}
      </button>
    </form>
  );
}

export default EarningsDigestDisplay;

