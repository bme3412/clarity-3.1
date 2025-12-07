import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';
import { anthropicCompletion } from '../../app/lib/llm/anthropicClient.js';
import { embedText } from '../../app/lib/llm/voyageClient.js';
import { extractAndParseJSON } from '../../app/utils/jsonParser.js';
import { SparseVectorizer } from './sparseVectorizer.js';
import {
  INTENT_CLASSIFICATION_PROMPT,
  buildAnalystSystemPrompt,
  buildGeneralKnowledgePrompt
} from '../prompts/index.js';
import { financials } from '../data/financials.js';

// ----------------------------------------------------------------
// Base Classes
// ----------------------------------------------------------------

/**
 * Abstract base class for embedding text.
 * @abstract
 */
export class BaseEmbedder {
  /**
   * Embeds a given string of text.
   * @param {string} text - The text to embed.
   * @returns {Promise<number[]>} The vector embedding.
   */
  async embed(text) {
    throw new Error('Must implement embed method');
  }
}

/**
 * Abstract base class for retrieving documents.
 * @abstract
 */
export class BaseRetriever {
  /**
   * Retrieves documents based on a vector.
   * @param {number[]} vector - The query vector.
   * @param {Object} options - Retrieval options (filters, topK, etc).
   * @returns {Promise<any>} The retrieval results.
   */
  async retrieve(vector, options = {}) {
    throw new Error('Must implement retrieve method');
  }
}

/**
 * Abstract base class for analyzing data and generating responses.
 * @abstract
 */
export class BaseAnalyzer {
  /**
   * Analyzes data to answer a user query.
   * @param {Array<Object>} data - The retrieved data/context.
   * @param {Object} queryIntent - The classified intent of the user.
   * @param {string} companyName - The target company.
   * @param {string} style - The desired response style.
   * @returns {Promise<Object>} The analysis result.
   */
  async analyze(data, queryIntent, companyName, style) {
    throw new Error('Must implement analyze method');
  }
}

// ----------------------------------------------------------------
// Implementations
// ----------------------------------------------------------------

/**
 * Implementation of BaseEmbedder using Voyage AI.
 * Handles caching of embeddings to reduce API calls.
 */
export class VoyageEmbedder extends BaseEmbedder {
  /**
   * @param {string} [model='voyage-3.5'] - The Voyage model to use.
   */
  constructor(model = 'voyage-3.5') {
    super();
    this.model = model;
    /** @type {Map<string, number[]>} */
    this.cache = new Map();
  }

  /**
   * Embeds text using Voyage AI with caching.
   * @param {string} text - Text to embed.
   * @param {string} [inputType='query'] - Type of input ('query' or 'document').
   * @returns {Promise<number[]>} The embedding vector.
   */
  async embed(text, inputType = 'query') {
    if (this.cache.has(text)) {
      return this.cache.get(text);
    }

    try {
      const embedding = await embedText(text, { model: this.model, inputType });

      if (!embedding || embedding.length === 0) {
        throw new Error('Voyage returned an empty embedding.');
      }

      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      this.cache.set(text, embedding);
      return embedding;
    } catch (error) {
      console.error('Voyage embedding error:', error);
      throw new Error(`Embedding failed: ${error.message}`);
    }
  }
}


// Voyage voyage-3.5 provides 1024-dimensional embeddings optimized for retrieval.

/**
 * Implementation of BaseRetriever using Pinecone.
 * Handles query preprocessing and result post-processing.
 */
export class PineconeRetriever extends BaseRetriever {
  /**
   * @param {Object} pineconeIndex - The initialized Pinecone index instance.
   * @param {BaseEmbedder} embedder - Embedder for query enhancement.
   * @param {Object} [options]
   */
  constructor(pineconeIndex, embedder, options = {}) {
    super();
    this.index = pineconeIndex;
    this.embedder = embedder;
    this.hybridAlpha = options.hybridAlpha ?? 0.5;
    this.vectorizer = new SparseVectorizer(options.vectorizer);
    this.supportsSparse =
      typeof options.supportsSparse === 'boolean'
        ? options.supportsSparse
        : process.env.PINECONE_SUPPORTS_SPARSE !== 'false';
  }

  /**
   * Retrieves relevant vectors from Pinecone.
   * @param {number[]} vector - The query vector.
   * @param {Object} options - Options including 'topK', 'filters', and raw 'query'.
   * @returns {Promise<Object>} Pinecone query results with matches.
   */
  async retrieve(vector, options = {}) {
    const { topK = 12, filters = {}, query = '' } = options; 
    
    // Use the original vector if no query enhancement needed
    let queryVector = vector;
    
    // Enhanced query preprocessing for better relevance
    if (query) {
      const enhancedQuery = this.preprocessQuery(query);
      queryVector = await this.embedder.embed(enhancedQuery);
    }
    
    const sparseVector = query ? this.vectorizer.toSparseValues(query) : null;

    const queryParams = {
      vector: queryVector,
      topK: 40, // Increased for Hybrid/Reranking pool
      includeMetadata: true,
    };

    if (sparseVector && this.supportsSparse) {
      queryParams.sparseVector = sparseVector;
    }

    if (Object.keys(filters).length > 0) {
      queryParams.filter = filters;
    }

    try {
      const result = await this.index.query(queryParams);
      
      // Perform Hybrid Reranking (TF-IDF Boosting)
      const rankedMatches = this.hybridRerank(result.matches, query);
      const normalizedMatches = rankedMatches.map((match) => this.normalizeMetadata(match));
      
      console.log('Pinecone query result:', JSON.stringify({
        ...result,
        matches: normalizedMatches.slice(0, 3) // Log top 3
      }, null, 2));
      
      return {
        ...result,
        matches: normalizedMatches
      };
    } catch (error) {
      const sparseUnsupported =
        typeof error?.message === 'string' &&
        error.message.toLowerCase().includes('does not support sparse values');

      if (sparseUnsupported && queryParams.sparseVector) {
        console.warn(
          'Pinecone index does not support sparse vectors. Retrying with dense-only search.'
        );
        this.supportsSparse = false;
        delete queryParams.sparseVector;
        const retryResult = await this.index.query(queryParams);
        const rankedMatches = this.hybridRerank(retryResult.matches, query);
        const normalizedMatches = rankedMatches.map((match) => this.normalizeMetadata(match));
        return {
          ...retryResult,
          matches: normalizedMatches
        };
      }

      console.error('Pinecone retrieval error:', error);
      throw new Error(`Retrieval failed: ${error.message}`);
    }
  }

  // New Hybrid Reranking Method
  hybridRerank(matches, query) {
    if (!matches || matches.length === 0) return [];

    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return matches.slice(0, 10);

    const scoredMatches = matches.map(match => {
      const text = (match.metadata?.text || '').toLowerCase();
      let sparseScore = 0;

      // Simple Term Frequency Scoring
      queryTerms.forEach(term => {
        // Count occurrences
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const count = (text.match(regex) || []).length;
        if (count > 0) {
          sparseScore += (count * 0.1); // Boost per occurrence
          // Bonus for exact phrase matching could be added here
        }
      });

      // Normalize sparse score (cap at 1.0 for sanity)
      sparseScore = Math.min(sparseScore, 1.0);

      // Linear Combination: 0.7 Dense + 0.3 Sparse
      // Note: Pinecone scores are usually 0.7-0.9 range for good matches
      const hybridScore = (match.score * 0.7) + (sparseScore * 0.3);

      return {
        ...match,
        original_score: match.score,
        sparse_score: sparseScore,
        score: hybridScore
      };
    });

    return scoredMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Return top 10 re-ranked
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

    // Enhanced timeframe context
    if (enhancedQuery.includes('past year') || enhancedQuery.includes('last year')) {
      enhancedQuery += ' fiscal year 2025 2024 quarterly earnings call';
    }
    if (enhancedQuery.includes('quarter') || enhancedQuery.includes('Q')) {
      enhancedQuery += ' quarterly earnings call';
    }
    
    // Add CFO commentary context for financial queries
    if (enhancedQuery.includes('cash') || enhancedQuery.includes('revenue') || enhancedQuery.includes('financial')) {
      enhancedQuery += ' CFO commentary financial metrics';
    }

    return enhancedQuery;
  }

  normalizeMetadata(match) {
    if (!match?.metadata) return match;
    const metadata = { ...match.metadata };
    if (metadata.fiscal_year && !metadata.fiscalYear) {
      metadata.fiscalYear = metadata.fiscal_year;
    }
    if (metadata.file_type && !metadata.type) {
      metadata.type = metadata.file_type;
    }
    if (metadata.company && !metadata.company_name) {
      metadata.company_name = metadata.company;
    }
    return {
      ...match,
      metadata
    };
  }

  postProcessResults(matches, originalQuery) {
    if (!matches || matches.length === 0) return [];

    const queryTerms = originalQuery.toLowerCase().split(' ');
    const relevantTerms = ['cash', 'flow', 'revenue', 'profit', 'earnings', 'financial'];
    
    // Enhanced scoring for cash flow queries
    const isCashFlowQuery = originalQuery.toLowerCase().includes('cash flow');
    
    const scoredMatches = matches.map(match => {
      let relevanceScore = match.score;
      const text = (match.metadata?.text || '').toLowerCase();
      
      // Boost score for exact term matches
      for (const term of queryTerms) {
        if (text.includes(term) && relevantTerms.some(rt => rt.includes(term))) {
          relevanceScore += 0.1;
        }
      }
      
      // Special boost for cash flow specific content
      if (isCashFlowQuery) {
        const cashFlowTerms = ['operating cash flow', 'free cash flow', 'cash generation', 'cash from operations'];
        for (const term of cashFlowTerms) {
          if (text.includes(term)) {
            relevanceScore += 0.3;
          }
        }
      }
      
      // Penalize irrelevant content
      const irrelevantTerms = ['applecare', 'app store', 'apple pay', 'iphone_and_services'];
      for (const term of irrelevantTerms) {
        if (text.includes(term) && !originalQuery.toLowerCase().includes(term)) {
          relevanceScore -= 0.3;
        }
      }
      
      // Boost CFO commentary for financial queries
      if (text.includes('cfo') || text.includes('chief financial officer')) {
        relevanceScore += 0.2;
      }
      
      return {
        ...match,
        score: Math.max(0, relevanceScore)
      };
    });

    // Sort by enhanced relevance score and take top results
    return scoredMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 6); // Reduced to top 6 for faster processing
  }
}

export class KeywordTranscriptRetriever {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.stopWords = new Set([
      'the','and','for','with','that','this','from','have','will','into','over',
      'into','about','their','they','been','were','after','before','year','quarter'
    ]);
    this.maxResults = 5;
  }

  async retrieveByKeywords(ticker, query, intent = {}) {
    if (!ticker) return [];

    const companyDir = path.join(this.baseDir, ticker);
    if (!fs.existsSync(companyDir)) {
      console.warn(`KeywordTranscriptRetriever: No transcript dir for ${ticker}`);
      return [];
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const timeframeFilters = this.extractTimeFilters(intent?.timeframe);
    const candidateFiles = this.collectCandidateFiles(companyDir, ticker, timeframeFilters);
    const scored = [];

    for (const fileInfo of candidateFiles) {
      const text = this.readFileAsText(fileInfo.fullPath);
      if (!text) continue;
      const score = this.computeKeywordScore(text, queryTokens);
      if (score <= 0) continue;

      scored.push({
        id: `keyword-${fileInfo.fiscalYear}-${fileInfo.quarter}-${fileInfo.type}`,
        score,
        metadata: {
          company: ticker,
          fiscalYear: fileInfo.fiscalYear,
          quarter: fileInfo.quarter,
          type: `transcript_${fileInfo.type}`,
          source: path.relative(process.cwd(), fileInfo.fullPath),
          text: this.buildSnippet(text, queryTokens),
          retrieval: 'keyword'
        }
      });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, this.maxResults);
  }

  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .split(/[^a-z0-9%]+/)
      .filter(token => token.length > 2 && !this.stopWords.has(token));
  }

  extractTimeFilters(timeframe = '') {
    const filters = { quarters: [], years: [] };
    if (!timeframe) return filters;

    const quarterMatches = [...timeframe.matchAll(/q(\d)\s*(\d{4})/gi)];
    quarterMatches.forEach(match => {
      const quarter = `Q${match[1]}`;
      const year = match[2];
      filters.quarters.push({ quarter, year });
      if (!filters.years.includes(year)) filters.years.push(year);
    });

    const fyMatches = [...timeframe.matchAll(/fy\s*(\d{4})/gi)];
    fyMatches.forEach(match => {
      const year = match[1] || match[0].replace(/[^0-9]/g, '');
      if (year && !filters.years.includes(year)) {
        filters.years.push(year);
      }
    });

    return filters;
  }

  collectCandidateFiles(companyDir, ticker, filters) {
    const yearDirs = fs
      .readdirSync(companyDir)
      .filter(name => name.startsWith('FY_'))
      .sort((a, b) => parseInt(b.replace('FY_', ''), 10) - parseInt(a.replace('FY_', ''), 10));

    const selectedYears = filters.years.length > 0
      ? yearDirs.filter(dir => filters.years.includes(dir.replace('FY_', '')))
      : yearDirs.slice(0, 2); // Default to two most recent FYs

    const files = [];

    selectedYears.forEach(yearDirName => {
      const fiscalYear = yearDirName.replace('FY_', '');
      const yearDir = path.join(companyDir, yearDirName);
      if (!fs.existsSync(yearDir)) return;

      const quarterDirs = fs
        .readdirSync(yearDir)
        .filter(name => name.startsWith('Q'));

      const filteredQuarters = filters.quarters.length > 0
        ? quarterDirs.filter(q => filters.quarters.some(f => f.quarter === q && f.year === fiscalYear))
        : quarterDirs.slice(-2); // default to latest two quarters

      filteredQuarters.forEach(quarter => {
        const baseDir = path.join(yearDir, quarter, 'parsed_earnings');
        if (!fs.existsSync(baseDir)) return;

        ['earnings', 'qa'].forEach(type => {
          const candidates = [
            `${ticker}_FY_${fiscalYear}_${quarter}_${type}.json`,
            `${ticker}_FY${fiscalYear}_${quarter}_${type}.json`
          ];
          candidates.forEach(fileName => {
            const fullPath = path.join(baseDir, fileName);
            if (fs.existsSync(fullPath)) {
              files.push({ fullPath, fiscalYear, quarter, type });
            }
          });
        });
      });
    });

    // Fallback: if no files from filters, take most recent available
    if (files.length === 0) {
      yearDirs.slice(0, 1).forEach(yearDirName => {
        const fiscalYear = yearDirName.replace('FY_', '');
        const yearDir = path.join(companyDir, yearDirName);
        const quarterDirs = fs.readdirSync(yearDir).filter(name => name.startsWith('Q'));
        quarterDirs.slice(-1).forEach(quarter => {
          const baseDir = path.join(yearDir, quarter, 'parsed_earnings');
          if (!fs.existsSync(baseDir)) return;
          ['earnings', 'qa'].forEach(type => {
            const candidates = [
              `${ticker}_FY_${fiscalYear}_${quarter}_${type}.json`,
              `${ticker}_FY${fiscalYear}_${quarter}_${type}.json`
            ];
            candidates.forEach(fileName => {
              const fullPath = path.join(baseDir, fileName);
              if (fs.existsSync(fullPath)) {
                files.push({ fullPath, fiscalYear, quarter, type });
              }
            });
          });
        });
      });
    }

    return files;
  }

  readFileAsText(fullPath) {
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      if (!raw) return '';
      if (fullPath.endsWith('.json')) {
        const parsed = JSON.parse(raw);
        return JSON.stringify(parsed, null, 2);
      }
      return raw;
    } catch (error) {
      console.error('KeywordTranscriptRetriever read error:', error.message);
      return '';
    }
  }

  computeKeywordScore(text, tokens) {
    if (!text) return 0;
    const lower = text.toLowerCase();
    let score = 0;

    tokens.forEach(token => {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'g');
      const matches = lower.match(regex);
      if (matches && matches.length) {
        score += matches.length * 0.4;
      }
    });

    // Normalize by text length to avoid massive docs dominating
    const normalized = score / Math.max(tokens.length, 1);
    return Math.min(normalized + 0.1, 1.2); // small base boost to surface descriptive text
  }

  buildSnippet(text, tokens) {
    const lower = text.toLowerCase();
    for (const token of tokens) {
      const idx = lower.indexOf(token);
      if (idx !== -1) {
        const start = Math.max(0, idx - 250);
        const end = Math.min(text.length, idx + 250);
        return text.slice(start, end).replace(/\s+/g, ' ').trim();
      }
    }
    return text.slice(0, 400).replace(/\s+/g, ' ').trim();
  }
}

export class FinancialJSONRetriever {
  constructor(baseDir) {
    this.baseDir = baseDir; // e.g. path.join(process.cwd(), 'data', 'financials')
  }

  async retrieveFinancialData(ticker, timeframe = {}) {
    const fy = timeframe.fiscalYear || '2025';
    const q = timeframe.quarter || 'Q1';

    const quarterData = await financials.getQuarter(ticker, fy, q);
    if (!quarterData) {
      console.log(`No local financial data found for ${ticker} FY${fy} ${q}`);
      return [];
    }

    const text = JSON.stringify(quarterData, null, 2);

    return [
      {
        metadata: {
          company: ticker,
          quarter: q,
          fiscalYear: fy,
          type: 'financial_data',
          text,
        },
        score: 0,
      },
    ];
  }
}

export class QueryIntentAnalyzer {
  async analyze(query) {
    const userPrompt = `User query: "${query}"`;

    const rawContent = await anthropicCompletion({
      model: 'claude-opus-4-5-20251101',
      systemPrompt: INTENT_CLASSIFICATION_PROMPT,
      userPrompt,
      temperature: 0,
      maxTokens: 500,
    });

    let classification = extractAndParseJSON(rawContent);

    if (!classification) {
      console.error('Could not parse classification JSON. Raw content:', rawContent);
      // Fallback
      classification = {
        analysis_type: 'general',
        topics: ['general'],
        timeframe: 'all',
        content_type: 'all',
        company_name: null,
      };
    }

    // Optional style handling
    classification.style = classification.style || 'neutral';
    classification.explicit_periods = Array.isArray(classification.explicit_periods)
      ? classification.explicit_periods
      : [];
    classification.raw_query = query;

    console.log('Analyzed query intent:', classification);
    return classification;
  }
}

export class EnhancedFinancialAnalyst extends BaseAnalyzer {

  // Reuse the normalization logic to handle quarter/year sorting
  normalize(data) {
    return data
      .map((item) => {
        const quarterRaw = item.metadata?.quarter || 'Q1';
        const qMatch = quarterRaw.match(/^(\d+)$/);
        const qFinal = qMatch ? `Q${qMatch[1]}` : quarterRaw;

        const yearRaw = item.metadata?.fiscalYear || '2023';
        const yMatch = yearRaw.match(/\d{4}/);
        const yFinal = yMatch ? yMatch[0] : '2023';

        return {
          ...item,
          quarter: qFinal,
          year: yFinal,
        };
      })
      .sort((a, b) => {
        const yearA = parseInt(a.year, 10);
        const yearB = parseInt(b.year, 10);
        if (yearB !== yearA) return yearB - yearA;

        const qa = parseInt(a.quarter.replace('Q', ''), 10);
        const qb = parseInt(b.quarter.replace('Q', ''), 10);
        return qb - qa;
      });
  }

  // Reuse the extraction logic from the raw data
  extractText(data) {
    return data
      .map((m) => {
        if (!m.metadata?.text) return null;
        return {
          fiscalYear: m.metadata.fiscalYear,
          quarter: m.metadata.quarter,
          content: m.metadata.text,
          type: m.metadata.type || 'Unknown',
        };
      })
      .filter(Boolean);
  }

  // Remove markdown formatting while preserving text
  removeMarkdown(text) {
    // Remove markdown characters (#, *, _, `)
    return text
      .replace(/[#*_`]/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  // Enhanced analysis method
  async analyze(data, queryIntent, company = 'NVDA', style = 'professional') {
    // Normalize and extract relevant data
    const normalized = this.normalize(data);
    const relevantData = this.extractText(normalized);
    let llmUsage = null;

    // If no data found, use general knowledge with a disclaimer
    if (!relevantData.length) {
       return this.generalKnowledgeAnalysis(queryIntent, company, style);
    }

    const systemPrompt = buildAnalystSystemPrompt({ company, queryIntent, style });

    // Timeline emphasis for strategy/technology/market asks
    const isStrategy =
      ['strategic', 'technology', 'market'].includes(queryIntent.analysis_type) ||
      (queryIntent.topics || []).some((t) => t.toLowerCase().includes('ai') || t.toLowerCase().includes('strategy'));

    const timelineBlock = isStrategy
      ? `Provide a concise, year-by-year timeline (2022, 2023, 2024, 2025) of AI strategy/investment/product moves. For each year, note key launches, infra/capex signals, monetization angles, and include 2–3 short quotes/snippets with fiscal year/quarter tags. If a year lacks retrieved evidence, say so explicitly.`
      : `Focus on the most relevant financial metrics and trends. If discussing cash flow, emphasize operating cash flow, free cash flow, and cash generation. If discussing revenue, highlight growth rates and segment performance.`;

    const userPrompt = `
Query: ${queryIntent.topics.join(', ')} for ${queryIntent.timeframe}

${timelineBlock}

Data sources:
${relevantData
  .map((d) => `[${d.fiscalYear} ${d.quarter} | ${d.type}] ${d.content.substring(0, 700)}...`)
  .join('\n\n')}
`;

    try {
      const answer = await anthropicCompletion({
        model: 'claude-opus-4-5-20251101',
        systemPrompt,
        userPrompt,
        temperature: 0.7,
        maxTokens: 1500,
        onUsage: (usage) => {
          llmUsage = usage;
        }
      });

      return {
        analysis: this.removeMarkdown(answer),
        metadata: {
          data_points: relevantData.length,
          analysis_type: queryIntent.analysis_type,
          timeframe: queryIntent.timeframe,
          topics_covered: queryIntent.topics,
          quantitative_focus: true,
        },
        llm_usage: llmUsage,
      };
    } catch (error) {
      console.error('Claude analysis error:', error);
      throw new Error(`Claude analysis failed: ${error.message}`);
    }
  }

  async generalKnowledgeAnalysis(queryIntent, company, style) {
    const userPrompt = `User Query: ${queryIntent.topics.join(', ')} for ${company} (${queryIntent.timeframe})`;

    let llmUsage = null;
    try {
      const answer = await anthropicCompletion({
        model: 'claude-opus-4-5-20251101',
        systemPrompt: buildGeneralKnowledgePrompt({ company, queryIntent, style }),
        userPrompt,
        temperature: 0.7,
        maxTokens: 1000,
        onUsage: (usage) => {
          llmUsage = usage;
        }
      });

      return {
        analysis: this.removeMarkdown(answer),
        metadata: {
          data_points: 0,
          analysis_type: queryIntent.analysis_type,
          timeframe: queryIntent.timeframe,
          topics_covered: queryIntent.topics,
          quantitative_focus: false,
          source: 'general_knowledge'
        },
        llm_usage: llmUsage,
      };
    } catch (error) {
      return this.emptyAnalysis(queryIntent);
    }
  }

  emptyAnalysis(queryIntent) {
    return {
      analysis: 'No relevant data found for this query. The information might be outside our available transcripts or financials.',
      metadata: {
        query_type: queryIntent.analysis_type,
        data_points: 0,
        quantitative_focus: true
      },
    };
  }
}

