import { z } from 'zod';

export const FinancialMetricsOutputSchema = z.object({
  found: z.boolean(),
  ticker: z.string(),
  period: z.string(),
  metrics: z.record(z.string(), z.number()).optional(),
  missingMetrics: z.array(z.string()).optional(),
  source: z.string().optional()
});

export const MultiQuarterMetricsSchema = z.object({
  ticker: z.string(),
  periods: z.array(z.object({
    period: z.string(),
    metrics: z.record(z.string(), z.number()),
    missingMetrics: z.array(z.string())
  })),
  source: z.string().optional()
});

export const GrowthRateOutputSchema = z.object({
  success: z.boolean(),
  ticker: z.string().optional(),
  metric: z.string().optional(),
  basePeriod: z.object({
    period: z.string(),
    value: z.number()
  }).nullable().optional(),
  comparisonPeriod: z.object({
    period: z.string(),
    value: z.number()
  }).nullable().optional(),
  growthRate: z.string().nullable().optional(),
  growthRateNumeric: z.number().nullable().optional(),
  direction: z.enum(['increase', 'decrease', 'flat']).nullable().optional(),
  error: z.string().optional(),
  source: z.string().optional()
});

export const TranscriptSearchOutputSchema = z.object({
  ticker: z.string(),
  query: z.string(),
  filters: z.record(z.any()).optional(),
  results: z.array(z.object({
    score: z.number().nullable(),
    text: z.string().nullable(),
    fiscalYear: z.string().nullable().optional(),
    quarter: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    type: z.string().nullable().optional()
  })),
  source: z.string().optional()
});

export const ListAvailableOutputSchema = z.object({
  ticker: z.string().nullable(),
  financials: z.any(),
  source: z.string().optional()
});

const SCHEMAS = {
  get_financial_metrics: FinancialMetricsOutputSchema,
  get_multi_quarter_metrics: MultiQuarterMetricsSchema,
  compute_growth_rate: GrowthRateOutputSchema,
  search_earnings_transcript: TranscriptSearchOutputSchema,
  list_available_data: ListAvailableOutputSchema
};

export function validateToolOutput(toolName, output) {
  const schema = SCHEMAS[toolName];
  if (!schema) return { success: true, data: output };
  const result = schema.safeParse(output);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.errors };
}
