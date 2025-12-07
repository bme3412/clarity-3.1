import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Sparkles, Search, TrendingUp, Cpu, DollarSign, Lightbulb, Zap, ArrowRight, Command } from "lucide-react";

const QUICK_ACTIONS = [
  {
    icon: <DollarSign className="w-4 h-4" />,
    text: "Financials",
    examples: [
      "What was Apple's revenue growth in Q1 2025?",
      "How have Microsoft's profit margins changed over the last year?",
      "Can you show Nvidia's cash flow trends for the past four quarters?",
      "What are Amazon's quarterly earnings highlights for 2023?"
    ]
  },
  {
    icon: <Cpu className="w-4 h-4" />,
    text: "Strategy",
    examples: [
      "How is Microsoft partnering with OpenAI, and what are the results?",
      "What are Nvidia's most important AI initiatives this year?",
      "How is AMD competing with Nvidia in AI chips?",
      "What is Google's overall AI strategy in 2025?"
    ]
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    text: "Market",
    examples: [
      "Compare the AI chip strategies of Nvidia, AMD, and Intel",
      "How do cloud providers (AWS, Azure, GCP) differentiate themselves?",
      "What's the impact of AI on enterprise software companies?",
      "How are semiconductor companies adapting to AI demand?"
    ]
  }
];

export default function QueryInput({ value, onChange, onSubmit, disabled }) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const textareaRef = useRef(null);
  const componentRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (componentRef.current && !componentRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuickActionClick = (actionText) => {
    setActiveDropdown(activeDropdown === actionText ? null : actionText);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleSampleClick = (question) => {
    onChange({ target: { value: question } });
    setActiveDropdown(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(e);
    setActiveDropdown(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e);
  };

  return (
    <div className="w-full relative" ref={componentRef}>
      
      {/* Main Input Area */}
      <form onSubmit={handleSubmit} className="relative group">
        <div className="flex flex-col relative">
          <div className="absolute left-5 top-5 text-slate-400 group-focus-within:text-blue-600 transition-colors duration-300">
            <Search className="w-5 h-5" />
          </div>
          <textarea
            ref={textareaRef}
            id="query-input"
            name="query"
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask about financials, strategy, or market trends..."
            className="w-full pl-14 pr-32 py-5 bg-transparent text-lg text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50 resize-none font-light tracking-wide leading-relaxed min-h-[80px]"
            style={{ minHeight: "120px" }}
          />
          
          {/* Action Bar inside Input */}
          <div className="absolute bottom-4 right-4 flex items-center gap-3">
             <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-slate-50">
               <Command className="w-3 h-3" /> Enter
             </div>
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              className="h-10 px-6 bg-slate-900 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-medium shadow-md hover:shadow-lg flex items-center gap-2"
            >
              {disabled ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Quick Actions Toolbar */}
      <div className="flex items-center gap-2 px-4 pb-4 mt-2 overflow-x-auto no-scrollbar">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider mr-2 flex-shrink-0">Quick Look:</span>
        {QUICK_ACTIONS.map((action) => (
          <div key={action.text} className="relative">
            <button
              onClick={() => handleQuickActionClick(action.text)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border ${
                activeDropdown === action.text
                  ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {action.icon}
              <span>{action.text}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Floating Dropdown Menu */}
      {activeDropdown && (
        <div className="absolute bottom-full left-0 mb-4 w-full md:w-96 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50 animate-reveal origin-bottom-left">
          <div className="p-1">
            <div className="px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-400 border-b border-slate-100">
              Suggested Queries
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {QUICK_ACTIONS.find(a => a.text === activeDropdown)?.examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleSampleClick(example)}
                  className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-between group"
                >
                  <span className="truncate pr-4">{example}</span>
                  <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
