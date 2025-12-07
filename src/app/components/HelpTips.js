import React, { useState } from 'react';
import { HelpCircle, X, Lightbulb, TrendingUp, DollarSign, Cpu, Target } from 'lucide-react';

const HelpTips = ({ isVisible, onClose }) => {
  const [activeTab, setActiveTab] = useState('general');

  const tips = {
    general: [
      {
        icon: <Target className="w-4 h-4" />,
        title: "Precision Matters",
        description: "Cite specific companies, fiscal quarters (e.g. Q3 2025), and metrics."
      },
      {
        icon: <TrendingUp className="w-4 h-4" />,
        title: "Trend Analysis",
        description: "Ask for comparisons over time or against competitors to identify shifts."
      },
      {
        icon: <Cpu className="w-4 h-4" />,
        title: "Strategic Focus",
        description: "Combine financial data with strategic initiatives like AI or cloud expansion."
      }
    ],
    financial: [
      {
        icon: <DollarSign className="w-4 h-4" />,
        title: "Revenue & Growth",
        description: "Break down revenue by segment, geography, or product line."
      },
      {
        icon: <TrendingUp className="w-4 h-4" />,
        title: "Profitability",
        description: "Analyze margins (gross, operating, net) and cost structures."
      },
      {
        icon: <Target className="w-4 h-4" />,
        title: "Quarterly Comparisons",
        description: "Evaluate year-over-year (YoY) and quarter-over-quarter (QoQ) changes."
      }
    ],
    ai: [
      {
        icon: <Cpu className="w-4 h-4" />,
        title: "AI Investment",
        description: "Track CapEx spending on AI infrastructure and R&D."
      },
      {
        icon: <Target className="w-4 h-4" />,
        title: "Product Integration",
        description: "How AI features are being monetized in core products."
      },
      {
        icon: <TrendingUp className="w-4 h-4" />,
        title: "Competitive Landscape",
        description: "Compare AI model capabilities and partnership ecosystems."
      }
    ]
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-reveal">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl relative">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl -z-10"></div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
               <HelpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Terminal Guide</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 p-1 mx-6 mt-6 bg-slate-50 rounded-xl">
          {Object.keys(tips).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab === 'general' && 'Basics'}
              {tab === 'financial' && 'Financials'}
              {tab === 'ai' && 'Technology'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div className="grid grid-cols-1 gap-3">
            {tips[activeTab].map((tip, index) => (
              <div
                key={index}
                className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 group-hover:border-blue-200 transition-colors">
                    {React.cloneElement(tip.icon, { className: "w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" })}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1 text-sm">{tip.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{tip.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Example Queries */}
          <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-transparent border border-blue-100 rounded-xl">
            <h3 className="font-bold text-blue-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Lightbulb className="w-4 h-4" />
              Power Queries
            </h3>
            <div className="space-y-3">
              {[
                "Compare Nvidia and AMD's data center revenue growth over the last 4 quarters.",
                "What is Microsoft's CapEx outlook for AI infrastructure in FY24?",
                "Analyze the impact of AI features on Adobe's subscription revenue."
              ].map((query, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-blue-500 mt-1">›</span>
                  <span className="font-mono text-xs md:text-sm opacity-80">{query}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpTips;
