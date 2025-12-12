// Voyage embedding client (server-safe).
// Note: This module must NOT be marked 'use client' because it's used by API routes and retrieval.
// It is safe for Node scripts and server runtime; do not import it from browser components.

const API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings';

const CONFIG = {
  defaultModel: 'voyage-3.5',
  dimensions: 1024,
  timeoutMs: 15000,
  maxRetries: 3,
  rateLimitDelayMs: 1000,
};

class VoyageError extends Error {
  constructor(message, statusCode, isRetryable = false) {
    super(message);
    this.name = 'VoyageError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
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
      console.warn(`[VoyageClient] Attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

function withTimeout(promiseFactory, ms, label = 'operation') {
  return Promise.race([
    promiseFactory(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new VoyageError(`${label} timed out after ${ms}ms`, 504, true)), ms)
    ),
  ]);
}

async function requestEmbeddings(texts, { model = CONFIG.defaultModel, inputType = 'document', outputDimension, outputDtype } = {}) {
  if (!API_KEY) {
    throw new VoyageError('VOYAGE_API_KEY is required to generate embeddings.', 401, false);
  }

  const payload = {
    input: texts,
    model,
    input_type: inputType,
  };
  if (outputDimension) payload.output_dimension = outputDimension;
  if (outputDtype) payload.output_dtype = outputDtype;

  const res = await fetch(VOYAGE_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    const status = res.status;
    const isRetryable = status === 429 || status >= 500;
    throw new VoyageError(`Voyage embedding failed (${status}): ${body}`, status, isRetryable);
  }

  const data = await res.json();
  return (data.data || []).map((item) => item.embedding);
}

export async function embedText(text, options = {}) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  const embeddings = await withRetry(
    () => withTimeout(() => requestEmbeddings([trimmed], options), CONFIG.timeoutMs, 'Voyage embedding'),
    {
      maxAttempts: CONFIG.maxRetries,
      baseDelayMs: CONFIG.rateLimitDelayMs,
      shouldRetry: (err) => err?.isRetryable || err?.message?.includes('network'),
    }
  );
  return embeddings[0] || [];
}

export async function embedTexts(texts, options = {}) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const valid = texts
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean);
  if (!valid.length) return [];

  return withRetry(
    () => withTimeout(() => requestEmbeddings(valid, options), CONFIG.timeoutMs * 2, 'Voyage batch embedding'),
    {
      maxAttempts: CONFIG.maxRetries,
      baseDelayMs: CONFIG.rateLimitDelayMs,
      shouldRetry: (err) => err?.isRetryable || err?.message?.includes('network'),
    }
  );
}

export function getVoyageHealth() {
  return {
    apiKeyConfigured: !!API_KEY,
    circuitBreaker: { state: 'closed' },
    model: CONFIG.defaultModel,
    dimensions: CONFIG.dimensions,
  };
}
