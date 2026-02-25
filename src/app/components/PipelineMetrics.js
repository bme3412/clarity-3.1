'use client';

import { useState } from 'react';
import { 
  ChevronDown, ChevronUp, Zap, Clock, Database, 
  Brain, FileText, CheckCircle2, AlertTriangle,
  Layers, GitMerge, Sparkles, Activity, Wand2,
  Lightbulb, Network
} from 'lucide-react';

const strategyIcons = {
  'auto': Wand2,
  'dense-only': Layers,
  'hybrid-bm25': GitMerge,
  'hyde': Sparkles,
  'multi-query': Network,
};

const strategyColors = {
  'auto': 'amber',
  'dense-only': 'blue',
  'hybrid-bm25': 'emerald',
  'hyde': 'violet',
  'multi-query': 'rose',
};

function MetricBadge({ label, value, icon: Icon, color = 'slate' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClasses[color]}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span className="text-xs font-medium">{label}:</span>
      <span className="text-xs font-mono font-bold">{value}</span>
    </div>
  );
}

function PipelineStep({ step, index, isLast }) {
  const statusColors = {
    complete: 'bg-emerald-500',
    active: 'bg-blue-500 animate-pulse',
    pending: 'bg-slate-300',
    error: 'bg-rose-500',
  };
  
  return (
    <div className="flex items-start gap-3">
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${statusColors[step.status]}`} />
        {!isLast && (
          <div className={`w-0.5 h-full min-h-[2rem] ${
            step.status === 'complete' ? 'bg-emerald-300' : 'bg-slate-200'
          }`} />
        )}
      </div>
      
      {/* Step content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-900">{step.name}</span>
          {step.latency && (
            <span className="text-xs font-mono text-slate-500">{step.latency}ms</span>
          )}
        </div>
        {step.details && (
          <p className="text-xs text-slate-500 mt-1">{step.details}</p>
        )}
        {step.metrics && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(step.metrics).map(([key, val]) => (
              <span key={key} className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-600">
                {key}: {val}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelineMetrics({ 
  metrics = null,
  strategy = 'dense-only',
  isStreaming = false,
  compact = false,
  hydeDoc = null,
  multiQueryVariations = null
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Default metrics structure if none provided
  const defaultMetrics = {
    strategy: strategy,
    totalLatency: null,
    steps: [
      { name: 'Intent Analysis', status: 'pending', latency: null },
      { name: 'Embedding', status: 'pending', latency: null },
      { name: 'Retrieval', status: 'pending', latency: null },
      { name: 'Generation', status: 'pending', latency: null },
    ],
    retrieval: {
      sourcesFound: 0,
      topScore: 0,
    }
  };
  
  const displayMetrics = metrics || defaultMetrics;
  const StrategyIcon = strategyIcons[strategy] || Layers;
  const strategyColor = strategyColors[strategy] || 'blue';
  
  if (compact && !metrics) {
    return null; // Don't show compact view if no metrics yet
  }
  
  if (compact) {
    // Inline compact version shown during/after response
    return (
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-${strategyColor}-50 text-${strategyColor}-700`}>
          <StrategyIcon className="w-3 h-3" />
          <span className="font-medium">{strategy.replace('-', ' ')}</span>
        </div>
        
        {displayMetrics.totalLatency && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {(displayMetrics.totalLatency / 1000).toFixed(1)}s
          </span>
        )}
        
        {displayMetrics.retrieval?.sourcesFound > 0 && (
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {displayMetrics.retrieval.sourcesFound} sources
          </span>
        )}
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-600"
        >
          <Activity className="w-3 h-3" />
          {isExpanded ? 'Hide' : 'Details'}
        </button>
      </div>
    );
  }
  
  // Full metrics panel
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${strategyColor}-100 text-${strategyColor}-600`}>
            <StrategyIcon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900">Pipeline Metrics</p>
            <p className="text-xs text-slate-500">
              {isStreaming ? 'Processing...' : 
                displayMetrics.totalLatency ? `Completed in ${(displayMetrics.totalLatency / 1000).toFixed(1)}s` : 
                'Ready'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick stats */}
          {displayMetrics.retrieval?.sourcesFound > 0 && (
            <MetricBadge 
              label="Sources" 
              value={displayMetrics.retrieval.sourcesFound}
              icon={FileText}
              color={strategyColor}
            />
          )}
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-100">
          {/* Pipeline steps timeline */}
          <div className="mb-4">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
              Pipeline Steps
            </p>
            <div className="pl-1">
              {displayMetrics.steps?.map((step, i) => (
                <PipelineStep 
                  key={step.name} 
                  step={step} 
                  index={i}
                  isLast={i === displayMetrics.steps.length - 1}
                />
              ))}
            </div>
          </div>
          
          {/* Retrieval details */}
          {displayMetrics.retrieval && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                Retrieval Stats
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">
                    {displayMetrics.retrieval.sourcesFound}
                  </p>
                  <p className="text-xs text-slate-500">Sources</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">
                    {displayMetrics.retrieval.topScore ? 
                      (displayMetrics.retrieval.topScore * 100).toFixed(0) + '%' : 
                      '--'}
                  </p>
                  <p className="text-xs text-slate-500">Top Score</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">
                    {displayMetrics.tokensUsed || '--'}
                  </p>
                  <p className="text-xs text-slate-500">Tokens</p>
                </div>
              </div>
            </div>
          )}
          
          {/* HyDE Hypothetical Document Display */}
          {strategy === 'hyde' && hydeDoc && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-mono uppercase tracking-wider text-violet-500 mb-2 flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5" />
                Hypothetical Document Generated
              </p>
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                <p className="text-sm text-violet-900 italic leading-relaxed">
                  &ldquo;{hydeDoc}&rdquo;
                </p>
                <p className="text-[10px] text-violet-500 mt-2">
                  This hypothetical answer was embedded and used to search for similar real content.
                </p>
              </div>
            </div>
          )}

          {/* Multi-Query Variations Display */}
          {strategy === 'multi-query' && multiQueryVariations && multiQueryVariations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-mono uppercase tracking-wider text-rose-500 mb-2 flex items-center gap-2">
                <Network className="w-3.5 h-3.5" />
                Query Variations Generated
              </p>
              <div className="space-y-2">
                {multiQueryVariations.map((variation, i) => (
                  <div key={i} className="bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-start gap-2">
                    <span className="text-xs font-bold text-rose-600 mt-0.5">{i + 1}.</span>
                    <p className="text-sm text-rose-900">{variation}</p>
                  </div>
                ))}
                <p className="text-[10px] text-rose-500 mt-2">
                  Results from all queries were merged using Reciprocal Rank Fusion (RRF).
                </p>
              </div>
            </div>
          )}

          {/* Strategy explanation */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className={`flex items-start gap-3 p-3 rounded-lg bg-${strategyColor}-50`}>
              <Zap className={`w-4 h-4 text-${strategyColor}-600 mt-0.5`} />
              <div>
                <p className={`text-sm font-medium text-${strategyColor}-700`}>
                  {displayMetrics.autoSelected && <span className="text-amber-600">[Auto] → </span>}
                  {strategy === 'dense-only' && 'Dense Retrieval'}
                  {strategy === 'hybrid-bm25' && 'Hybrid Search'}
                  {strategy === 'hyde' && 'HyDE (Hypothetical Document)'}
                  {strategy === 'multi-query' && 'Multi-Query Expansion'}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {displayMetrics.autoSelected && 'LLM analyzed your query and selected this strategy. '}
                  {strategy === 'dense-only' && 'Using semantic similarity to find relevant passages. Best for conceptual queries.'}
                  {strategy === 'hybrid-bm25' && 'Combining keyword (BM25) and semantic search. Best for specific metrics and product names.'}
                  {strategy === 'hyde' && 'Generated a hypothetical answer first, then searched for similar content. Best for vague or exploratory queries.'}
                  {strategy === 'multi-query' && 'Generated multiple query variations and merged results using RRF. Best for complex questions with multiple aspects.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

