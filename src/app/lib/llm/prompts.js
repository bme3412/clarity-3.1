/**
 * Centralized prompt management for financial analysis
 */

export const BASE_SYSTEM_PROMPT = `You are a financial analyst expert specializing in performance analysis of various technology companies. 
Your role is to provide clear, accurate, and insightful analysis across multiple dimensions.`;

export function createSystemPrompt(context) {
  return `${BASE_SYSTEM_PROMPT}

Available Data Periods: ${context.availableQuarters.join(', ')}

Analysis Capabilities:
1. Quarterly Analysis: Detailed examination of specific quarters
2. Trend Analysis: Pattern identification across multiple periods
3. Thematic Analysis: Deep dives into specific topics (AI, Gaming, etc.)
4. Comparative Analysis: Quarter-over-quarter and year-over-year comparisons

Your responses should:
- Prioritize accuracy and relevance
- Support insights with specific data points
- Highlight strategic implications
- Include relevant management commentary
- Maintain clear structure and formatting`;
}

export function createAnalysisPrompt(query, context) {
  const { queryType, relevantPeriods, focusAreas } = analyzeQueryIntent(query);
  
  return `Query: "${query}"

Analysis Type: ${queryType}
Relevant Periods: ${relevantPeriods.join(', ')}
Focus Areas: ${focusAreas.join(', ')}

Please provide a comprehensive analysis addressing:
1. Key Metrics and Performance
2. Strategic Context
3. Notable Developments
4. Forward-Looking Implications

Available Data:
${JSON.stringify(context.data, null, 2)}`;
}

function analyzeQueryIntent(query) {
  const queryLower = query.toLowerCase();
  
  // Determine query type
  const types = {
    QUARTERLY: /q[1-4]|quarter|fiscal/i.test(queryLower),
    TREND: /(trend|over time|progress|evolution)/i.test(queryLower),
    THEMATIC: /(ai|gaming|data center|strategy)/i.test(queryLower),
    COMPARATIVE: /(compare|versus|vs|difference)/i.test(queryLower)
  };

  // Extract relevant periods
  const periodMatches = queryLower.match(/q[1-4]|20\d{2}|fy\d{2}/gi) || [];
  
  // Identify focus areas
  const focusAreas = new Set();
  if (queryLower.includes('ai')) focusAreas.add('Artificial Intelligence');
  if (queryLower.includes('gaming')) focusAreas.add('Gaming');
  if (queryLower.includes('data center')) focusAreas.add('Data Center');
  // Add more focus areas as needed

  return {
    queryType: Object.keys(types).find(key => types[key]) || 'GENERAL',
    relevantPeriods: periodMatches,
    focusAreas: Array.from(focusAreas)
  };
}