// RAG System Configuration

/**
 * Maps company names and variations to their standard ticker symbol.
 */
export const COMPANY_NAME_MAP = {
  'Facebook, Inc. (now Meta Platforms, Inc.)': 'Meta',
  'Meta Platforms, Inc.': 'Meta',
  'Facebook': 'Meta',
  'NVIDIA Corp.': 'NVDA',
  'Microsoft Corporation': 'MSFT',
  'Oracle Corporation': 'ORCL',
  'Amazon.com, Inc.': 'AMZN',
  'Apple Inc.': 'AAPL',
  'Advanced Micro Devices, Inc.': 'AMD',
  'Alphabet Inc.': 'GOOGL',
  'Salesforce, Inc.': 'CRM',
  'Broadcom Inc.': 'AVGO',
};

/**
 * Maps common company aliases to their ticker symbol.
 * Used for query intent analysis.
 */
export const COMPANY_ALIASES = {
  apple: 'AAPL',
  aapl: 'AAPL',
  meta: 'META',
  facebook: 'META',
  fb: 'META',
  nvidia: 'NVDA',
  nvda: 'NVDA',
  google: 'GOOGL',
  googl: 'GOOGL',
  goog: 'GOOGL',
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
  orcl: 'ORCL',
};

/**
 * Configuration for embedding generation.
 */
export const EMBEDDING_CONFIG = {
  model: 'voyage-3.5',
  batchSize: 10,
  chunkSize: 1500,
  overlap: 200,
  rateLimitDelay: 100, // 100ms - increase if you hit rate limits
};

/**
 * List of companies to target for initial ingestion/testing.
 */
export const TARGET_COMPANIES = [
  'AAPL',
  'AMD',
  'AMZN',
  'AVGO',
  'CRM',
  'GOOGL',
  'META',
  'MSFT',
  'NVDA',
  'ORCL',
];

