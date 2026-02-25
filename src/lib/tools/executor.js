import { financials } from '../data/financials.js';
import { retriever } from '../rag/retriever.js';
import { KeywordTranscriptRetriever } from '../rag/components.js';
import path from 'path';

const COMPANY_NAME_BY_TICKER = {
  NVDA: 'NVIDIA',
  AAPL: 'Apple',
  AMD: 'Advanced Micro Devices',
  AMZN: 'Amazon',
  MSFT: 'Microsoft',
  META: 'Meta',
  GOOGL: 'Alphabet',
  AVGO: 'Broadcom',
  CRM: 'Salesforce',
  ORCL: 'Oracle'
};

// Local transcript fallback (keyword-based) to avoid zero results when Pinecone misses
const keywordTranscriptRetriever = new KeywordTranscriptRetriever(
  path.join(process.cwd(), 'data', 'transcripts')
);

function formatNumber(val) {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  if (Math.abs(num) >= 1000) {
    return `$${(num / 1000).toFixed(1)}B`;
  }
  return `$${num.toFixed(1)}M`;
}

function summarizeMetrics(period, metrics = {}) {
  const parts = [];
  if (metrics.revenue !== undefined && metrics.revenue !== null && Number.isFinite(Number(metrics.revenue))) {
    parts.push(`Revenue ${formatNumber(metrics.revenue)}`);
  }
  if (metrics.operating_income !== undefined && metrics.operating_income !== null && Number.isFinite(Number(metrics.operating_income))) {
    parts.push(`OpInc ${formatNumber(metrics.operating_income)}`);
  }
  if (metrics.net_income !== undefined && metrics.net_income !== null && Number.isFinite(Number(metrics.net_income))) {
    parts.push(`NetInc ${formatNumber(metrics.net_income)}`);
  }
  if (metrics.revenue_segments && typeof metrics.revenue_segments === 'object') {
    const dc = metrics.revenue_segments.data_center ?? metrics.revenue_segments.dataCenter ?? null;
    if (Number.isFinite(Number(dc))) {
      parts.push(`Data Center ${formatNumber(dc)}`);
    }
  }
  return parts.length ? `${period}: ${parts.join(' | ')}` : `${period}: no numeric metrics`;
}

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
  if (!ticker || !metrics?.length) {
    throw new Error('Missing required inputs for get_financial_metrics');
  }

  // Handle "latest" or missing period - auto-detect most recent
  let fy = normalizeFY(fiscalYear);
  let q = normalizeQuarter(quarter);
  
  if (!fy || !q || fiscalYear?.toLowerCase() === 'latest' || fiscalYear?.toLowerCase() === 'most recent') {
    const mostRecent = financials.getMostRecentQuarter(ticker);
    if (mostRecent) {
      fy = mostRecent.fiscalYear;
      q = mostRecent.quarter;
    } else {
      return {
        found: false,
        ticker,
        error: 'No financial data available for this ticker',
        source: 'financials.getMostRecentQuarter'
      };
    }
  }
  
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
    summary: summarizeMetrics(`${q} FY${fy}`, out),
    missingMetrics: missing.length ? missing : undefined,
    source: 'financials.getQuarter'
  };
}

async function executeGetMultiQuarterMetrics(input) {
  let { ticker, periods, metrics } = input;
  if (!ticker || !metrics?.length) {
    throw new Error('Missing required inputs for get_multi_quarter_metrics');
  }

  // Handle "latest" or missing periods - auto-detect most recent quarters
  if (!periods?.length || (periods.length === 1 && periods[0]?.fiscalYear?.toLowerCase() === 'latest')) {
    const recentQuarters = financials.getMostRecentQuarters(ticker, 4);
    if (recentQuarters.length === 0) {
      return {
        ticker,
        periods: [],
        error: 'No financial data available for this ticker',
        source: 'financials.getMostRecentQuarters'
      };
    }
    periods = recentQuarters;
  }

  const normalized = periods.map((p) => ({
    fiscalYear: normalizeFY(p.fiscalYear),
    quarter: normalizeQuarter(p.quarter)
  }));

  // Fetch all quarters in parallel — they are independent reads
  const dataList = await Promise.all(
    normalized.map((p) => financials.getQuarter(ticker, p.fiscalYear, p.quarter))
  );

  const results = normalized.map((p, i) => {
    const data = dataList[i];
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
    return entry;
  });

  return {
    ticker,
    periods: results,
    summaries: results.map((r) => summarizeMetrics(r.period, r.metrics)),
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

  const [base, cmp] = await Promise.all([
    financials.getQuarter(ticker, baseFy, baseQ),
    financials.getQuarter(ticker, cmpFy, cmpQ)
  ]);

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
  const intendedTopK = Number.isFinite(topK) ? Math.min(topK, 50) : 20;

  // Build a tolerant, AND-composed filter
  // Note: Pinecone metadata uses 'company_ticker' as the field name
  const companyName = COMPANY_NAME_BY_TICKER[ticker] || ticker;
  const tickerFilter = {
    $or: [
      { company_ticker: ticker },
      { ticker: ticker },
      { company: ticker },
      { company_name: companyName }
    ]
  };

  // Derive candidate fiscal years (prefer most recent available for this ticker)
  const available = financials.listAvailable(ticker) || [];
  const sortedYears = available
    .map((y) => y.fiscalYear)
    .filter(Boolean)
    .sort((a, b) => parseInt(b) - parseInt(a));

  const yearsToTry = [];
  if (fiscalYear) {
    yearsToTry.push(normalizeFY(fiscalYear));
  } else if (sortedYears.length) {
    yearsToTry.push(sortedYears[0]); // most recent
    if (sortedYears[1]) yearsToTry.push(sortedYears[1]); // previous
  }
  // Always include a no-year fallback
  yearsToTry.push(null);

  let results = null;
  const searchedYears = [];

  for (const yr of yearsToTry) {
    const clauses = [tickerFilter];
    if (yr) clauses.push({ fiscal_year: yr });
    if (quarter) clauses.push({ quarter: normalizeQuarter(quarter) });
    const filters = clauses.length === 1 ? clauses[0] : { $and: clauses };

    const res = await retriever.search({
      query,
      filters,
      topK: intendedTopK
    });

    if (yr) searchedYears.push(yr); else searchedYears.push('all');

    if (res?.matches?.length) {
      results = res;
      break;
    }
  }

  // Fallback: no-filter search if still empty
  if (!results?.matches?.length) {
    const res = await retriever.search({
      query,
      topK: intendedTopK
    });
    searchedYears.push('all');
    if (res?.matches?.length) {
      results = res;
    }
  }

  // Fallback: local keyword retriever if Pinecone returns nothing
  let keywordMatches = [];
  if (!results?.matches?.length) {
    keywordMatches = await keywordTranscriptRetriever.retrieveByKeywords(ticker, query, {
      timeframe: fiscalYear ? `FY ${fiscalYear}` : ''
    });
  }

  return {
    ticker,
    query,
    searchedYears,
    results:
      results?.matches?.map((m) => ({
        score: m.score,
        text: m.metadata?.text,
        fiscalYear: m.metadata?.fiscalYear || m.metadata?.fiscal_year,
        quarter: m.metadata?.quarter,
        source: m.metadata?.source || m.metadata?.source_file,
        type: m.metadata?.type
      })) ||
      keywordMatches.map((m) => ({
        score: m.score,
        text: m.metadata?.text,
        fiscalYear: m.metadata?.fiscalYear,
        quarter: m.metadata?.quarter,
        source: m.metadata?.source,
        type: m.metadata?.type
      })),
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
