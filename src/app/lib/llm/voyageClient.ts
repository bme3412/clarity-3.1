// =============================================================================
// Voyage AI Embeddings Client
// =============================================================================
// Enterprise-grade client for Voyage AI embedding generation.
// Includes retry logic, timeouts, and circuit breaker protection.
// =============================================================================

import { 
  withRetryAndTimeout, 
  voyageCircuitBreaker,
  type CircuitBreakerState
} from '../../../lib/utils/resilience';

// =============================================================================
// TYPES
// =============================================================================

export interface VoyageEmbeddingOptions {
  model?: string;
  inputType?: 'query' | 'document';
  outputDimension?: number;
  outputDtype?: string;
}

export interface VoyageHealthStatus {
  apiKeyConfigured: boolean;
  circuitBreaker: CircuitBreakerState;
  model: string;
  dimensions: number;
}

interface VoyageResponse {
  data: Array<{ embedding: number[] }>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings';

const CONFIG = {
  defaultModel: 'voyage-3.5',
  dimensions: 1024,
  timeoutMs: 15000,
  maxRetries: 3,
  rateLimitDelayMs: 1000
} as const;

// Validate API key at startup
if (!API_KEY) {
  console.error('[VoyageClient] VOYAGE_API_KEY is not set. Embedding calls will fail.');
}

// =============================================================================
// INTERNAL FUNCTIONS
// =============================================================================

/**
 * Makes a request to the Voyage embeddings API
 */
async function requestEmbeddings(
  texts: string[], 
  options: VoyageEmbeddingOptions = {}
): Promise<number[][]> {
  const { 
    model = CONFIG.defaultModel, 
    inputType = 'document', 
    outputDimension, 
    outputDtype 
  } = options;

  if (!API_KEY) {
    throw new Error('VOYAGE_API_KEY is required to generate embeddings.');
  }

  const payload: Record<string, unknown> = {
    input: texts,
    model,
    input_type: inputType,
  };

  if (outputDimension) {
    payload.output_dimension = outputDimension;
  }

  if (outputDtype) {
    payload.output_dtype = outputDtype;
  }

  const response = await fetch(VOYAGE_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Voyage embedding failed (${response.status}): ${body}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  const data: VoyageResponse = await response.json();
  return (data.data || []).map((item) => item.embedding);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generates an embedding for a single text string
 * 
 * @param text - Text to embed
 * @param options - Embedding options
 * @returns Embedding vector (1024 dimensions for voyage-3.5)
 * 
 * @example
 * const embedding = await embedText('What is Apple revenue?', { inputType: 'query' });
 */
export async function embedText(
  text: string, 
  options: VoyageEmbeddingOptions = {}
): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return [];
  }

  // Use circuit breaker + retry + timeout for resilience
  return voyageCircuitBreaker.execute(async () => {
    const embeddings = await withRetryAndTimeout(
      () => requestEmbeddings([trimmedText], options),
      {
        timeoutMs: CONFIG.timeoutMs,
        maxAttempts: CONFIG.maxRetries,
        operationName: 'Voyage embedding'
      }
    );
    
    return embeddings[0] || [];
  });
}

/**
 * Generates embeddings for multiple texts in a batch
 * 
 * @param texts - Array of texts to embed
 * @param options - Embedding options
 * @returns Array of embedding vectors
 * 
 * @example
 * const embeddings = await embedTexts(['Text 1', 'Text 2'], { inputType: 'document' });
 */
export async function embedTexts(
  texts: string[], 
  options: VoyageEmbeddingOptions = {}
): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  // Filter and validate texts
  const validTexts = texts
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (validTexts.length === 0) {
    return [];
  }

  // Use circuit breaker + retry + timeout for resilience
  return voyageCircuitBreaker.execute(async () => {
    return withRetryAndTimeout(
      () => requestEmbeddings(validTexts, options),
      {
        timeoutMs: CONFIG.timeoutMs * 2, // Longer timeout for batches
        maxAttempts: CONFIG.maxRetries,
        operationName: 'Voyage batch embedding'
      }
    );
  });
}

/**
 * Gets the current health status of the Voyage client
 */
export function getVoyageHealth(): VoyageHealthStatus {
  return {
    apiKeyConfigured: !!API_KEY,
    circuitBreaker: voyageCircuitBreaker.getState(),
    model: CONFIG.defaultModel,
    dimensions: CONFIG.dimensions
  };
}

