import fs from 'fs';
import path from 'path';
import { financialDataCache } from '../../utils/financialDataCache.js';
import { FinancialDataProcessor } from '../../utils/financialDataProcessor.js';

const BASE_DIR = path.join(process.cwd(), 'data', 'financials');
const processor = new FinancialDataProcessor(BASE_DIR);

function normalizeQuarterName(q) {
  if (!q) return null;
  return q.startsWith('Q') ? q : `Q${q}`;
}

async function loadQuarter(ticker, fiscalYear, quarter) {
  const qName = normalizeQuarterName(quarter || 'Q1');
  const data = await financialDataCache.loadFromFile?.(ticker, fiscalYear, qName);
  if (data) return data;

  // Fallback to cache API to populate then return
  const [first] = await financialDataCache.getMultipleQuarters(ticker, fiscalYear, [qName]);
  return first || null;
}

export const financials = {
  async getQuarter(ticker, fiscalYear, quarter) {
    const data = await loadQuarter(ticker, fiscalYear, quarter);
    return data || null;
  },

  async getMultipleQuarters(ticker, periodsOrFiscalYear) {
    // Support legacy signature (ticker, fiscalYear)
    if (!Array.isArray(periodsOrFiscalYear)) {
      return financialDataCache.getMultipleQuarters(ticker, periodsOrFiscalYear);
    }

    const grouped = periodsOrFiscalYear.reduce((acc, { fiscalYear, quarter }) => {
      if (!fiscalYear || !quarter) return acc;
      const qName = normalizeQuarterName(quarter);
      acc[fiscalYear] = acc[fiscalYear] || [];
      acc[fiscalYear].push(qName);
      return acc;
    }, {});

    const results = [];
    for (const [fy, quarters] of Object.entries(grouped)) {
      const data = await financialDataCache.getMultipleQuarters(ticker, fy, quarters);
      results.push(...data);
    }
    return results;
  },

  async computeGrowth(ticker, metric, basePeriod, comparisonPeriod) {
    const base = await this.getQuarter(ticker, basePeriod.fiscalYear, basePeriod.quarter);
    const cmp = await this.getQuarter(ticker, comparisonPeriod.fiscalYear, comparisonPeriod.quarter);
    if (!base || !cmp) return null;

    const baseVal = base[metric];
    const cmpVal = cmp[metric];
    if (!baseVal || !cmpVal || baseVal === 0) return null;
    return ((cmpVal - baseVal) / baseVal) * 100;
  },

  async getTimeSeries(ticker, metric, periods) {
    if (Array.isArray(periods) && periods.length) {
      const values = [];
      for (const { fiscalYear, quarter } of periods) {
        const data = await this.getQuarter(ticker, fiscalYear, quarter);
        values.push({
          fiscalYear,
          quarter: normalizeQuarterName(quarter),
          value: data ? data[metric] ?? null : null,
        });
      }
      return values;
    }

    // Fallback to processor helper (latest quarters)
    const series = await processor.getTimeSeriesData(ticker, [metric], 6);
    return series.datasets?.[metric]?.map((v, idx) => ({
      label: series.labels[idx],
      value: v,
    })) || [];
  },

  listAvailable(ticker) {
    if (!ticker) {
      if (!fs.existsSync(BASE_DIR)) return [];
      return fs.readdirSync(BASE_DIR).filter((d) => fs.statSync(path.join(BASE_DIR, d)).isDirectory());
    }

    const tickerDir = path.join(BASE_DIR, ticker);
    if (!fs.existsSync(tickerDir)) return [];

    const fiscalYears = fs.readdirSync(tickerDir).filter((dir) => dir.startsWith('FY_'));
    return fiscalYears.map((fy) => {
      const fyPath = path.join(tickerDir, fy);
      const quarters = fs.readdirSync(fyPath).filter((q) => q.startsWith('Q'));
      return { fiscalYear: fy.replace('FY_', ''), quarters };
    });
  },
};
