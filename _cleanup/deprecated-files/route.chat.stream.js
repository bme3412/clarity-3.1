// src/app/api/chat/stream/route.js

import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';
import { FinancialDataProcessor } from '../../../../utils/financialDataProcessor.js';
import { FinancialJSONRetriever } from '../../../../lib/rag/components.js';
import { anthropicCompletion, anthropicStream } from '../../../lib/llm/anthropicClient.js';
import { embedText } from '../../../lib/llm/voyageClient.js';
import { extractAndParseJSON } from '../../../utils/jsonParser.js';

// ----------------------------------------------------------------
// 1. Company Aliases
// ----------------------------------------------------------------
const COMPANY_ALIASES = {
  apple: 'AAPL',
  aapl: 'AAPL',
  meta: 'META',
  facebook: 'META',
  fb: 'META',
  meta: 'META',
  nvidia: 'NVDA',
  nvda: 'NVDA',
  google: 'GOOGL',
  googl: 'GOOGL',
  goog:'GOOGL',
  amazon: 'AMZN',
  amzn: 'AMZN',
  amd: 'AMD',
  avago: 'AVGO',
  broadcom: 'AVGO',
  avgo: 'AVGO',
  salesforce: 'CRM',
  crm: 'CRM',
  microsoft: 'MSFT',
  msft: 'MSFT',
  oracle: 'ORCL',
  orcl: 'ORCL'
};

// ----------------------------------------------------------------
// 2. Streaming Pipeline
// ----------------------------------------------------------------
class StreamingRAGPipeline {
  constructor(pineconeIndex, baseDir) {
    this.pineconeIndex = pineconeIndex;
    this.baseDir = baseDir;
    this.embeddingCache = new Map(); // Simple in-memory cache for embeddings
    this.financialProcessor = new FinancialDataProcessor(path.join(process.cwd(), 'data', 'financials'));
    this.financialRetriever = new FinancialJSONRetriever(this.baseDir);
    this.chartCache = new Map(); // Add chart caching
  }

  detectCompany(companyName) {
    if (!companyName) return 'NVDA';
    
    // Handle array of companies (comparison queries)
    if (Array.isArray(companyName)) {
      // For comparison queries, use the first company as primary
      const primaryCompany = companyName[0];
      if (primaryCompany) {
        const lower = primaryCompany.toLowerCase();
        return COMPANY_ALIASES[lower] || 'NVDA';
      }
      return 'NVDA';
    }
    
    // Handle single company
    const lower = companyName.toLowerCase();
    return COMPANY_ALIASES[lower] || 'NVDA';
  }

  async analyzeQueryIntent(query) {
    const systemPrompt = `
    You are a classification system. Given the user's query, return a JSON object with fields:
    analysis_type: one of [technology, financial, market, strategic, general]
    topics: array of strings representing topics (e.g. ["ai","revenue"])
    timeframe: detect if user wants a specific quarter/year or general timeframe. 
    - For "past year", "last year", "previous year" → return "past year"
    - For "recent", "current", "latest" → return "recent" 
    - For specific quarters like "Q1 2023" → return "Q1 2023"
    - For specific years like "FY2022" or "2022" → return "FY2022"
    - For "future", "upcoming" → return "future"
    - If none specified, return "all"
    content_type: one of ["earnings_call", "qa", "cfo_commentary", "all"]
    company_name: the company(ies) the user is asking about. For comparison queries (e.g., "compare X and Y"), return an array of company names. For single company queries, return a string. If no company mentioned, return null.
    explicit_periods: array capturing every explicit time reference mentioned. Each entry should be an object with:
      - type: "quarter", "year", or "range"
      - value: the exact text span (e.g., "Q1 2024", "FY2023", "2019-2021")
      - (optional) fiscal_year / quarter when obvious

    IMPORTANT: When you detect a specific year (like "2024", "2023", etc.) in the query, return that year in the timeframe field as "FY2024". For specific quarters, return as "Q1 2024". For example:
    - "Google's AI strategy in 2024" → timeframe: "FY2024"
    - "Apple's revenue in 2023" → timeframe: "FY2023"
    - "Microsoft's performance in Q1 2024" → timeframe: "Q1 2024"
    Return ONLY valid JSON. 
    DO NOT wrap the JSON in triple backticks, 
    DO NOT include any additional text, code blocks, or markdown formatting.
    If your output is not valid JSON, it will break the system.
    `;
    const userPrompt = `User query: "${query}"`;

    const rawContent = await anthropicCompletion({

      model: 'claude-opus-4-5-20251101',
      systemPrompt,
      userPrompt,
      temperature: 0,
      maxTokens: 500,
    });

    let classification = extractAndParseJSON(rawContent);

    if (!classification) {
      console.error('Could not parse classification JSON. Raw content:', rawContent);
      classification = {
        analysis_type: 'general',
        topics: ['general'],
        timeframe: 'all',
        content_type: 'all',
        company_name: null,
      };
    }

    classification.style = classification.style || 'neutral';
    classification.explicit_periods = Array.isArray(classification.explicit_periods)
      ? classification.explicit_periods
      : [];
    classification.raw_query = query;
    return classification;
  }

  async embed(text) {
    // Check cache first
    if (this.embeddingCache.has(text)) {
      return this.embeddingCache.get(text);
    }

    const embedding = await embedText(text, {
      model: 'voyage-3.5',
      inputType: 'query',
    });
    
    // Cache the result (limit cache size to prevent memory issues)
    if (this.embeddingCache.size > 50) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    this.embeddingCache.set(text, embedding);
    
    return embedding;
  }

  async retrieveRelevantData(query, intent, ticker) {
    // Enhanced query preprocessing for better relevance
    const enhancedQuery = this.preprocessQuery(query);
    const vector = await this.embed(enhancedQuery);
    
    // Check if this is a comparison query
    const isComparisonQuery = Array.isArray(intent.company_name) && intent.company_name.length > 1;
    
    // Build query parameters
    const queryParams = {
      vector,
      topK: isComparisonQuery ? 15 : 12, // Reduced for faster processing
      includeMetadata: true
    };
    
    // Only add filter for non-comparison queries
    if (!isComparisonQuery) {
      queryParams.filter = this.buildFilters(intent, ticker);
    }
    
    // Query Pinecone with optimized parameters
    const result = await this.pineconeIndex.query(queryParams);

    // Post-process results for better relevance
    const filteredResults = this.postProcessResults(result.matches || [], query);
    const financialMatches = await this.retrieveLocalFinancialData(intent, ticker, query, isComparisonQuery);
    return [...financialMatches, ...filteredResults];
  }

  preprocessQuery(query) {
    // Enhance query with relevant financial terms
    const financialTerms = {
      'cash flow': 'operating cash flow free cash flow cash generation cash from operations',
      'revenue': 'revenue sales net sales total revenue top line',
      'profit': 'profit earnings net income operating income bottom line',
      'margin': 'margin gross margin operating margin profit margin',
      'growth': 'growth increase year-over-year quarter-over-quarter',
      'trend': 'trend pattern trajectory direction movement'
    };

    let enhancedQuery = query.toLowerCase();
    
    // Add relevant financial terms based on query content
    for (const [term, synonyms] of Object.entries(financialTerms)) {
      if (enhancedQuery.includes(term)) {
        enhancedQuery += ' ' + synonyms;
      }
    }

    // Enhanced timeframe context - prioritize recent data
    if (enhancedQuery.includes('2024') || enhancedQuery.includes('recent') || enhancedQuery.includes('latest')) {
      enhancedQuery += ' fiscal year 2024 2023 2022 2021 2020 quarterly earnings call recent data';
    } else if (enhancedQuery.includes('past year') || enhancedQuery.includes('last year')) {
      enhancedQuery += ' fiscal year 2024 2023 2022 quarterly earnings call';
    } else if (enhancedQuery.includes('quarter') || enhancedQuery.includes('Q')) {
      enhancedQuery += ' quarterly earnings call fiscal year 2024 2023 2022 2021 2020';
    } else {
      // Default to include all available years for comprehensive coverage
      enhancedQuery += ' fiscal year 2024 2023 2022 2021 2020 quarterly earnings call comprehensive data';
    }
    
    // Add CFO commentary context for financial queries
    if (enhancedQuery.includes('cash') || enhancedQuery.includes('revenue') || enhancedQuery.includes('financial')) {
      enhancedQuery += ' CFO commentary financial metrics';
    }

    return enhancedQuery;
  }

  postProcessResults(matches, originalQuery) {
    if (!matches || matches.length === 0) return [];

    const queryLower = originalQuery.toLowerCase();
    const queryTerms = queryLower.split(' ');
    
    // Simplified scoring for better performance
    const scoredMatches = matches.map(match => {
      let relevanceScore = match.score;
      const text = (match.metadata?.text || '').toLowerCase();
      
      // Quick boosts for common query types
      if (queryLower.includes('cash flow') && text.includes('cash flow')) {
        relevanceScore += 0.3;
      }
      if (queryLower.includes('revenue') && text.includes('revenue')) {
        relevanceScore += 0.3;
      }
      if (queryLower.includes('earnings') && text.includes('earnings')) {
        relevanceScore += 0.3;
      }
      
      // Boost recent data
      if (text.includes('2024') || text.includes('FY2024')) {
        relevanceScore += 0.2;
      } else if (text.includes('2023') || text.includes('FY2023')) {
        relevanceScore += 0.15;
      }
      
      // Boost CFO commentary
      if (text.includes('cfo') || text.includes('earnings')) {
        relevanceScore += 0.15;
      }
      
      return {
        ...match,
        score: Math.max(0, relevanceScore)
      };
    });

    // Sort and take top results
    return scoredMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Reduced to top 10 for faster processing
  }

  buildFilters(intent, ticker) {
    let baseFilter = { company: ticker };

    if (intent.content_type && intent.content_type !== 'all') {
      if (intent.content_type === 'earnings_call') {
        baseFilter.type = 'earnings';
      } else {
        baseFilter.type = intent.content_type;
      }
    }

    const timeframe = (intent.timeframe || '').toLowerCase();
    
    // Handle specific year requests (e.g., 2024FY2024)
    const yearMatch = timeframe.match(/(?:fy)?(\d{4})/i);
    if (yearMatch) {
      const specificYear = yearMatch[1];
      return {
        ...baseFilter,
        fiscalYear: specificYear
      };
    }
    
    // Handle specific quarter requests (e.g., Q1 2024)
    const quarterMatch = timeframe.match(/q(\d)\s*(\d{4})/i);
    if (quarterMatch) {
      const quarter = quarterMatch[1];
      const year = quarterMatch[2];
      return {
        ...baseFilter,
        fiscalYear: year,
        quarter: `Q${quarter}`
      };
    }
    
    // Enhanced timeframe detection for "past year"
    if (timeframe.includes('past year') || timeframe.includes('last year') || timeframe.includes('previous year')) {
      return {
        ...baseFilter,
        $or: [
          { fiscalYear: '2024' },
          { fiscalYear: '2023' }
        ]
      };
    }

    // For "recent" or latest requests, prioritize 2024 data
    if (timeframe.includes('recent') || timeframe.includes('latest') || timeframe.includes('current')) {
      return {
        ...baseFilter,
        fiscalYear: '2024'
      };
    }

    return baseFilter;
  }

  extractPeriodsFromIntent(intent, query) {
    const periods = [];
    const seen = new Set();

    const addPeriod = ({ fiscalYear, quarter = null }) => {
      if (!fiscalYear) return;
      const key = `${fiscalYear}-${quarter || 'ALL'}`;
      if (seen.has(key)) return;
      seen.add(key);
      periods.push({ fiscalYear, quarter });
    };

    const parseValue = (value) => {
      if (!value) return;
      const lower = value.toString().toLowerCase();
      const quarterRegex = /q([1-4])\s*(?:fy)?\s*(\d{4})/gi;
      let match;
      while ((match = quarterRegex.exec(lower)) !== null) {
        addPeriod({ fiscalYear: match[2], quarter: `Q${match[1]}` });
      }

      const yearRegex = /(?:fy)?\s*(\d{4})/gi;
      while ((match = yearRegex.exec(lower)) !== null) {
        addPeriod({ fiscalYear: match[1] });
      }
    };

    if (Array.isArray(intent?.explicit_periods)) {
      intent.explicit_periods.forEach((period) => {
        if (!period || typeof period !== 'object') return;
        const rawValue = period.value || '';
        const normalized = rawValue.toString().trim();
        if (!normalized) return;

        if ((period.type || '').toLowerCase() === 'quarter' || /^q[1-4]/i.test(normalized)) {
          const match = normalized.toUpperCase().match(/Q([1-4])\s*(?:FY)?\s*(\d{4})?/);
          if (match) {
            const quarter = `Q${match[1]}`;
            const year = match[2] || period.fiscal_year || period.fiscalYear || period.year;
            if (year) {
              addPeriod({ fiscalYear: year, quarter });
              return;
            }
          }
        }

        const yearMatch = normalized.match(/(\d{4})/);
        if (yearMatch) {
          addPeriod({ fiscalYear: yearMatch[1] });
        }
      });
    }

    parseValue(intent?.timeframe);
    parseValue(query);

    return periods;
  }

  async retrieveLocalFinancialData(intent, ticker, query, isComparisonQuery) {
    if (isComparisonQuery || !this.financialRetriever) return [];

    const periods = this.extractPeriodsFromIntent(intent, query);
    const matches = [];

    const loadPeriod = async ({ fiscalYear, quarter }) => {
      if (!fiscalYear) return;
      const timeframe = { fiscalYear };
      if (quarter) timeframe.quarter = quarter;
      const data = await this.financialRetriever.retrieveFinancialData(ticker, timeframe);
      if (data && data.length) {
        matches.push(...data);
      }
    };

    for (const period of periods) {
      // eslint-disable-next-line no-await-in-loop
      await loadPeriod(period);
    }

    if (!matches.length && intent.analysis_type === 'financial') {
      const currentYear = new Date().getFullYear();
      const fallbackYears = [currentYear.toString(), (currentYear - 1).toString()];
      const fallbackQuarters = ['Q4', 'Q3', 'Q2', 'Q1'];

      for (const year of fallbackYears) {
        for (const quarter of fallbackQuarters) {
          // eslint-disable-next-line no-await-in-loop
          await loadPeriod({ fiscalYear: year, quarter });
          if (matches.length >= 2) break;
        }
        if (matches.length >= 2) break;
      }
    }

    return matches;
  }

  async generateFinancialCharts(query, ticker) {
    try {
      // Determine what charts to generate based on query content
      const queryLower = query.toLowerCase();
      const charts = [];

      // Use cached data for better performance
      const cacheKey = `charts_${ticker}_${queryLower.replace(/\s+/g, '_')}`;
      
      // Check if we have cached chart data
      if (this.chartCache && this.chartCache.has(cacheKey)) {
        console.log(`[generateFinancialCharts] Using cached charts for ${ticker}`);
        return this.chartCache.get(cacheKey);
      }

      // Only generate charts for specific financial queries to reduce processing time
      if (queryLower.includes('revenue') || queryLower.includes('growth') || queryLower.includes('performance')) {
        const revenueData = await this.financialProcessor.getTimeSeriesData(ticker, ['revenue', 'netIncome'], 6);
        if (revenueData.labels.length > 0) {
          charts.push({
            type: 'revenue',
            title: `${ticker} Revenue & Net Income Trend`,
            config: this.financialProcessor.generateChartConfig(revenueData, 'line', `${ticker} Financial Performance`)
          });
        }
      }

      // Cash flow chart - only if specifically requested
      if (queryLower.includes('cash flow') || queryLower.includes('cashflow')) {
        const cashFlowData = await this.financialProcessor.getTimeSeriesData(ticker, ['operatingCashFlow', 'freeCashFlow'], 6);
        if (cashFlowData.labels.length > 0) {
          charts.push({
            type: 'cashFlow',
            title: `${ticker} Cash Flow Analysis`,
            config: this.financialProcessor.generateChartConfig(cashFlowData, 'line', `${ticker} Cash Flow Trends`)
          });
        }
      }

      // Cache the results for 2 minutes
      if (this.chartCache) {
        this.chartCache.set(cacheKey, charts);
        setTimeout(() => this.chartCache.delete(cacheKey), 2 * 60 * 1000);
      }

      return charts;
    } catch (error) {
      console.error('Error generating financial charts:', error);
      return [];
    }
  }

  async streamAnalysis(query, relevantData, intent, ticker) {
    // Detect if the user is asking for a trend/timeline/history
    const isTrendQuery = /trend|change|evolution|history|over time|progression|growth/i.test(query);

    const systemPrompt = `
You are an advanced financial and business analyst covering ${ticker}. Provide comprehensive, actionable insights that directly answer the user's question.

Key Guidelines:
- Answer the specific question asked with thorough analysis, don't provide a generic company overview.
- Lead with the most important insight or trend.
- Use specific numbers and percentages when available.
- Write in plain text without any markdown formatting.
- Use well-developed paragraphs and natural language.
- Focus on trends, changes, and implications if the user asks for a trend or history.
- If data is limited, acknowledge it and focus on what's available.
- ALWAYS cite your sources using the provided citation format.

${isTrendQuery ? `
IMPORTANT: For trend or timeline questions, present historical information in CHRONOLOGICAL ORDER (earliest to latest). Group related data points by time period and maintain a logical flow from past to present. Provide comprehensive coverage by including data from multiple quarters and years. Aim for 300–400 words unless the user requests brevity.
` : `
IMPORTANT: For summary, strategy, or "overall" questions, provide a rich, detailed synthesis of the most important and recent information for the requested period. Your answer should include:
- 3–5 key strategic initiatives, partnerships, or product developments
- Relevant quantitative metrics (e.g., revenue growth, adoption rates, partnership scale)
- The main implications for the company's business, customers, and competitive position
- A clear, readable structure with well-developed paragraphs
- Competitive analysis and market positioning when relevant
Do NOT list every quarter unless specifically asked. Focus on the main themes, strategies, and outcomes for the period in question. Aim for 400–500 words unless the user requests brevity.
`}

Query Focus:
- Analysis Type: ${intent.analysis_type}
- Topics: ${intent.topics.join(', ')}
- Timeframe: ${intent.timeframe}
- Content Type: ${intent.content_type}

Response Structure:
1. Direct answer to the question (1-2 sentences)
2. Key supporting data points (as needed)
3. Brief trend analysis or implication (if relevant)

IMPORTANT: Do NOT use section headers like "STRATEGIC IMPLICATIONS", "CONCLUSION", "HISTORICAL CONTEXT", "KEY INSIGHTS", "OUTLOOK", or similar uppercase headers. Write in flowing, natural paragraphs without dividing content into labeled sections. Your response should read like a cohesive analyst note, not a templated report with sections.

IMPORTANT: Do NOT include any citation references in the main text. Do NOT use [Source: Company FY20XX QX] format in the response body. The citations will be handled separately.

IMPORTANT: Do NOT include any follow-up questions, suggestions for additional queries, or "you might also ask" sections in your response. Focus only on providing a direct, comprehensive answer to the user's specific question.
`;

    // Format data with proper metadata for citations
    const formattedData = relevantData.map((d, index) => {
      const metadata = d.metadata || {};
      const source = metadata.fiscalYear && metadata.quarter 
        ? `${ticker} FY${metadata.fiscalYear} Q${metadata.quarter}`
        : metadata.fiscalYear 
        ? `${ticker} FY${metadata.fiscalYear}`
        : metadata.type === 'earnings' 
        ? `${ticker} Earnings Call`
        : `${ticker} Financial Data`;
      
      return {
        index: index + 1,
        source: source,
        metadata: metadata,
        text: metadata.text?.substring(0, 300) || 'No text available'
      };
    });

    const userPrompt = `
User Question: "${query}"
Company: ${ticker}
Timeframe: ${intent.timeframe}

Focus specifically on what the user is asking for. If they ask about cash flow trends, focus on cash flow metrics and trends. If they ask about financial performance, focus on key performance indicators. If they ask about competitive positioning, focus on market position and competitive advantages.

Available data:
${formattedData
  .map((d) => `[${d.index}] ${d.text}...`)
  .join('\n\n')}

Provide a direct, focused answer to the user's specific question. Avoid generic statements and focus on specific insights and trends. Do NOT include any citation references in your response.
`;

    return anthropicStream({
      model: 'claude-opus-4-5-20251101',
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 800,
    });
  }

  async extractFollowUpQuestions(fullResponse, query, intent, ticker) {
    // Use AI to generate contextually relevant follow-up questions
    return await this.generateAIBasedFollowUpQuestions(fullResponse, query, intent, ticker);
  }

  async generateAIBasedFollowUpQuestions(fullResponse, query, intent, ticker) {
    const companyName = this.getCompanyDisplayName(ticker);
    
    const systemPrompt = `
You are an expert financial analyst assistant. Your task is to generate 3 highly specific, contextual follow-up questions based on the user's original query and the detailed response provided.

Guidelines for generating follow-up questions:
1. Questions should be SPECIFIC to the actual content and insights mentioned in the response
2. Questions should build upon the specific metrics, trends, or themes discussed
3. Questions should explore deeper aspects of what was mentioned, not generic topics
4. Questions should be actionable and lead to valuable insights
5. Questions should reference specific time periods, metrics, or developments mentioned in the response
6. Avoid generic questions that could apply to any company

For example:
- If the response mentions "Q4 revenue grew 14% to $170B", ask about specific drivers or segment performance
- If the response mentions "operating margin improved from 3.8% to 7.8%", ask about cost optimization strategies
- If the response mentions "AWS growth of 13%", ask about cloud market positioning or competitive dynamics
- If the response mentions "international expansion", ask about specific markets or challenges

Return exactly 3 questions, each on a new line, without numbering or bullet points.
`;

    const userPrompt = `
Original User Query: "${query}"
Company: ${companyName} (${ticker})
Analysis Type: ${intent.analysis_type}
Topics: ${intent.topics.join(', ')}
Timeframe: ${intent.timeframe}

Detailed Response:
${fullResponse}

Generate 3 specific follow-up questions that build upon the insights and data mentioned in this response. Focus on the most interesting or important aspects that deserve deeper exploration.
`;

    try {
      const questionsText = await anthropicCompletion({
        model: 'claude-opus-4-5-20251101',
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxTokens: 300,
      });

      const questions = questionsText.split('\n').filter(q => q.trim().length > 0).slice(0, 3);
      
      // Ensure we have exactly 3 questions, fallback to default if needed
      if (questions.length < 3) {
        const defaultQuestions = this.generateDefaultFollowUpQuestions(query, intent, ticker);
        while (questions.length < 3) {
          questions.push(defaultQuestions[questions.length] || `What are ${companyName}'s key strategic priorities for the coming year?`);
        }
      }
      
      return questions;
    } catch (error) {
      console.error('Error generating AI-based follow-up questions:', error);
      // Fallback to default questions if AI generation fails
      return this.generateDefaultFollowUpQuestions(query, intent, ticker);
    }
  }

  generateDefaultFollowUpQuestions(query, intent, ticker) {
    const companyName = this.getCompanyDisplayName(ticker);
    const questions = [];
    
    // Extract key terms from the query for more contextual questions
    const queryLower = query.toLowerCase();
    const isAIQuery = /ai|artificial intelligence|machine learning|ml|generative/i.test(queryLower);
    const isFinancialQuery = /revenue|profit|earnings|financial|performance|growth|margin|cash/i.test(queryLower);
    const isStrategyQuery = /strategy|strategic|initiative|plan|approach/i.test(queryLower);
    const isCompetitiveQuery = /competitive|competition|market share|positioning/i.test(queryLower);
    const isProductQuery = /product|service|feature|development|launch/i.test(queryLower);
    const isMarginQuery = /margin|profitability|operating income|cost optimization/i.test(queryLower);
    const isQuarterlyQuery = /quarterly|q1|q2|q3|q4|quarter/i.test(queryLower);
    const isCloudQuery = /cloud|aws|azure|google cloud/i.test(queryLower);
    
    // Generate contextually relevant questions based on query type
    if (isMarginQuery && isQuarterlyQuery) {
      questions.push(
        `What specific cost optimization initiatives has ${companyName} implemented to achieve margin expansion?`,
        `How has ${companyName}'s margin performance compared to industry peers over the same period?`,
        `What are the key drivers behind ${companyName}'s margin improvement across different business segments?`
      );
    } else if (isMarginQuery) {
      questions.push(
        `What are the main factors driving ${companyName}'s profitability trends?`,
        `How is ${companyName} balancing margin expansion with growth investments?`,
        `What cost structure changes has ${companyName} made to improve operating efficiency?`
      );
    } else if (isAIQuery) {
      questions.push(
        `What specific AI technologies is ${companyName} developing that differentiate it from competitors?`,
        `How is ${companyName} measuring the success and adoption of its AI initiatives?`,
        `What challenges is ${companyName} facing in scaling its AI capabilities across different markets?`
      );
    } else if (isFinancialQuery && isQuarterlyQuery) {
      questions.push(
        `What are the key factors driving ${companyName}'s quarterly performance trends?`,
        `How has ${companyName}'s revenue growth varied across different business segments?`,
        `What challenges is ${companyName} facing in maintaining consistent quarterly growth?`
      );
    } else if (isFinancialQuery) {
      questions.push(
        `What are the key factors driving ${companyName}'s recent financial performance trends?`,
        `How is ${companyName} managing costs while investing in growth initiatives?`,
        `What new revenue opportunities is ${companyName} exploring in its core markets?`
      );
    } else if (isCloudQuery) {
      questions.push(
        `How has ${companyName}'s cloud business performance impacted overall company metrics?`,
        `What are the key drivers behind ${companyName}'s cloud service adoption and growth?`,
        `How does ${companyName} compare to competitors in the cloud market landscape?`
      );
    } else if (isStrategyQuery) {
      questions.push(
        `What are the biggest strategic risks and opportunities ${companyName} faces in the next 12 months?`,
        `How is ${companyName} balancing innovation with maintaining its core business strengths?`,
        `What strategic partnerships or acquisitions could accelerate ${companyName}'s growth plans?`
      );
    } else if (isCompetitiveQuery) {
      questions.push(
        `What specific competitive advantages does ${companyName} have in its key markets?`,
        `How is ${companyName} responding to competitive threats from emerging players?`,
        `What market expansion opportunities is ${companyName} pursuing to strengthen its position?`
      );
    } else if (isProductQuery) {
      questions.push(
        `What customer needs is ${companyName} addressing with its latest product developments?`,
        `How is ${companyName} balancing product innovation with maintaining existing customer relationships?`,
        `What feedback mechanisms does ${companyName} use to guide its product development priorities?`
      );
    } else {
      // Default questions based on analysis type
      switch (intent.analysis_type) {
        case 'financial':
          questions.push(
            `How has ${companyName}'s revenue growth trended over the past few quarters?`,
            `What are ${companyName}'s main profit drivers and margin trends?`,
            `How does ${companyName} compare to competitors in terms of financial performance?`
          );
          break;
        case 'technology':
          questions.push(
            `What are ${companyName}'s key technology investments and partnerships?`,
            `How is ${companyName} positioning itself in the AI market?`,
            `What new products or services is ${companyName} developing?`
          );
          break;
        case 'market':
          questions.push(
            `What is ${companyName}'s competitive position in its main markets?`,
            `How has ${companyName}'s market share changed recently?`,
            `What are the main challenges and opportunities for ${companyName}?`
          );
          break;
        case 'strategic':
          questions.push(
            `What are ${companyName}'s main strategic initiatives for the coming year?`,
            `How is ${companyName} adapting to market changes and competition?`,
            `What partnerships or acquisitions has ${companyName} pursued recently?`
          );
          break;
        default:
          questions.push(
            `What are the most significant operational challenges ${companyName} is addressing this year?`,
            `How is ${companyName} adapting its business model to changing market conditions?`,
            `What new market opportunities is ${companyName} exploring beyond its core business?`
          );
      }
    }
    
    return questions.slice(0, 3);
  }

  getCompanyDisplayName(ticker) {
    const companyMap = {
      'AAPL': 'Apple',
      'MSFT': 'Microsoft', 
      'GOOGL': 'Google',
      'AMZN': 'Amazon',
      'META': 'Meta',
      'NVDA': 'Nvidia',
      'AVGO': 'Broadcom',
      'CRM': 'Salesforce',
      'ORCL': 'Oracle',
      'AMD': 'AMD'
    };
    return companyMap[ticker] || ticker;
  }
}

// ----------------------------------------------------------------
// 3. Create Pipeline
// ----------------------------------------------------------------
function createStreamingPipeline() {
  const envVars = [
    'ANTHROPIC_API_KEY',
    'VOYAGE_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_INDEX',
  ];
  for (const v of envVars) {
    if (!process.env[v]) throw new Error(`${v} is required`);
  }

  const pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const pineconeIndex = pineconeClient.index(process.env.PINECONE_INDEX);
  const baseDir = path.join(process.cwd(), 'data', 'financials');

  return new StreamingRAGPipeline(pineconeIndex, baseDir);
}

const streamingPipeline = createStreamingPipeline();

// ----------------------------------------------------------------
// 4. Streaming POST Handler
// ----------------------------------------------------------------
export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: 'Invalid query.', details: 'Query cannot be empty' },
        { status: 400 }
      );
    }

    console.log('Streaming query:', query);

    // Create a ReadableStream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Add timeout to prevent very long responses
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 120000); // Increased to 120 second timeout
          });

          const processPromise = (async () => {
            // 1. Analyze query intent
            const intent = await streamingPipeline.analyzeQueryIntent(query);
            console.log('Intent:', intent);

            // 2. Detect company ticker(s)
            const isComparisonQuery = Array.isArray(intent.company_name) && intent.company_name.length > 1;
            const ticker = streamingPipeline.detectCompany(intent.company_name);
            
            console.log('Company detection:', {
              company_name: intent.company_name,
              isComparisonQuery,
              ticker,
              type: typeof intent.company_name
            });

            // 3. Retrieve relevant data and generate charts in parallel with individual timeouts
            const dataPromise = Promise.race([
              streamingPipeline.retrieveRelevantData(query, intent, ticker),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Data retrieval timeout')), 30000))
            ]);
            
            const chartsPromise = Promise.race([
              streamingPipeline.generateFinancialCharts(query, ticker),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Chart generation timeout')), 20000))
            ]);
            
            let relevantData, charts;
            try {
              [relevantData, charts] = await Promise.all([dataPromise, chartsPromise]);
            } catch (error) {
              console.error('Error in data retrieval or chart generation:', error);
              if (error.message.includes('timeout')) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({
                      type: 'error',
                      error: 'The request took too long to process. Please try a more specific query or ask about a different time period.'
                    })}\n\n`
                  )
                );
                return;
              }
              // Fallback to empty arrays if other errors occur
              relevantData = [];
              charts = [];
            }
            
            console.log('Relevant data matches:', relevantData.length);
            console.log('Generated charts:', charts.length);

            // Early return if no relevant data found
            // MODIFIED: Allow continuing without data to demonstrate Claude 4.5 capabilities
            if (relevantData.length === 0) {
              console.warn('No relevant data found (or retrieval failed). Proceeding with internal knowledge.');
              // We'll inject a placeholder so the analysis can proceed
              relevantData = [{
                metadata: {
                  text: "No internal financial documents were found for this query. Please rely on your general knowledge to answer this question, but explicitly mention that you are not using real-time retrieved financial data.",
                  source: "System Message",
                  type: "system_warning",
                  fiscalYear: "N/A",
                  quarter: "N/A"
                }
              }];
            }

            // 4. Stream the analysis with timeout
            const analysisPromise = Promise.race([
              streamingPipeline.streamAnalysis(query, relevantData, intent, ticker),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis timeout')), 45000))
            ]);
            
            let analysisStream;
            try {
              analysisStream = await analysisPromise;
            } catch (error) {
              console.error('Error in analysis streaming:', error);
              if (error.message.includes('timeout')) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({
                      type: 'error',
                      error: 'The analysis took too long to generate. Please try a more specific query.'
                    })}\n\n`
                  )
                );
                return;
              }
              throw error; // Re-throw other errors
            }

            // Send initial metadata with citation info
            const citationSources = relevantData.map((d, index) => {
              const metadata = d.metadata || {};
              const source = metadata.fiscalYear && metadata.quarter 
                ? `${ticker} FY${metadata.fiscalYear} Q${metadata.quarter}`
                : metadata.fiscalYear 
                ? `${ticker} FY${metadata.fiscalYear}`
                : metadata.type === 'earnings' 
                ? `${ticker} Earnings Call`
                : `${ticker} Financial Data`;
              
              return {
                index: index + 1,
                source: source,
                fiscalYear: metadata.fiscalYear,
                quarter: metadata.quarter,
                type: metadata.type
              };
            });

            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({
                  type: 'metadata',
                  data_points: relevantData.length,
                  analysis_type: intent.analysis_type,
                  timeframe: intent.timeframe,
                  topics_covered: intent.topics,
                  citations: citationSources,
                  charts: charts
                })}\n\n`
              )
            );

            // Stream the analysis content
            let fullResponse = '';
            for await (const fragment of analysisStream) {
              const content = typeof fragment === 'string' ? fragment : '';
              if (content) {
                fullResponse += content;
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ type: 'content', content })}\n\n`
                  )
                );
              }
            }

            // Extract follow-up questions from the full response
            const followUpQuestions = await streamingPipeline.extractFollowUpQuestions(fullResponse, query, intent, ticker);

            // Send follow-up questions as metadata
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({
                  type: 'followup_questions',
                  questions: followUpQuestions
                })}\n\n`
              )
            );

            // Send end marker
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'end' })}\n\n`
              )
            );
          })();

          await Promise.race([processPromise, timeoutPromise]);

        } catch (error) {
          console.error('Streaming error:', error);
          let errorMessage = 'An error occurred while processing your query.';
          
          if (error.message === 'Request timeout') {
            errorMessage = 'The request took too long to process. Please try a more specific query.';
          } else if (error.message.includes('toLowerCase')) {
            errorMessage = 'Error processing company information. Please try rephrasing your query.';
          } else if (error.message.includes('JSON')) {
            errorMessage = 'Error parsing response. Please try a different query.';
          }
          
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: 'error', 
                error: errorMessage
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (err) {
    console.error('Request parsing error:', err);
    return NextResponse.json(
      {
        analysis: 'Failed to process the request. Ensure JSON body with { query: "..." }.',
        metadata: { error: err.message },
      },
      { status: 400 }
    );
  }
}