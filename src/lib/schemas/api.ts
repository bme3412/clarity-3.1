// =============================================================================
// API Request/Response Schemas
// =============================================================================
// Zod schemas for validating API inputs and outputs.
// Provides type safety at runtime and clear error messages.
// =============================================================================

import { z } from 'zod';

// =============================================================================
// CONSTANTS
// =============================================================================

export const SUPPORTED_TICKERS = [
  'AAPL', 'AMD', 'AMZN', 'AVGO', 'CRM', 
  'GOOGL', 'META', 'MSFT', 'NVDA', 'ORCL'
] as const;

export const RETRIEVAL_STRATEGIES = [
  'auto', 'dense-only', 'hybrid-bm25', 'hyde', 'multi-query'
] as const;

export const FINANCIAL_METRICS = [
  'revenue', 'gross_profit', 'operating_income', 'net_income',
  'eps', 'eps_diluted', 'gross_margin', 'operating_margin',
  'net_margin', 'free_cash_flow', 'operating_cash_flow', 'revenue_segments'
] as const;

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

// Type exports
export type SupportedTicker = typeof SUPPORTED_TICKERS[number];
export type RetrievalStrategy = typeof RETRIEVAL_STRATEGIES[number];
export type FinancialMetric = typeof FINANCIAL_METRICS[number];
export type Quarter = typeof QUARTERS[number];

// =============================================================================
// CHAT API SCHEMAS
// =============================================================================

/**
 * Schema for chat message in history
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Schema for /api/chat/financial POST request
 */
export const FinancialChatRequestSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(2000, 'Query too long (max 2000 characters)')
    .transform(s => s.trim()),
  strategy: z
    .enum(RETRIEVAL_STRATEGIES)
    .default('auto'),
  chatHistory: z
    .array(ChatMessageSchema)
    .optional()
    .default([])
});

export type FinancialChatRequest = z.infer<typeof FinancialChatRequestSchema>;

/**
 * Schema for /api/chat/stream POST request
 */
export const StreamChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long (max 2000 characters)')
    .transform(s => s.trim()),
  chatHistory: z
    .array(ChatMessageSchema)
    .optional()
    .default([])
});

export type StreamChatRequest = z.infer<typeof StreamChatRequestSchema>;

/**
 * Schema for citation in response metadata
 */
export const CitationSchema = z.object({
  index: z.number().int().positive(),
  source: z.string(),
  text: z.string(),
  fiscalYear: z.string().optional(),
  quarter: z.string().optional(),
  score: z.string().optional()
});

export type Citation = z.infer<typeof CitationSchema>;

/**
 * Schema for pipeline step
 */
export const PipelineStepSchema = z.object({
  name: z.string(),
  status: z.enum(['active', 'complete', 'error']),
  latency: z.number().nullable(),
  details: z.string().optional()
});

export type PipelineStep = z.infer<typeof PipelineStepSchema>;

/**
 * Schema for pipeline metrics
 */
export const PipelineMetricsSchema = z.object({
  strategy: z.string(),
  autoSelected: z.boolean(),
  steps: z.array(PipelineStepSchema),
  totalLatency: z.number(),
  retrieval: z.object({
    sourcesFound: z.number(),
    topScore: z.number()
  })
});

export type PipelineMetrics = z.infer<typeof PipelineMetricsSchema>;

// =============================================================================
// TOOL INPUT SCHEMAS
// =============================================================================

/**
 * Fiscal year validation - accepts "2024", "FY24", "FY2024"
 */
export const FiscalYearSchema = z
  .string()
  .regex(/^(20\d{2}|FY\d{2,4})$/, 'Invalid fiscal year format')
  .transform(s => {
    // Normalize to 4-digit year
    const digits = s.replace(/[^0-9]/g, '');
    if (digits.length === 2) {
      return `20${digits}`;
    }
    return digits;
  });

export type FiscalYear = z.infer<typeof FiscalYearSchema>;

/**
 * Quarter validation
 */
export const QuarterSchema = z
  .enum(QUARTERS)
  .or(z.string().regex(/^[1-4]$/).transform(s => `Q${s}` as Quarter));

/**
 * Ticker validation
 */
export const TickerSchema = z
  .string()
  .toUpperCase()
  .refine(
    (val): val is SupportedTicker => SUPPORTED_TICKERS.includes(val as SupportedTicker),
    (val) => ({ message: `Unsupported ticker: ${val}. Supported: ${SUPPORTED_TICKERS.join(', ')}` })
  );

/**
 * Schema for get_financial_metrics tool input
 */
export const GetFinancialMetricsInputSchema = z.object({
  ticker: TickerSchema,
  fiscalYear: FiscalYearSchema,
  quarter: QuarterSchema,
  metrics: z
    .array(z.enum(FINANCIAL_METRICS))
    .min(1, 'At least one metric required')
});

export type GetFinancialMetricsInput = z.infer<typeof GetFinancialMetricsInputSchema>;

/**
 * Schema for get_multi_quarter_metrics tool input
 */
export const GetMultiQuarterMetricsInputSchema = z.object({
  ticker: TickerSchema,
  periods: z
    .array(z.object({
      fiscalYear: FiscalYearSchema,
      quarter: QuarterSchema
    }))
    .min(1, 'At least one period required')
    .max(12, 'Maximum 12 periods'),
  metrics: z
    .array(z.enum(FINANCIAL_METRICS))
    .min(1, 'At least one metric required')
});

export type GetMultiQuarterMetricsInput = z.infer<typeof GetMultiQuarterMetricsInputSchema>;

/**
 * Schema for compute_growth_rate tool input
 */
export const ComputeGrowthRateInputSchema = z.object({
  ticker: TickerSchema,
  metric: z.enum(FINANCIAL_METRICS),
  basePeriod: z.object({
    fiscalYear: FiscalYearSchema,
    quarter: QuarterSchema
  }),
  comparisonPeriod: z.object({
    fiscalYear: FiscalYearSchema,
    quarter: QuarterSchema
  })
});

export type ComputeGrowthRateInput = z.infer<typeof ComputeGrowthRateInputSchema>;

/**
 * Schema for search_earnings_transcript tool input
 */
export const SearchTranscriptInputSchema = z.object({
  ticker: TickerSchema,
  query: z
    .string()
    .min(3, 'Search query too short')
    .max(500, 'Search query too long'),
  fiscalYear: FiscalYearSchema.optional().nullable(),
  quarter: QuarterSchema.optional().nullable(),
  topK: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(10)
});

export type SearchTranscriptInput = z.infer<typeof SearchTranscriptInputSchema>;

/**
 * Schema for list_available_data tool input
 */
export const ListAvailableDataInputSchema = z.object({
  ticker: TickerSchema.optional().nullable()
});

export type ListAvailableDataInput = z.infer<typeof ListAvailableDataInputSchema>;

// =============================================================================
// REPORTS API SCHEMAS
// =============================================================================

/**
 * Schema for /api/reports/earnings-digest POST request
 */
export const EarningsDigestRequestSchema = z.object({
  ticker: TickerSchema,
  fiscalYear: FiscalYearSchema,
  quarter: QuarterSchema
});

export type EarningsDigestRequest = z.infer<typeof EarningsDigestRequestSchema>;

/**
 * Schema for /api/reports/transcript GET request params
 */
export const TranscriptRequestSchema = z.object({
  ticker: TickerSchema,
  fiscalYear: FiscalYearSchema,
  quarter: QuarterSchema
});

export type TranscriptRequest = z.infer<typeof TranscriptRequestSchema>;

// =============================================================================
// EVALUATION SCHEMAS
// =============================================================================

/**
 * Schema for evaluation test case
 */
export const EvalTestCaseSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  ground_truth: z.string().min(1),
  category: z.enum(['financial', 'strategy', 'comparison', 'market', 'executive', 'guidance']),
  expected_context_ids: z.array(z.string()).optional().default([])
});

export type EvalTestCase = z.infer<typeof EvalTestCaseSchema>;

/**
 * Schema for evaluation dataset
 */
export const EvalDatasetSchema = z.array(EvalTestCaseSchema);

export type EvalDataset = z.infer<typeof EvalDatasetSchema>;

/**
 * Schema for evaluation metric result
 */
export const EvalMetricResultSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string()
});

export type EvalMetricResult = z.infer<typeof EvalMetricResultSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  error: string;
  issues: Array<{
    path: string;
    message: string;
  }>;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Validates request body and returns parsed data or error response
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: 'Validation failed',
    issues: result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message
    }))
  };
}

export interface FormattedValidationError {
  error: string;
  issues: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Creates a validation error response for Next.js API routes
 * @param zodError - Zod error object
 */
export function formatValidationError(zodError: z.ZodError): FormattedValidationError {
  return {
    error: 'Validation failed',
    issues: zodError.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }))
  };
}

