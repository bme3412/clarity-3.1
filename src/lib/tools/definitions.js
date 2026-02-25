// Claude tool definitions for financial + transcript access.
// Design principles:
// 1) Each tool does ONE thing.
// 2) Descriptions state when to use and when NOT to use.
// 3) Schemas are strict and enum-heavy to keep Claude aligned.

const TICKER_ENUM = [
  'AAPL', 'AMD', 'AMZN', 'AVGO', 'CRM',
  'GOOGL', 'META', 'MSFT', 'NVDA', 'ORCL'
];

export const FINANCIAL_TOOLS = [
  {
    name: 'get_financial_metrics',
    description: `Retrieve exact financial metrics for a single fiscal quarter from structured JSON.

USE FOR:
- Any question asking for specific numbers (revenue, EPS, margins, profit, cash flow) for one quarter.

DO NOT USE FOR:
- Qualitative/strategy/guidance commentary (use search_earnings_transcript).
- Multi-quarter trends (use get_multi_quarter_metrics).

Returns only verified values from financial statements. Never estimate.`,
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', enum: TICKER_ENUM, description: 'Stock ticker symbol' },
        fiscalYear: { type: 'string', description: 'Fiscal year (e.g., "2025") or "latest" to auto-detect most recent. Use "latest" for current/recent data since companies have different fiscal calendars (NVDA is on FY2026, others on FY2025).' },
        quarter: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4'], description: 'Fiscal quarter. Optional if fiscalYear is "latest".' },
        metrics: {
          type: 'array',
          description: 'Metrics to retrieve; choose only what is asked',
          items: {
            type: 'string',
            enum: [
              'revenue', 'gross_profit', 'operating_income', 'net_income',
              'eps', 'eps_diluted', 'gross_margin', 'operating_margin',
              'net_margin', 'free_cash_flow', 'operating_cash_flow',
              'revenue_segments'
            ]
          }
        }
      },
      required: ['ticker', 'metrics']
    }
  },
  {
    name: 'get_multi_quarter_metrics',
    description: `Retrieve metrics across multiple quarters for trend/comparison analysis.

USE FOR:
- Trend or comparison questions (e.g., "last 4 quarters", "Q1-Q4 FY25").

DO NOT USE FOR:
- Single-quarter asks (use get_financial_metrics).
- Qualitative commentary (use search_earnings_transcript).
`,
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', enum: TICKER_ENUM },
        periods: {
          type: 'array',
          description: 'List of {fiscalYear, quarter} objects. Use [{fiscalYear: "latest"}] to auto-detect the 4 most recent quarters for this ticker.',
          items: {
            type: 'object',
            properties: {
              fiscalYear: { type: 'string', description: 'Fiscal year (e.g., "2025") or "latest" to auto-detect. Different companies have different fiscal calendars!' },
              quarter: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4'] }
            },
            required: ['fiscalYear']
          }
        },
        metrics: {
          type: 'array',
          description: 'Metrics to retrieve for each period',
          items: {
            type: 'string',
            enum: [
              'revenue', 'gross_profit', 'operating_income', 'net_income',
              'eps', 'eps_diluted', 'gross_margin', 'operating_margin',
              'net_margin', 'free_cash_flow', 'operating_cash_flow',
              'revenue_segments'
            ]
          }
        }
      },
      required: ['ticker', 'periods', 'metrics']
    }
  },
  {
    name: 'compute_growth_rate',
    description: `Compute growth between two periods (YoY, QoQ) for a specific metric.

USE FOR:
- "YoY growth", "QoQ change", "delta vs prior year/quarter" questions.

DO NOT USE FOR:
- Raw metric retrieval (use get_financial_metrics / get_multi_quarter_metrics first if needed).`,
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', enum: TICKER_ENUM },
        metric: {
          type: 'string',
          enum: [
            'revenue', 'gross_profit', 'operating_income', 'net_income',
            'eps', 'eps_diluted', 'gross_margin', 'operating_margin',
            'net_margin', 'free_cash_flow', 'operating_cash_flow'
          ],
          description: 'Metric to compare'
        },
        basePeriod: {
          type: 'object',
          properties: {
            fiscalYear: { type: 'string' },
            quarter: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4'] }
          },
          required: ['fiscalYear', 'quarter']
        },
        comparisonPeriod: {
          type: 'object',
          properties: {
            fiscalYear: { type: 'string' },
            quarter: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4'] }
          },
          required: ['fiscalYear', 'quarter']
        }
      },
      required: ['ticker', 'metric', 'basePeriod', 'comparisonPeriod']
    }
  },
  {
    name: 'search_earnings_transcript',
    description: `Semantic search over earnings call transcripts (prepared remarks + Q&A).

USE FOR:
- Qualitative asks: management commentary, AI plans, guidance, risks, strategy.

DO NOT USE FOR:
- Numeric metrics (use financial tools instead).
`,
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', enum: TICKER_ENUM },
        query: { type: 'string', description: 'What to search for (e.g., "AI demand", "data center")' },
        fiscalYear: { type: 'string', description: 'Optional fiscal year filter', nullable: true },
        quarter: { type: 'string', enum: ['Q1', 'Q2', 'Q3', 'Q4'], description: 'Optional fiscal quarter filter', nullable: true },
        topK: { type: 'integer', minimum: 1, maximum: 20, description: 'Max results to return (default: 10, use higher for comprehensive analysis)', nullable: true }
      },
      required: ['ticker', 'query']
    }
  },
  {
    name: 'list_available_data',
    description: `List available financial data and transcript coverage for a ticker (or all tickers).

USE FOR:
- Edge cases where data may not exist.
- Before answering out-of-scope tickers (e.g., Tesla).
`,
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', enum: TICKER_ENUM, nullable: true, description: 'Optional ticker; if omitted, list all' }
      }
    }
  }
];
