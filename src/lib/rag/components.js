import { Pinecone } from '@pinecone-database/pinecone';
import fs from 'fs';
import path from 'path';
import { anthropicCompletion } from '../../app/lib/llm/anthropicClient.js';
import { embedText } from '../../app/lib/llm/voyageClient.js';
import { extractAndParseJSON } from '../../app/utils/jsonParser.js';
import { SparseVectorizer } from './sparseVectorizer.js';
import { COMPANY_ALIASES } from '../../config/rag.js';
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
    this.hybridAlpha = options.hybridAlpha ?? 0.85; // Rebalance: prefer dense (85%) over sparse (15%) to prevent sparse overpowering
    this.vectorizer = new SparseVectorizer(options.vectorizer);
    this.supportsSparse =
      typeof options.supportsSparse === 'boolean'
        ? options.supportsSparse
        : process.env.PINECONE_SUPPORTS_SPARSE !== 'false';
    this.scoreFloor = options.scoreFloor ?? 0.25;
    this.maxResults = options.maxResults ?? 8;
    // simple in-memory cache for repeated queries
    this.cacheTtlMs = options.cacheTtlMs ?? 3 * 60 * 1000; // 3 minutes
    this.maxCacheEntries = options.maxCacheEntries ?? 200;
    this.cache = new Map(); // key -> { expires, result }
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
      // Pull a healthy pool, then trim after rerank/dedup
      topK: Math.max(topK, 35),
      includeMetadata: true,
    };

    if (sparseVector && this.supportsSparse) {
      queryParams.sparseVector = sparseVector;
    }

    if (Object.keys(filters).length > 0) {
      queryParams.filter = filters;
    }

    // Cache key
    const cacheKey = this.buildCacheKey({ query, filters, topK });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.index.query(queryParams);
      
      // Perform Hybrid Reranking (TF-IDF Boosting)
      const rankedMatches = this.hybridRerank(result.matches, query);
      const normalizedMatches = rankedMatches.map((match) => this.normalizeMetadata(match));
      const filtered = this.filterAndDedupMatches(normalizedMatches);
      
      console.log('Pinecone query result:', JSON.stringify({
        ...result,
        matches: filtered.slice(0, 3) // Log top 3
      }, null, 2));

      const finalRes = {
        ...result,
        matches: filtered
      };
      this.setCache(cacheKey, finalRes);
      return finalRes;
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
        const filtered = this.filterAndDedupMatches(normalizedMatches);
        const finalRes = {
          ...retryResult,
          matches: filtered
        };
        this.setCache(cacheKey, finalRes);
        return finalRes;
      }

      console.error('Pinecone retrieval error:', error);
      throw new Error(`Retrieval failed: ${error.message}`);
    }
  }

  buildCacheKey({ query, filters, topK }) {
    const filterStr = JSON.stringify(filters || {});
    return `${query}::${filterStr}::${topK}`;
  }

  getFromCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  setCache(key, result) {
    const expires = Date.now() + this.cacheTtlMs;
    // evict oldest if over capacity
    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { expires, result });
  }

  // New Hybrid Reranking Method
  hybridRerank(matches, query) {
    if (!matches || matches.length === 0) return [];

    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return matches.slice(0, 12);

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

      // Penalize legal boilerplate / risk factors
      // These sections often contain many keywords but have low information density
      const boilerplateMarkers = [
        'forward-looking statements',
        'risk factors',
        'actual results to differ',
        'safe harbor',
        'litigation',
        'unknown risks',
        'material factors that could cause'
      ];
      
      const isBoilerplate = boilerplateMarkers.some(marker => text.includes(marker));
      let penalty = isBoilerplate ? 0.35 : 0.0;

      // Linear Combination: 0.85 Dense + 0.15 Sparse (rebalance to favor dense semantics)
      // Apply penalty to the final score
      const hybridScore = ((match.score * 0.85) + (sparseScore * 0.15)) - penalty;

      return {
        ...match,
        original_score: match.score,
        sparse_score: sparseScore,
        score: Math.max(0, hybridScore) // Ensure non-negative
      };
    });

    return scoredMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 12); // Keep a small pool for downstream filtering
  }

  filterAndDedupMatches(matches = []) {
    const seen = new Set();
    const filtered = [];
    for (const m of matches || []) {
      if (typeof m.score === 'number' && m.score < this.scoreFloor) continue;
      const md = m.metadata || {};
      const key = [
        md.company || md.company_name || md.ticker || '',
        md.fiscalYear || md.fiscal_year || '',
        md.quarter || '',
        md.type || md.file_type || '',
        md.source || md.source_file || ''
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      filtered.push(m);
      if (filtered.length >= this.maxResults) break;
    }
    // If we over-filtered and lost everything, fall back to the top few by score
    if (filtered.length === 0 && matches?.length) {
      return [...matches]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, this.maxResults);
    }
    // If we have just 1 result but more are available, backfill a couple more to give context
    if (filtered.length < 2 && matches?.length > filtered.length) {
      const extras = [...matches]
        .filter((m) => !filtered.includes(m))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, this.maxResults - filtered.length);
      return [...filtered, ...extras];
    }
    return filtered;
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
  detectTicker(query) {
    const lower = query.toLowerCase();
    for (const [alias, ticker] of Object.entries(COMPANY_ALIASES)) {
      if (lower.includes(alias)) return ticker;
    }
    const tickerMatch = lower.match(/\b[A-Z]{2,5}\b/);
    return tickerMatch ? tickerMatch[0].toUpperCase() : null;
  }

  detectTimeframe(query) {
    const lower = query.toLowerCase();
    const qMatch = lower.match(/q([1-4])\s*(20\d{2})/i);
    if (qMatch) return `Q${qMatch[1]} ${qMatch[2]}`;
    const fyMatch = lower.match(/fy\s*(20\d{2})/i);
    if (fyMatch) return `FY${fyMatch[1]}`;
    if (lower.includes('past year') || lower.includes('last year')) return 'past year';
    if (lower.includes('recent') || lower.includes('latest')) return 'recent';
    return 'all';
  }

  detectAnalysisType(query) {
    const lower = query.toLowerCase();
    const financialWords = ['revenue', 'eps', 'margin', 'cash flow', 'guidance', 'financial'];
    const guidanceWords = ['guidance', 'outlook', 'forecast'];
    const comparisonWords = [' vs ', ' versus ', 'compare', 'comparison'];
    const techWords = ['ai', 'ml', 'roadmap', 'product', 'technology', 'infrastructure'];
    const marketWords = ['market', 'share', 'competition'];

    if (guidanceWords.some((w) => lower.includes(w))) return 'guidance';
    if (comparisonWords.some((w) => lower.includes(w))) return 'comparison';
    if (financialWords.some((w) => lower.includes(w))) return 'financial';
    if (marketWords.some((w) => lower.includes(w))) return 'market';
    if (techWords.some((w) => lower.includes(w))) return 'technology';
    return 'general';
  }

  heuristicIntent(query) {
    const ticker = this.detectTicker(query);
    const timeframe = this.detectTimeframe(query);
    const analysisType = this.detectAnalysisType(query);
    const topics = query.split(/\s+/).slice(0, 8);
    const confident = !!ticker || analysisType !== 'general';
    return {
      intent: {
        analysis_type: analysisType,
        topics,
        timeframe,
        content_type: 'all',
        company_name: ticker,
        explicit_periods: [],
        style: 'neutral',
        raw_query: query,
      },
      confident,
    };
  }

  async analyze(query) {
    const heuristic = this.heuristicIntent(query);
    if (heuristic.confident) {
      return heuristic.intent;
    }

    const userPrompt = `User query: "${query}"`;
    try {
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
        classification = heuristic.intent;
      }

      classification.style = classification.style || 'neutral';
      classification.explicit_periods = Array.isArray(classification.explicit_periods)
        ? classification.explicit_periods
        : [];
      classification.raw_query = query;

      console.log('Analyzed query intent:', classification);
      return classification;
    } catch (err) {
      console.error('Intent LLM failed, using heuristic intent:', err?.message || err);
      return heuristic.intent;
    }
  }
}

export class EnhancedFinancialAnalyst extends BaseAnalyzer {

  constructor(modelOverride) {
    super();
    this.analysisModel =
      modelOverride ||
      process.env.ANTHROPIC_ANALYSIS_MODEL ||
      'claude-sonnet-4-20250514';
  }

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
      .filter(Boolean)
      // Ensure financial_data items come first so numeric facts are seen early
      .sort((a, b) => {
        const aFin = a.type === 'financial_data';
        const bFin = b.type === 'financial_data';
        if (aFin && !bFin) return -1;
        if (bFin && !aFin) return 1;
        return 0;
      });
  }

  sliceSpan(text, maxChars = 700) {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    const numMatch = text.search(/\d[\d,\.]/);
    if (numMatch === -1) return text.slice(0, maxChars);
    const half = Math.floor(maxChars / 2);
    const start = Math.max(0, numMatch - half);
    const end = Math.min(text.length, start + maxChars);
    return text.slice(start, end);
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

    // If no grounded data, explicitly return not found to avoid hallucinations
    if (!relevantData.length) {
      return this.emptyAnalysis(queryIntent);
    }

    const systemPrompt = buildAnalystSystemPrompt({ company, queryIntent, style });

    const isStrategy =
      ['strategic', 'technology', 'market'].includes(queryIntent.analysis_type) ||
      (queryIntent.topics || []).some((t) => t.toLowerCase().includes('ai') || t.toLowerCase().includes('strategy'));

    const contextRows = relevantData
      // Keep a larger slice to retain numeric details (revenues, margins, guidance)
      .map((d, idx) => `[C${idx + 1}] (${d.fiscalYear} ${d.quarter} | ${d.type}) ${this.sliceSpan(d.content, 600)}...`)
      .join('\n');

    const formatBlock = isStrategy
      ? `Output format:
- Bullet list, each bullet = single claim with [C#].
- If a requested fact is absent, write "Not found in provided sources."
- No speculation. No extra commentary.`
      : `Output format (financial):
- Revenue/metric: $X (YoY +Y% / QoQ +Z%) [C#]
- Margin/segment if asked: value + change [C#]
- Optional one supporting note ONLY if directly in context [C#]
- If data missing: "Not found in provided sources."`;

    const userPrompt = `
Question: ${queryIntent.topics.join(', ')} for ${queryIntent.timeframe}

Instructions:
- First, list atomic facts with citations [C#].
- Then write the final answer using ONLY those facts.
- CRITICAL: Do NOT invent guidance figures. If guidance for a specific future period is not explicitly in the text, say "Not found".
- CRITICAL: Do not confuse Fiscal Years (FY) with Calendar Years. Use the dates in the context.
- Ignore general "Risk Factors" or "Forward-Looking Statements" disclaimers unless they describe specific strategic initiatives.
- If a fact is not in the context, respond "Not found in provided sources."

${formatBlock}

Context (use as citations):
${contextRows}
`;

    try {
      const answer = await anthropicCompletion({
        model: this.analysisModel,
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 550,
        onUsage: (usage) => {
          llmUsage = usage;
        }
      });
      const cleaned = this.removeMarkdown(answer);
      // Verify numeric claims appear in the provided context to reduce hallucinations
      const contextBlob = relevantData.map((d) => d.content.toLowerCase()).join('\n');
      const { unmatched, matched } = this.findUnmatchedNumbers(cleaned, contextBlob);
      // Soft-fail: if unmatched numbers exist, return answer but flag partial verification
      const partialVerification = matched.length === 0 && unmatched.length > 0;

      return {
        analysis: cleaned,
        metadata: {
          data_points: relevantData.length,
          analysis_type: queryIntent.analysis_type,
          timeframe: queryIntent.timeframe,
          topics_covered: queryIntent.topics,
          quantitative_focus: true,
          partial_verification: partialVerification || undefined,
        },
        llm_usage: llmUsage,
      };
    } catch (error) {
      console.error('Claude analysis error:', error);
      throw new Error(`Claude analysis failed: ${error.message}`);
    }
  }

  emptyAnalysis(queryIntent) {
    return {
      analysis: 'Not found in provided sources.',
      metadata: {
        query_type: queryIntent.analysis_type,
        data_points: 0,
        quantitative_focus: true
      },
    };
  }

  findUnmatchedNumbers(answerText, contextBlob) {
    if (!answerText) return [];
    const answerNums = this.extractNumericValues(answerText);
    const contextNums = this.extractNumericValues(contextBlob || '');
    if (contextNums.length === 0) {
      return { unmatched: answerNums.map((n) => n.raw), matched: [] };
    }

    const unmatched = [];
    const matched = [];
    const withinTolerance = (a, b) => {
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      const denom = Math.max(Math.abs(a), Math.abs(b), 1);
      return Math.abs(a - b) / denom <= 0.05; // 5% tolerance
    };

    for (const a of answerNums) {
      const match = contextNums.some((c) => withinTolerance(a.value, c.value));
      if (!match) unmatched.push(a.raw);
      else matched.push(a.raw);
    }
    return { unmatched, matched };
  }

  extractNumericValues(text) {
    const regex = /(?:\$?\d[\d,]*\.?\d*\s?(?:b|bn|billion|m|mm|million)?|\d+\s?bps|\d+%)/gi;
    const matches = text.match(regex) || [];
    const parsed = [];

    matches.forEach((raw) => {
      const clean = raw.replace(/[,]/g, '').trim().toLowerCase();
      // percentages and bps are not critical for faithfulness check; skip them
      if (clean.endsWith('%') || clean.endsWith('bps')) {
        return;
      }
      let num = parseFloat(clean.replace(/[^0-9.]/g, ''));
      if (!Number.isFinite(num)) return;
      if (/\b(b|bn|billion)\b/.test(clean)) {
        num = num * 1000; // store in millions
      } else if (/\b(m|mm|million)\b/.test(clean)) {
        // already in millions
      }
      // If the value looks like an integer in millions already (e.g., 6819), keep as is
      parsed.push({ raw, value: num });
    });

    return parsed;
  }
}

