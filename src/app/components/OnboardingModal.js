'use client';

import { useState, useEffect } from 'react';
import { 
  X, ChevronRight, ChevronLeft, Sparkles, 
  Database, Brain, Search, Zap, MessageSquare,
  Check, ArrowRight
} from 'lucide-react';

const ONBOARDING_KEY = 'clarity_onboarding_complete';

// Feature cards for the tour
const features = [
  {
    icon: MessageSquare,
    title: 'Natural Language Queries',
    description: 'Ask questions like "What is NVIDIA\'s AI strategy?" or "Compare AMD and Intel margins"',
    color: 'blue',
    example: '"How is Apple investing in AI?"'
  },
  {
    icon: Database,
    title: '11,929 Indexed Vectors',
    description: 'Search across 5+ years of earnings calls from 10 Big Tech companies',
    color: 'emerald',
    example: 'AAPL, AMD, NVDA, GOOGL, META...'
  },
  {
    icon: Brain,
    title: 'Agentic AI Analysis',
    description: 'Claude Opus selects the right tools—financial data, transcript search, or calculations',
    color: 'violet',
    example: 'Automatic tool selection'
  },
  {
    icon: Search,
    title: 'Hybrid Search',
    description: 'Dense vectors (semantic) + sparse vectors (keywords) for precise retrieval',
    color: 'amber',
    example: 'Voyage 3.5 + BM25'
  }
];

export default function OnboardingModal({ onComplete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  useEffect(() => {
    // Check if onboarding has been completed before
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);
    onComplete?.();
  };
  
  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);
  };
  
  if (!isOpen) return null;
  
  const totalSteps = features.length + 1; // +1 for welcome screen
  const progress = ((currentStep + 1) / totalSteps) * 100;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Content */}
        <div className="p-8">
          {currentStep === 0 ? (
            // Welcome screen
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Welcome to Clarity 3.0
              </h2>
              
              <p className="text-slate-600 mb-6 max-w-sm mx-auto">
                AI-powered analysis of Big Tech earnings calls, powered by advanced RAG architecture.
              </p>
              
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-blue-600">10</div>
                  <div className="text-xs text-slate-500">Companies</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-emerald-600">5+</div>
                  <div className="text-xs text-slate-500">Years</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-violet-600">11.9k</div>
                  <div className="text-xs text-slate-500">Vectors</div>
                </div>
              </div>
              
              {/* Technical badges */}
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {['Claude Opus', 'Voyage AI', 'Pinecone', 'Next.js 15'].map(tech => (
                  <span 
                    key={tech}
                    className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            // Feature screens
            <div className="text-center">
              {(() => {
                const feature = features[currentStep - 1];
                const Icon = feature.icon;
                const colorClasses = {
                  blue: 'from-blue-500 to-blue-600 text-blue-600 bg-blue-50',
                  emerald: 'from-emerald-500 to-emerald-600 text-emerald-600 bg-emerald-50',
                  violet: 'from-violet-500 to-violet-600 text-violet-600 bg-violet-50',
                  amber: 'from-amber-500 to-amber-600 text-amber-600 bg-amber-50'
                };
                
                return (
                  <>
                    <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${colorClasses[feature.color].split(' ').slice(0, 2).join(' ')} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      {feature.title}
                    </h3>
                    
                    <p className="text-slate-600 mb-6">
                      {feature.description}
                    </p>
                    
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${colorClasses[feature.color].split(' ').slice(2).join(' ')}`}>
                      <span>{feature.example}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-8 pb-8 flex items-center justify-between">
          {/* Back button */}
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            className={`flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors ${
              currentStep === 0 ? 'invisible' : ''
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep 
                    ? 'bg-blue-600 w-6' 
                    : i < currentStep 
                      ? 'bg-blue-300' 
                      : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          
          {/* Next/Complete button */}
          {currentStep < totalSteps - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Export a function to reset onboarding (useful for testing)
export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}
