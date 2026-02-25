// =============================================================================
// Anthropic Claude Client
// =============================================================================
// Enterprise-grade client for Anthropic Claude API.
// Uses claude-opus-4-5-20251101 as the primary model.
// Includes retry logic, timeouts, and circuit breaker protection.
// =============================================================================

import { TextDecoder } from 'util';
import { 
  withRetry, 
  withTimeout,
  anthropicCircuitBreaker,
  type CircuitBreakerState
} from '../../../lib/utils/resilience';

// =============================================================================
// TYPES
// =============================================================================

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicCompletionOptions {
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  messages?: AnthropicMessage[];
  temperature?: number;
  maxTokens?: number;
  onUsage?: (usage: AnthropicUsage) => void;
}

export interface AnthropicStreamOptions {
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  messages?: AnthropicMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AnthropicHealthStatus {
  apiKeyConfigured: boolean;
  circuitBreaker: CircuitBreakerState;
  defaultModel: string;
  apiVersion: string;
}

interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  usage?: AnthropicUsage;
}

interface StreamEvent {
  type: string;
  delta?: {
    type: string;
    text?: string;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const API_VERSION = process.env.ANTHROPIC_API_VERSION || '2023-06-01';

/**
 * Configuration for Anthropic API calls
 * Primary model: claude-opus-4-5-20251101 (latest Opus)
 */
const CONFIG = {
  defaultModel: 'claude-opus-4-5-20251101',
  fallbackModel: 'claude-sonnet-4-20250514',
  timeoutMs: 60000,
  streamTimeoutMs: 120000,
  maxRetries: 3,
  baseDelayMs: 1500
} as const;

// Validate API key at startup (warn, don't throw)
if (!API_KEY) {
  console.error('[AnthropicClient] ANTHROPIC_API_KEY is not set. API calls will fail.');
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Custom error class for Anthropic API errors
 */
export class AnthropicError extends Error {
  readonly statusCode: number;
  readonly isRetryable: boolean;

  constructor(message: string, statusCode: number, isRetryable = false) {
    super(message);
    this.name = 'AnthropicError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

// =============================================================================
// INTERNAL FUNCTIONS
// =============================================================================

/**
 * Makes a request to the Anthropic API
 */
async function callAnthropic(payload: Record<string, unknown>): Promise<Response> {
  if (!API_KEY) {
    throw new AnthropicError('ANTHROPIC_API_KEY is required', 401, false);
  }

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    const status = response.status;
    const isRetryable = status === 429 || status >= 500;
    throw new AnthropicError(
      `Claude request failed (${status}): ${text}`,
      status,
      isRetryable
    );
  }

  return response;
}

/**
 * Determines if an Anthropic error should trigger a retry
 */
function shouldRetryAnthropicError(error: Error): boolean {
  if (error instanceof AnthropicError) {
    return error.isRetryable;
  }
  // Network errors are retryable
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return true;
  }
  return false;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Non-streaming completion with Claude
 * Uses claude-opus-4-5-20251101 by default
 * 
 * @param options - Completion options
 * @returns Generated text
 * 
 * @example
 * const response = await anthropicCompletion({
 *   systemPrompt: 'You are a financial analyst.',
 *   userPrompt: 'What was Apple revenue in Q3 2024?',
 *   temperature: 0.3
 * });
 */
export async function anthropicCompletion({
  model = CONFIG.defaultModel,
  systemPrompt = '',
  userPrompt = '',
  messages = [],
  temperature = 0.7,
  maxTokens = 800,
  onUsage,
}: AnthropicCompletionOptions): Promise<string> {
  let finalMessages: AnthropicMessage[] = messages;
  if (!finalMessages.length && userPrompt) {
    finalMessages = [{ role: 'user', content: userPrompt }];
  }

  if (!finalMessages.length) {
    throw new AnthropicError('No messages provided', 400, false);
  }

  const payload = {
    model,
    system: systemPrompt,
    messages: finalMessages,
    temperature,
    max_tokens: maxTokens,
  };

  // Use circuit breaker + retry + timeout for resilience
  const response = await anthropicCircuitBreaker.execute(async () => {
    return withRetry(
      () => withTimeout(
        () => callAnthropic(payload),
        CONFIG.timeoutMs,
        'Anthropic completion'
      ),
      {
        maxAttempts: CONFIG.maxRetries,
        baseDelayMs: CONFIG.baseDelayMs,
        shouldRetry: shouldRetryAnthropicError,
        onRetry: ({ attempt, maxAttempts, delay, error }) => {
          console.warn(
            `[AnthropicClient] Attempt ${attempt}/${maxAttempts} failed: ${error.message}. ` +
            `Retrying in ${Math.round(delay)}ms...`
          );
        }
      }
    );
  });

  const data: AnthropicResponse = await response.json();
  
  // Report usage metrics if callback provided
  if (onUsage && data?.usage) {
    try {
      onUsage(data.usage);
    } catch (err) {
      console.error('[AnthropicClient] Failed to capture usage metrics:', err instanceof Error ? err.message : err);
    }
  }
  
  // Extract text content from response
  if (data.content && Array.isArray(data.content)) {
    return data.content.reduce((acc, block) => {
      if (block.type === 'text') return acc + block.text;
      return acc;
    }, '');
  }
  
  return '';
}

/**
 * Streaming completion with Claude
 * Uses claude-opus-4-5-20251101 by default
 * 
 * @param options - Completion options (same as anthropicCompletion)
 * @yields Text chunks as they are generated
 * 
 * @example
 * for await (const chunk of anthropicStream({ userPrompt: 'Tell me about Apple' })) {
 *   process.stdout.write(chunk);
 * }
 */
export async function* anthropicStream({
  model = CONFIG.defaultModel,
  systemPrompt = '',
  userPrompt = '',
  messages = [],
  temperature = 0.7,
  maxTokens = 800,
}: AnthropicStreamOptions): AsyncGenerator<string, void, unknown> {
  let finalMessages: AnthropicMessage[] = messages;
  if (!finalMessages.length && userPrompt) {
    finalMessages = [{ role: 'user', content: userPrompt }];
  }

  if (!finalMessages.length) {
    throw new AnthropicError('No messages provided', 400, false);
  }

  const payload = {
    model,
    system: systemPrompt,
    messages: finalMessages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  // For streaming, we use circuit breaker but handle retries differently
  const response = await anthropicCircuitBreaker.execute(async () => {
    return withTimeout(
      () => callAnthropic(payload),
      CONFIG.streamTimeoutMs,
      'Anthropic stream initialization'
    );
  });

  if (!response.body) {
    throw new AnthropicError('Claude did not return a streamable body', 500, false);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') return;

        try {
          const event: StreamEvent = JSON.parse(dataStr);
          // Handle Messages API stream events
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
            yield event.delta.text;
          }
        } catch {
          // Skip malformed JSON lines
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Gets the current health status of the Anthropic client
 */
export function getAnthropicHealth(): AnthropicHealthStatus {
  return {
    apiKeyConfigured: !!API_KEY,
    circuitBreaker: anthropicCircuitBreaker.getState(),
    defaultModel: CONFIG.defaultModel,
    apiVersion: API_VERSION
  };
}

/**
 * Get the default model being used
 */
export function getDefaultModel(): string {
  return CONFIG.defaultModel;
}

