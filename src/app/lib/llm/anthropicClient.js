'use client';

// Lightweight JS version for Node scripts (evaluations) to avoid TS imports
import { TextDecoder } from 'util';

const BASE_URL = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const API_VERSION = process.env.ANTHROPIC_API_VERSION || '2023-06-01';

const CONFIG = {
  defaultModel: 'claude-opus-4-5-20251101',
  timeoutMs: 60000,
  streamTimeoutMs: 120000,
  maxRetries: 3,
  baseDelayMs: 1500,
};

class AnthropicError extends Error {
  constructor(message, statusCode, isRetryable = false) {
    super(message);
    this.name = 'AnthropicError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

async function callAnthropic(payload) {
  if (!API_KEY) {
    throw new AnthropicError('ANTHROPIC_API_KEY is required', 401, false);
  }
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    const status = res.status;
    const isRetryable = status === 429 || status >= 500;
    throw new AnthropicError(`Claude request failed (${status}): ${text}`, status, isRetryable);
  }
  return res;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { maxAttempts, baseDelayMs, shouldRetry }) {
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || !shouldRetry?.(err)) {
        throw err;
      }
      const delay = baseDelayMs * attempt;
      console.warn(`[AnthropicClient] Attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

function withTimeout(promiseFactory, ms, label = 'operation') {
  return Promise.race([
    promiseFactory(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new AnthropicError(`${label} timed out after ${ms}ms`, 504, true)), ms)
    ),
  ]);
}

export async function anthropicCompletion({
  model = CONFIG.defaultModel,
  systemPrompt = '',
  userPrompt = '',
  messages = [],
  temperature = 0.7,
  maxTokens = 800,
  onUsage,
} = {}) {
  let finalMessages = messages;
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

  const response = await withRetry(
    () => withTimeout(() => callAnthropic(payload), CONFIG.timeoutMs, 'Anthropic completion'),
    {
      maxAttempts: CONFIG.maxRetries,
      baseDelayMs: CONFIG.baseDelayMs,
      shouldRetry: (err) => err?.isRetryable || err?.message?.includes('network'),
    }
  );

  const data = await response.json();
  if (onUsage && data?.usage) {
    try {
      onUsage(data.usage);
    } catch (err) {
      console.error('[AnthropicClient] Failed to capture usage metrics:', err);
    }
  }

  if (Array.isArray(data?.content)) {
    return data.content.reduce((acc, block) => {
      if (block.type === 'text') return acc + block.text;
      return acc;
    }, '');
  }
  return '';
}

export async function* anthropicStream({
  model = CONFIG.defaultModel,
  systemPrompt = '',
  userPrompt = '',
  messages = [],
  temperature = 0.7,
  maxTokens = 800,
} = {}) {
  let finalMessages = messages;
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

  const response = await withTimeout(
    () => callAnthropic(payload),
    CONFIG.streamTimeoutMs,
    'Anthropic stream initialization'
  );

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
          const event = JSON.parse(dataStr);
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
            yield event.delta.text;
          }
        } catch {
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function getAnthropicHealth() {
  return {
    apiKeyConfigured: !!API_KEY,
    circuitBreaker: { state: 'closed' },
    defaultModel: CONFIG.defaultModel,
    apiVersion: API_VERSION,
  };
}

export function getDefaultModel() {
  return CONFIG.defaultModel;
}
