// src/app/api/chat/FinancialJSONRetriever.js
import fs from 'fs';
import path from 'path';

class FinancialJSONRetriever {
  constructor(baseDir) {
    // e.g. path.join(process.cwd(), 'data', 'financials')
    this.baseDir = baseDir;
  }

  /**
   * Retrieve JSON data for the given ticker and timeframe
   * @param {string} ticker e.g. "AAPL"
   * @param {object} timeframe e.g. { fiscalYear: "2024", quarter: "Q2" }
   * @returns {Array} an array of “match” objects, each with metadata.text
   */
  async retrieveFinancialData(ticker, timeframe = {}) {
    // If you only have data for AAPL, check or skip. Remove if you have more tickers.
    // if (ticker !== 'AAPL') return [];

    const fy = timeframe.fiscalYear || '2024';
    const q  = timeframe.quarter    || 'Q1';

    // Path: data/financials/AAPL/FY_2024/Q2/AAPL_FY_2024_Q2.json
    const fileDir = path.join(this.baseDir, ticker, `FY_${fy}`, q);
    const fileName = `${ticker}_FY_${fy}_${q}.json`;
    const filePath = path.join(fileDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`Financial data not found at: ${filePath}`);
      return [];
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    let jsonData;
    try {
      jsonData = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to parse JSON:', err);
      return [];
    }

    // Convert to text. If your JSON is huge, you might want a more concise summary.
    const text = this.jsonToText(jsonData);

    // Return in a shape consistent with Pinecone’s “matches”
    return [
      {
        metadata: {
          company: ticker,
          quarter: q,
          fiscalYear: fy,
          type: 'financial_data',
          text
        },
        score: 0  // local JSON has no “vector” score
      }
    ];
  }

  /**
   * Quick-and-dirty JSON -> text. For large data, consider a better summarization approach.
   */
  jsonToText(jsonObj) {
    // E.g. flatten the `financial_report` portion:
    if (jsonObj.financial_report) {
      return JSON.stringify(jsonObj.financial_report, null, 2);
    }
    // Or just flatten everything:
    return JSON.stringify(jsonObj, null, 2);
  }
}

export default FinancialJSONRetriever;
