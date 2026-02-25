'use client';

import { useState } from 'react';
import { 
  Layers, GitMerge, Sparkles, Network, Wand2,
  ChevronDown, CheckCircle2, Settings2, Hash, MessageSquare,
  ArrowRight
} from 'lucide-react';

// Icon mapping
const IconMap = {
  Layers,
  GitMerge,
  Sparkles,
  Network,
  Wand2,
  Hash,
  MessageSquare,
};

// Strategy data - FOCUSED ON USE CASES for financial professionals
const STRATEGIES = {
  'auto': {
    id: 'auto',
    name: 'Smart Mode',
    shortName: 'Smart',
    icon: 'Wand2',
    useCase: 'AI picks the best approach',
    examples: 'Any question type',
    color: 'amber',
    recommended: true,
  },
  'hybrid-bm25': {
    id: 'hybrid-bm25',
    name: 'Precision',
    shortName: 'Precision',
    icon: 'Hash',
    useCase: 'Specific numbers & metrics',
    examples: '"Q3 2025 revenue", "MI300 sales figures"',
    color: 'emerald',
  },
  'dense-only': {
    id: 'dense-only',
    name: 'Concepts',
    shortName: 'Concepts',
    icon: 'MessageSquare',
    useCase: 'Strategic & thematic questions',
    examples: '"AI strategy", "competitive positioning"',
    color: 'blue',
  },
  'hyde': {
    id: 'hyde',
    name: 'Exploratory',
    shortName: 'Explore',
    icon: 'Sparkles',
    useCase: 'Vague or open-ended questions',
    examples: '"What\'s driving growth?", "Key concerns"',
    color: 'violet',
  },
  'multi-query': {
    id: 'multi-query',
    name: 'Deep Dive',
    shortName: 'Deep',
    icon: 'Network',
    useCase: 'Complex multi-part questions',
    examples: '"Compare revenue AND margins across segments"',
    color: 'rose',
  },
};

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    bgActive: 'bg-blue-100',
    border: 'border-blue-200',
    borderActive: 'border-blue-400',
    text: 'text-blue-700',
    icon: 'text-blue-600',
    badge: 'bg-blue-600',
    badgeLight: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  emerald: {
    bg: 'bg-emerald-50',
    bgActive: 'bg-emerald-100',
    border: 'border-emerald-200',
    borderActive: 'border-emerald-400',
    text: 'text-emerald-700',
    icon: 'text-emerald-600',
    badge: 'bg-emerald-600',
    badgeLight: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  violet: {
    bg: 'bg-violet-50',
    bgActive: 'bg-violet-100',
    border: 'border-violet-200',
    borderActive: 'border-violet-400',
    text: 'text-violet-700',
    icon: 'text-violet-600',
    badge: 'bg-violet-600',
    badgeLight: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  amber: {
    bg: 'bg-amber-50',
    bgActive: 'bg-amber-100',
    border: 'border-amber-200',
    borderActive: 'border-amber-400',
    text: 'text-amber-700',
    icon: 'text-amber-600',
    badge: 'bg-amber-600',
    badgeLight: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  rose: {
    bg: 'bg-rose-50',
    bgActive: 'bg-rose-100',
    border: 'border-rose-200',
    borderActive: 'border-rose-400',
    text: 'text-rose-700',
    icon: 'text-rose-600',
    badge: 'bg-rose-600',
    badgeLight: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

function StrategyOption({ strategy, isSelected, onSelect }) {
  const colors = colorClasses[strategy.color] || colorClasses.blue;
  const Icon = IconMap[strategy.icon] || Layers;
  
  return (
    <button
      onClick={() => onSelect(strategy.id)}
      className={`
        relative p-3 rounded-lg border transition-all duration-200 text-left w-full
        ${isSelected 
          ? `${colors.bgActive} ${colors.borderActive} ring-1 ${colors.borderActive}` 
          : `bg-white ${colors.border} hover:${colors.bg}`
        }
      `}
    >
      {strategy.recommended && (
        <span className="absolute -top-2 right-2 px-2 py-0.5 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider rounded-full">
          Recommended
        </span>
      )}
      
      <div className="flex items-center gap-3">
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
          ${isSelected ? colors.badge : colors.bg}
          ${isSelected ? 'text-white' : colors.icon}
        `}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${isSelected ? colors.text : 'text-slate-900'}`}>
              {strategy.name}
            </span>
            {isSelected && (
              <CheckCircle2 className={`w-4 h-4 ${colors.text}`} />
            )}
          </div>
          <p className="text-xs text-slate-500">
            {strategy.useCase}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function StrategySelector({ 
  selectedStrategy = 'auto', 
  onStrategyChange,
  compact = false 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const currentStrategy = STRATEGIES[selectedStrategy] || STRATEGIES['auto'];
  const colors = colorClasses[currentStrategy.color];
  const Icon = IconMap[currentStrategy.icon];
  
  // Compact collapsible version (default for chat pages)
  if (compact) {
    return (
      <div className="w-full">
        {/* Collapsed bar */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            w-full flex items-center justify-between px-4 py-2.5 bg-white/80 backdrop-blur-sm 
            rounded-lg border border-slate-200 hover:border-slate-300 transition-all duration-200
            ${isExpanded ? 'rounded-b-none border-b-0' : 'shadow-sm'}
          `}
        >
          <div className="flex items-center gap-3">
            <Settings2 className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">Mode:</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors.badgeLight}`}>
              <Icon className="w-3 h-3" />
              {currentStrategy.name}
            </span>
            {selectedStrategy === 'auto' && (
              <span className="text-xs text-slate-400 hidden sm:inline">• AI optimizes automatically</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Expanded options */}
        {isExpanded && (
          <div className="bg-white/95 backdrop-blur-sm rounded-b-lg border border-t-0 border-slate-200 shadow-lg p-3 animate-slideDown">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.values(STRATEGIES).map((strategy) => (
                <StrategyOption
                  key={strategy.id}
                  strategy={strategy}
                  isSelected={selectedStrategy === strategy.id}
                  onSelect={(id) => {
                    onStrategyChange(id);
                    setIsExpanded(false);
                  }}
                />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
              <p className="text-[11px] text-slate-400">
                Different modes optimize for different question types
              </p>
              <a 
                href="/rag-strategy" 
                className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Learn more <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
        
        <style jsx>{`
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slideDown {
            animation: slideDown 0.15s ease-out;
          }
        `}</style>
      </div>
    );
  }
  
  // Full panel version (for settings page)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">
            Search Mode
          </h3>
        </div>
        <a 
          href="/rag-strategy" 
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          Technical details <ArrowRight className="w-3 h-3" />
        </a>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.values(STRATEGIES).map((strategy) => (
          <StrategyOption
            key={strategy.id}
            strategy={strategy}
            isSelected={selectedStrategy === strategy.id}
            onSelect={onStrategyChange}
          />
        ))}
      </div>
      
      {/* Current selection summary */}
      <div className={`rounded-lg p-3 ${colors.bg} border ${colors.border}`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-4 h-4 ${colors.icon} mt-0.5`} />
          <div>
            <p className={`text-sm font-medium ${colors.text}`}>
              {currentStrategy.name}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Best for: <span className="font-medium">{currentStrategy.examples}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
