import { COMPANY_ALIASES } from '../../config/rag.js';
import { financials } from '../data/financials.js';

/**
 * Base RAG Pipeline orchestrator.
 */
export class RAGPipeline {
  /**
   * @param {BaseEmbedder} embedder 
   * @param {BaseRetriever} retriever 
   * @param {BaseAnalyzer} analyzer 
   * @param {QueryIntentAnalyzer} intentAnalyzer 
   */
  constructor(embedder, retriever, analyzer, intentAnalyzer) {
    this.embedder = embedder;
    this.retriever = retriever;
    this.analyzer = analyzer;
    this.intentAnalyzer = intentAnalyzer;
  }

  detectCompany(companyName) {
    if (!companyName) return 'NVDA'; // fallback
    
    // Handle array of companies (comparison queries)
    if (Array.isArray(companyName)) {
      // For comparison queries, use the first company as primary
      const primaryCompany = companyName[0];
      if (primaryCompany) {
        const lower = primaryCompany.toLowerCase();
        return COMPANY_ALIASES[lower] || primaryCompany.toUpperCase();
      }
      return 'NVDA';
    }
    
    // Handle single company
    const lower = companyName.toLowerCase();
    return COMPANY_ALIASES[lower] || companyName.toUpperCase();
  }

  extractQuartersAndYears(timeframeString) {
    const regex = /q([1-4])(?:\s*fy)?\s*(\d{4})/gi;
    const matches = [...timeframeString.matchAll(regex)];
    return matches.map(m => ({
      quarter: m[1],
      fiscalYear: m[2],
    }));
  }

  extractPeriodsFromIntent(intent) {
    if (!intent || !Array.isArray(intent.explicit_periods)) return [];

    return intent.explicit_periods
      .map((period) => {
        if (!period || typeof period !== 'object') return null;
        const rawValue = (period.value || '').toString().trim();
        if (!rawValue) return null;

        const normalized = rawValue.toUpperCase();
        const periodType = (period.type || '').toLowerCase();

        if (periodType === 'quarter' || /^Q[1-4]/.test(normalized)) {
          const quarterMatch = normalized.match(/Q([1-4])\s*(?:FY)?\s*(\d{4})?/);
          if (quarterMatch) {
            const quarter = quarterMatch[1];
            const year = quarterMatch[2] || period.fiscal_year || period.fiscalYear || period.year;
            if (year) {
              return { quarter: `Q${quarter}`, fiscalYear: year };
            }
          }
        }

        if (periodType === 'year' || normalized.startsWith('FY') || /^\d{4}$/.test(normalized)) {
          const yearMatch = normalized.match(/(\d{4})/);
          if (yearMatch) {
            return { fiscalYear: yearMatch[1] };
          }
        }

        return null;
      })
      .filter(Boolean);
  }

  buildFilters(intent, ticker) {
    let baseFilter = { company: ticker };

    if (intent.content_type && intent.content_type !== 'all') {
      if (intent.content_type === 'earnings_call') {
        baseFilter.file_type = 'earnings';
      } else {
        baseFilter.file_type = intent.content_type;
      }
    }

    const timeframe = (intent.timeframe || '').toLowerCase();
    const fallbackText = (intent.raw_query || '').toLowerCase();
    const llmPeriods = this.extractPeriodsFromIntent(intent);

    let quartersAndYears = llmPeriods
      .filter(period => period.quarter && period.fiscalYear)
      .map(period => ({
        quarter: period.quarter.replace('Q', ''),
        fiscalYear: period.fiscalYear
      }));

    if (!quartersAndYears.length) {
      quartersAndYears = this.extractQuartersAndYears(timeframe);
    }
    if (!quartersAndYears.length && fallbackText) {
      quartersAndYears = this.extractQuartersAndYears(fallbackText);
    }

    let fiscalYears = llmPeriods
      .filter(period => !period.quarter && period.fiscalYear)
      .map(period => period.fiscalYear);

    if (!fiscalYears.length) {
      const fyRegex = /fy\s*(\d{4})/gi;
      let fyMatches = [...timeframe.matchAll(fyRegex)];
      if (!fyMatches.length && fallbackText) {
        fyMatches = [...fallbackText.matchAll(fyRegex)];
      }
      fiscalYears = fyMatches.map(m => m[1]);
    }

    // Enhanced timeframe detection for "past year"
    if (timeframe.includes('past year') || timeframe.includes('last year') || timeframe.includes('previous year')) {
      return {
        ...baseFilter,
        $or: [
          { fiscal_year: '2024' },
          { fiscal_year: '2023' }
        ]
      };
    }

    // "recent" fallback
    if (timeframe === 'recent' && !quartersAndYears.length && !fiscalYears.length) {
      return {
        ...baseFilter,
        fiscal_year: '2024'
      };
    }

    // If multiple Q references
    if (quartersAndYears.length > 1) {
      const orClauses = quartersAndYears.map(qy => ({
        quarter: qy.quarter,
        fiscal_year: qy.fiscalYear
      }));
      return {
        $and: [
          baseFilter,
          { $or: orClauses }
        ]
      };
    }

    // If exactly one Q reference
    if (quartersAndYears.length === 1) {
      return {
        ...baseFilter,
        fiscal_year: quartersAndYears[0].fiscalYear,
        quarter: `Q${quartersAndYears[0].quarter}`
      };
    }

    // If multiple FY references
    if (fiscalYears.length > 1) {
      const orFYs = fiscalYears.map(y => ({ fiscal_year: y }));
      return {
        $and: [
          baseFilter,
          { $or: orFYs }
        ]
      };
    }

    // If exactly one FY reference
    if (fiscalYears.length === 1) {
      return {
        ...baseFilter,
        fiscal_year: fiscalYears[0]
      };
    }

    // Otherwise just return the base filter
    return baseFilter;
  }

  async process(query) {
    console.log('Base pipeline process. Extend me for custom logic.');
    return { analysis: 'No data.', metadata: {} };
  }
}

export class ExtendedRAGPipeline extends RAGPipeline {
  constructor(embedder, retriever, analyzer, intentAnalyzer, keywordRetriever) {
    super(embedder, retriever, analyzer, intentAnalyzer);
    this.keywordRetriever = keywordRetriever;
  }

  async process(query) {
    console.log('Processing query:', query);
    const wallStart = Date.now();
    const metrics = {
      timings: {},
      retrieval: {},
      fallbacks: {},
      intent: {},
      llm: null
    };

    // 1) Analyze the user query
    const intentStart = Date.now();
    const intent = await this.intentAnalyzer.analyze(query);
    metrics.timings.intentMs = Date.now() - intentStart;
    intent.raw_query = query;
    console.log('Intent:', intent);

    // 2) Detect company ticker(s)
    const isComparisonQuery = Array.isArray(intent.company_name) && intent.company_name.length > 1;
    const primaryTicker = this.detectCompany(intent.company_name);
    
    console.log('Company detection:', {
      company_name: intent.company_name,
      isComparisonQuery,
      primaryTicker,
      type: typeof intent.company_name
    });
    
    // For comparison queries, we'll use a broader search without company filters
    const useCompanyFilter = !isComparisonQuery;

    // 3) Generate embedding
    const embeddingStart = Date.now();
    const vector = await this.embedder.embed(query);
    metrics.timings.embeddingMs = Date.now() - embeddingStart;

    // 4) Build filters
    const filters = useCompanyFilter ? this.buildFilters(intent, primaryTicker) : {};

    // 5) Retrieve transcripts from Pinecone
    const pineconeStart = Date.now();
    const pineconeRes = await this.retriever.retrieve(vector, { filters, query });
    metrics.timings.pineconeMs = Date.now() - pineconeStart;
    const transcripts = pineconeRes.matches || [];
    console.log('Transcript matches:', transcripts.length);

    // 6) Optionally retrieve local financial data
    let finMatches = [];
    const isFinQuery =
      intent.analysis_type === 'financial' ||
      (intent.topics || []).some((t) =>
        ['financial', 'revenue', 'eps', 'profit'].includes(t.toLowerCase())
      );

    // Try to fetch financial data if it's a financial query OR if we found no transcripts (fallback)
    if ((isFinQuery || transcripts.length === 0) && !isComparisonQuery) {
      const financialStart = Date.now();
      // For comparison queries, skip financial data retrieval to avoid complexity
      const timeframe = {};
      const intentTimeframe = (intent.timeframe || '').toLowerCase();
      const fallbackText = query.toLowerCase();
      const pushQuarterMatch = async (fiscalYear, quarter) => {
        const data = await financials.getQuarter(primaryTicker, fiscalYear, quarter);
        if (data) {
          finMatches.push({
            metadata: {
              company: primaryTicker,
              fiscalYear,
              quarter,
              type: 'financial_data',
              text: JSON.stringify(data, null, 2)
            },
            score: 0
          });
        }
      };

      const llmPeriods = this.extractPeriodsFromIntent(intent);
      let quartersAndYears = llmPeriods
        .filter(period => period.quarter && period.fiscalYear)
        .map(period => ({
          quarter: period.quarter.replace('Q', ''),
          fiscalYear: period.fiscalYear
        }));

      if (!quartersAndYears.length) {
        quartersAndYears = this.extractQuartersAndYears(intentTimeframe);
      }
      if (!quartersAndYears.length) {
        quartersAndYears = this.extractQuartersAndYears(fallbackText);
      }

      let fiscalYears = llmPeriods
        .filter(period => !period.quarter && period.fiscalYear)
        .map(period => period.fiscalYear);

      if (!fiscalYears.length) {
        const fyRegex = /fy\s*(\d{4})/gi;
        let fyMatches = [...intentTimeframe.matchAll(fyRegex)];
        if (!fyMatches.length) {
          fyMatches = [...fallbackText.matchAll(fyRegex)];
        }
        fiscalYears = fyMatches.map(m => m[1]);
      }

      // Multiple Q references
      if (quartersAndYears.length > 1) {
        for (const qy of quartersAndYears) {
          await pushQuarterMatch(qy.fiscalYear, `Q${qy.quarter}`);
        }
      } else if (quartersAndYears.length === 1) {
        // Single Q
        timeframe.fiscalYear = quartersAndYears[0].fiscalYear;
        timeframe.quarter = `Q${quartersAndYears[0].quarter}`;
        await pushQuarterMatch(timeframe.fiscalYear, timeframe.quarter);
      } else if (fiscalYears.length > 1) {
        // Multiple FY
        for (const fy of fiscalYears) {
          const yearData = await financials.getMultipleQuarters(primaryTicker, fy);
          yearData.forEach((entry) => {
            finMatches.push({
              metadata: {
                company: primaryTicker,
                fiscalYear: fy,
                quarter: entry.quarter,
                type: 'financial_data',
                text: JSON.stringify(entry, null, 2)
              },
              score: 0
            });
          });
        }
      } else if (fiscalYears.length === 1) {
        // Single FY
        timeframe.fiscalYear = fiscalYears[0];
        const yearData = await financials.getMultipleQuarters(primaryTicker, timeframe.fiscalYear);
        yearData.forEach((entry) => {
          finMatches.push({
            metadata: {
              company: primaryTicker,
              fiscalYear: timeframe.fiscalYear,
              quarter: entry.quarter,
              type: 'financial_data',
              text: JSON.stringify(entry, null, 2)
            },
            score: 0
          });
        });
      } else {
        // Enhanced fallback for "past year" or recent queries
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;
        
        // Try to get data from the most recent quarters first (more likely to exist)
        const quarters = ['Q4', 'Q3', 'Q2', 'Q1'];
        const years = [currentYear.toString(), previousYear.toString()];
        
        for (const year of years) {
          for (const quarter of quarters) {
            await pushQuarterMatch(year, quarter);
            if (finMatches.length > 0) {
              // Only get 2-3 quarters to avoid too much data
              if (finMatches.length >= 3) break;
            }
          }
          if (finMatches.length >= 3) break;
        }
        
        // If still no data, fallback to 2024 Q1
        if (finMatches.length === 0) {
          await pushQuarterMatch('2024', 'Q1');
        }
      }

      console.log('Financial data matches:', finMatches.length);
      metrics.timings.financialMs = Date.now() - financialStart;
    }

    // 7) Keyword-based fallback retrieval for descriptive context
    let keywordMatches = [];
    if (this.keywordRetriever) {
      const missingNarrative = transcripts.length === 0 || transcripts.every(match => (match.metadata?.type || '').includes('financial_data'));
      if (missingNarrative || isFinQuery) {
        const keywordStart = Date.now();
        keywordMatches = await this.keywordRetriever.retrieveByKeywords(primaryTicker, query, intent);
        console.log('Keyword matches:', keywordMatches.length);
        metrics.timings.keywordMs = (metrics.timings.keywordMs || 0) + (Date.now() - keywordStart);
      }
    }

    // 8) Merge transcripts + keyword + financial data
    const combined = [...transcripts, ...keywordMatches, ...finMatches];
    
    // 9) Final text from EnhancedFinancialAnalyst
    // Pass empty array if no data found, letting analyzer handle it with general knowledge
    const llmStart = Date.now();
    const analysisResult = await this.analyzer.analyze(combined, intent, primaryTicker, intent.style);
    metrics.timings.llmMs = Date.now() - llmStart;
    metrics.timings.totalMs = Date.now() - wallStart;
    metrics.llm = analysisResult.llm_usage || null;
    metrics.intent = {
      analysis_type: intent.analysis_type,
      timeframe: intent.timeframe,
      company_name: intent.company_name,
      isComparisonQuery,
      primaryTicker
    };
    metrics.retrieval = {
      pineconeMatches: transcripts.length,
      financialMatches: finMatches.length,
      keywordMatches: keywordMatches.length,
      combinedContext: combined.length,
      filtersApplied: filters
    };
    metrics.fallbacks = {
      usedFinancialData: finMatches.length > 0,
      usedKeywordFallback: keywordMatches.length > 0,
      financialQuery: isFinQuery,
      hadTranscriptMatches: transcripts.length > 0
    };
    
    return {
      ...analysisResult,
      context: combined,
      metrics
    };
  }
}


