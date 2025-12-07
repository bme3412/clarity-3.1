import { financials } from '../data/financials.js';
import { retriever } from '../rag/retriever.js';

function normalizeFY(fiscalYear) {
  if (!fiscalYear) return null;
  const digits = fiscalYear.replace(/[^0-9]/g, '');
  return digits || fiscalYear;
}

function normalizeQuarter(q) {
  if (!q) return null;
  return q.startsWith('Q') ? q : `Q${q}`;
}

async function executeGetFinancialMetrics(input) {
  const { ticker, fiscalYear, quarter, metrics } = input;
  if (!ticker || !fiscalYear || !quarter || !metrics?.length) {
    throw new Error('Missing required inputs for get_financial_metrics');
  }

  const fy = normalizeFY(fiscalYear);
  const q = normalizeQuarter(quarter);
  const data = await financials.getQuarter(ticker, fy, q);

  if (!data) {
    return {
      found: false,
      ticker,
      period: `${q} FY${fy}`,
      missingMetrics: metrics,
      source: 'financials.getQuarter'
    };
  }

  const out = {};
  const missing = [];
  metrics.forEach((m) => {
    if (m === 'revenue_segments') {
      if (data.revenueSegments) {
        out[m] = data.revenueSegments;
      } else {
        missing.push(m);
      }
    } else if (data[m] !== undefined && data[m] !== null) {
      out[m] = data[m];
    } else {
      missing.push(m);
    }
  });

  return {
    found: Object.keys(out).length > 0,
    ticker,
    period: `${q} FY${fy}`,
    metrics: out,
    missingMetrics: missing.length ? missing : undefined,
    source: 'financials.getQuarter'
  };
}

async function executeGetMultiQuarterMetrics(input) {
  const { ticker, periods, metrics } = input;
  if (!ticker || !periods?.length || !metrics?.length) {
    throw new Error('Missing required inputs for get_multi_quarter_metrics');
  }

  const normalized = periods.map((p) => ({
    fiscalYear: normalizeFY(p.fiscalYear),
    quarter: normalizeQuarter(p.quarter)
  }));

  const results = [];
  for (const p of normalized) {
    const data = await financials.getQuarter(ticker, p.fiscalYear, p.quarter);
    const entry = {
      period: `${p.quarter} FY${p.fiscalYear}`,
      metrics: {},
      missingMetrics: []
    };
    metrics.forEach((m) => {
      if (m === 'revenue_segments') {
        if (data?.revenueSegments) {
          entry.metrics[m] = data.revenueSegments;
        } else {
          entry.missingMetrics.push(m);
        }
      } else if (data && data[m] !== undefined && data[m] !== null) {
        entry.metrics[m] = data[m];
      } else {
        entry.missingMetrics.push(m);
      }
    });
    results.push(entry);
  }

  return {
    ticker,
    periods: results,
    source: 'financials.getQuarter'
  };
}

async function executeComputeGrowthRate(input) {
  const { ticker, metric, basePeriod, comparisonPeriod } = input;
  if (!ticker || !metric || !basePeriod || !comparisonPeriod) {
    throw new Error('Missing required inputs for compute_growth_rate');
  }

  const baseFy = normalizeFY(basePeriod.fiscalYear);
  const baseQ = normalizeQuarter(basePeriod.quarter);
  const cmpFy = normalizeFY(comparisonPeriod.fiscalYear);
  const cmpQ = normalizeQuarter(comparisonPeriod.quarter);

  const base = await financials.getQuarter(ticker, baseFy, baseQ);
  const cmp = await financials.getQuarter(ticker, cmpFy, cmpQ);

  if (!base || !cmp || base[metric] == null || cmp[metric] == null) {
    return {
      success: false,
      ticker,
      metric,
      basePeriod: base ? { period: `${baseQ} FY${baseFy}`, value: base[metric] ?? null } : null,
      comparisonPeriod: cmp ? { period: `${cmpQ} FY${cmpFy}`, value: cmp[metric] ?? null } : null,
      error: 'Missing data for growth computation',
      source: 'financials.getQuarter'
    };
  }

  const baseVal = base[metric];
  const cmpVal = cmp[metric];
  const growth = baseVal === 0 ? null : ((cmpVal - baseVal) / baseVal) * 100;
  const direction = growth == null
    ? 'flat'
    : growth > 0
      ? 'increase'
      : growth < 0
        ? 'decrease'
        : 'flat';

  return {
    success: growth != null,
    ticker,
    metric,
    basePeriod: { period: `${baseQ} FY${baseFy}`, value: baseVal },
    comparisonPeriod: { period: `${cmpQ} FY${cmpFy}`, value: cmpVal },
    growthRateNumeric: growth,
    growthRate: growth != null ? `${growth.toFixed(2)}%` : null,
    direction,
    source: 'financials.getQuarter'
  };
}

async function executeSearchTranscript(input) {
  const { ticker, query, fiscalYear, quarter, topK } = input;
  if (!ticker || !query) {
    throw new Error('Missing required inputs for search_earnings_transcript');
  }

  // Strategy/tech/market asks benefit from higher recall
  const intendedTopK = Number.isFinite(topK) ? Math.min(topK, 50) : 15;

  // Build a tolerant, AND-composed filter
  // Note: Pinecone metadata uses 'company_ticker' as the field name
  const tickerFilter = {
    $or: [
      { company_ticker: ticker },
      { ticker: ticker },
      { company: ticker }
    ]
  };

  // Current date is December 2025 - prefer recent data
  const currentYear = '2025';
  const previousYear = '2024';
  
  // If no fiscalYear specified, try 2025 first, then 2024, then all
  let results = null;
  let searchedYears = [];
  
  if (fiscalYear) {
    // User specified a year - use it
    const filterClauses = [tickerFilter, { fiscal_year: normalizeFY(fiscalYear) }];
    if (quarter) {
      filterClauses.push({ quarter: normalizeQuarter(quarter) });
    }
    results = await retriever.search({
      query,
      filters: { $and: filterClauses },
      topK: intendedTopK
    });
    searchedYears.push(fiscalYear);
  } else {
    // No year specified - try recent years first
    // Try 2025 first
    const filter2025 = quarter 
      ? { $and: [tickerFilter, { fiscal_year: currentYear }, { quarter: normalizeQuarter(quarter) }] }
      : { $and: [tickerFilter, { fiscal_year: currentYear }] };
    
    results = await retriever.search({
      query,
      filters: filter2025,
      topK: intendedTopK
    });
    searchedYears.push(currentYear);
    
    // If no 2025 results, try 2024
    if (!results?.matches?.length || results.matches.length < 3) {
      const filter2024 = quarter 
        ? { $and: [tickerFilter, { fiscal_year: previousYear }, { quarter: normalizeQuarter(quarter) }] }
        : { $and: [tickerFilter, { fiscal_year: previousYear }] };
      
      const results2024 = await retriever.search({
        query,
        filters: filter2024,
        topK: intendedTopK
      });
      searchedYears.push(previousYear);
      
      // Merge results, keeping 2025 first
      if (results2024?.matches?.length) {
        const existingIds = new Set((results?.matches || []).map(m => m.id));
        const newMatches = results2024.matches.filter(m => !existingIds.has(m.id));
        results = {
          ...results,
          matches: [...(results?.matches || []), ...newMatches].slice(0, intendedTopK)
        };
      }
    }
    
    // Final fallback: no year filter
    if (!results?.matches?.length) {
      results = await retriever.search({
        query,
        filters: tickerFilter,
        topK: intendedTopK
      });
      searchedYears.push('all');
    }
  }

  return {
    ticker,
    query,
    searchedYears,
    results: results?.matches?.map((m) => ({
      score: m.score,
      text: m.metadata?.text,
      fiscalYear: m.metadata?.fiscalYear || m.metadata?.fiscal_year,
      quarter: m.metadata?.quarter,
      source: m.metadata?.source || m.metadata?.source_file,
      type: m.metadata?.type
    })) || [],
    hadFallback: searchedYears.includes('all'),
    source: 'retriever.search'
  };
}

async function executeListAvailableData(input) {
  const { ticker } = input || {};
  const listing = financials.listAvailable(ticker || undefined);
  return {
    ticker: ticker || null,
    financials: listing,
    source: 'financials.listAvailable'
  };
}

/**
 * Execute a tool call and return structured result.
 * @param {string} toolName
 * @param {object} toolInput
 * @returns {Promise<{success: boolean, result?: any, error?: string, latencyMs: number}>}
 */
export async function executeToolCall(toolName, toolInput) {
  const startTime = Date.now();
  try {
    let result;
    switch (toolName) {
      case 'get_financial_metrics':
        result = await executeGetFinancialMetrics(toolInput);
        break;
      case 'get_multi_quarter_metrics':
        result = await executeGetMultiQuarterMetrics(toolInput);
        break;
      case 'compute_growth_rate':
        result = await executeComputeGrowthRate(toolInput);
        break;
      case 'search_earnings_transcript':
        result = await executeSearchTranscript(toolInput);
        break;
      case 'list_available_data':
        result = await executeListAvailableData(toolInput);
        break;
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
    return { success: true, result, latencyMs: Date.now() - startTime };
  } catch (error) {
    return { success: false, error: error.message, latencyMs: Date.now() - startTime };
  }
}
