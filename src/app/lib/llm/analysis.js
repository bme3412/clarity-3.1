import { createSystemPrompt, createAnalysisPrompt } from './prompts';
import { processQuarterlyData } from '../data/processors/quarterlyData';
import { extractTrends } from '../data/processors/trends';
import { analyzeThematic } from '../data/processors/thematic';
import { anthropicCompletion } from './anthropicClient.js';

export async function generateAnalysis(query, rawData) {
  try {
    // Process and validate data
    const processedData = processQuarterlyData(rawData);
    
    // Prepare context
    const context = {
      availableQuarters: processedData.map(d => `FY${d.fiscal_year} Q${d.quarter}`),
      data: processedData
    };

    // Generate analysis
    const baseAnalysis = await anthropicCompletion({
      model: 'claude-opus-4-5-20251101',
      systemPrompt: createSystemPrompt(context),
      userPrompt: createAnalysisPrompt(query, context),
      temperature: 0.1,
      maxTokens: 2500,
    });
    const enhancedAnalysis = await enhanceAnalysis(baseAnalysis, context);

    return {
      analysis: enhancedAnalysis,
      metadata: {
        analyzed_periods: context.availableQuarters,
        data_points: countDataPoints(processedData)
      }
    };

  } catch (error) {
    console.error('Analysis generation error:', error);
    throw new Error('Failed to generate analysis');
  }
}

async function enhanceAnalysis(baseAnalysis, context) {
  // Run independent analyses in parallel
  const [trends, thematicInsights] = await Promise.all([
    extractTrends(context.data),
    analyzeThematic(context.data)
  ]);

  return {
    main_analysis: baseAnalysis,
    trends,
    thematic_insights: thematicInsights
  };
}

function countDataPoints(data) {
  return {
    quarters: data.length,
    segments: data.reduce((acc, q) => acc + (q.segments?.length || 0), 0),
    metrics: data.reduce((acc, q) => acc + Object.keys(q.operational_metrics || {}).length, 0)
  };
}