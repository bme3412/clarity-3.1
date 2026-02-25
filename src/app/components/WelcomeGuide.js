import React, { useState } from 'react';
import { Sparkles, TrendingUp, Cpu, DollarSign, Lightbulb, ArrowRight } from 'lucide-react';

const WelcomeGuide = ({ onStartAnalysis }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Welcome to Clarity 3.1",
      description: "Your AI-powered investment analysis assistant for Big Tech companies.",
      examples: [
        "Compare the AI chip strategies of Nvidia, AMD, and Intel",
        "How do cloud providers (AWS, Azure, GCP) differentiate themselves?",
        "What's the impact of AI on enterprise software companies?",
        "How are semiconductor companies adapting to AI demand?"
      ]
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "Financial Analysis",
      description: "Get detailed insights into revenue, profits, margins, and cash flow trends.",
      examples: [
        "What was Apple's revenue growth in Q1 2025?",
        "How have Microsoft's profit margins changed over the last year?",
        "Can you show Nvidia's cash flow trends for the past four quarters?",
        "What are Amazon's quarterly earnings highlights for 2023?"
      ]
    },
    {
      icon: <Cpu className="w-6 h-6" />,
      title: "AI & Technology",
      description: "Understand AI strategies, partnerships, and technological investments.",
      examples: [
        "How is Microsoft commercializing AI with its partner ecosystem, and what are the results?",
        "What are Nvidia's most important AI initiatives this year?",
        "How is AMD competing with Nvidia in AI chips?",
        "How is Salesforce leveraging AI in its CRM platform?"
      ]
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Market Analysis",
      description: "Compare competitive positions, market share, and industry trends.",
      examples: [
        "Can you analyze the cloud market share for major tech companies?",
        "How do Google and Microsoft compete in the cloud space?",
        "How does Salesforce compare to Oracle in enterprise software?",
        "What's AMD's competitive position against Intel in CPUs?"
      ]
    }
  ];

  const handleExampleClick = (example) => {
    onStartAnalysis(example);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/20 rounded-full mb-6">
          <Sparkles className="w-10 h-10 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">
          Get Started with Clarity 3.1
        </h1>
        <p className="text-gray-400 text-lg">
          Learn how to get the most out of your AI investment analysis
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex justify-center mb-8">
        <div className="flex space-x-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentStep 
                  ? 'bg-blue-500' 
                  : index < currentStep 
                    ? 'bg-blue-300' 
                    : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Current Step Content */}
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 mb-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-full mb-4">
            {steps[currentStep].icon}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {steps[currentStep].title}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {steps[currentStep].description}
          </p>
        </div>

        {/* Examples */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-blue-400" />
            Try these examples:
          </h3>
          {steps[currentStep].examples.map((example, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(example)}
              className="w-full text-left p-4 bg-gray-800/50 hover:bg-gray-700/50 
                border border-gray-700 hover:border-gray-600 rounded-lg transition-all 
                duration-200 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-300 group-hover:text-white transition-colors">
                  {example}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="px-6 py-3 bg-gray-800/50 hover:bg-gray-700/50 disabled:opacity-50 
            disabled:cursor-not-allowed border border-gray-700 rounded-lg text-gray-300 
            hover:text-white transition-all duration-200"
        >
          Previous
        </button>

        <div className="text-sm text-gray-500">
          Step {currentStep + 1} of {steps.length}
        </div>

        <button
          onClick={nextStep}
          disabled={currentStep === steps.length - 1}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 
            disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
        >
          {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
        </button>
      </div>

      {/* Skip Option */}
      <div className="text-center mt-8">
        <button
          onClick={() => onStartAnalysis('')}
          className="text-gray-500 hover:text-gray-400 transition-colors text-sm"
        >
          Skip tutorial and start analyzing
        </button>
      </div>
    </div>
  );
};

export default WelcomeGuide; 