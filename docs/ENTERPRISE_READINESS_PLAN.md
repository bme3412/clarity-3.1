# Clarity RAG - Enterprise Readiness Plan

## Overview

This document outlines the prioritized improvements to make Clarity an enterprise-grade RAG application suitable for showcasing in an AI engineering portfolio, particularly for an Anthropic application.

**Current State:** Functional MVP with solid RAG fundamentals  
**Target State:** Production-ready, enterprise-grade financial analysis system

---

## 🎯 Priority Matrix

| Priority | Category | Impact | Effort | Timeline |
|----------|----------|--------|--------|----------|
| P0 | Answer Quality & Prompts | Very High | Medium | Week 1 |
| P0 | Remove OpenAI Dependencies | High | Low | ✅ Done |
| P1 | Type Safety (Zod + JSDoc) | High | Medium | Week 1-2 |
| P1 | Error Handling & Retries | High | Medium | Week 1 |
| P2 | Observability (Full Langfuse) | Medium | Medium | Week 2 |
| P2 | Unit & Integration Tests | Medium | High | Week 2-3 |
| P3 | Security Hardening | Medium | Low | Week 3 |
| P3 | Documentation & ADRs | Medium | Low | Ongoing |

---

## P0: Answer Quality (CRITICAL FOR ANTHROPIC)

### ✅ Completed: Enhanced Prompt System

The prompt templates in `src/lib/prompts/index.js` have been upgraded to v2.0 with:

1. **Structured Output Schemas** - JSON schemas for intent classification
2. **Fiscal Calendar Awareness** - Company-specific FY mapping
3. **Citation Protocol** - Inline source attribution format
4. **Anti-Pattern Guards** - Explicit "never do" rules
5. **Evaluation Prompts** - Standardized rubrics for faithfulness, relevance, accuracy

### TODO: Additional Quality Improvements

```javascript
// Add to src/lib/prompts/guardrails.js

export const OUTPUT_GUARDRAILS = {
  // Prevent common LLM failure modes
  maxResponseLength: 500, // tokens
  requireCitation: true,
  prohibitedPhrases: [
    "Based on the provided context",
    "I don't have access to",
    "As an AI language model",
    "I cannot provide financial advice"
  ],
  requiredElements: {
    financial: ['specific_number', 'time_period', 'source_citation'],
    strategic: ['evidence', 'timeline', 'source_citation']
  }
};

export function validateResponse(response, queryType) {
  const violations = [];
  
  // Check prohibited phrases
  for (const phrase of OUTPUT_GUARDRAILS.prohibitedPhrases) {
    if (response.toLowerCase().includes(phrase.toLowerCase())) {
      violations.push(`Contains prohibited phrase: "${phrase}"`);
    }
  }
  
  // Check required elements
  const required = OUTPUT_GUARDRAILS.requiredElements[queryType] || [];
  // ... validation logic
  
  return { valid: violations.length === 0, violations };
}
```

---

## P1: Type Safety & Validation

### Current Gap
All files are `.js` with no type checking. Tool inputs/outputs are unvalidated.

### Solution: Zod Schemas + JSDoc

```javascript
// src/lib/schemas/api.js
import { z } from 'zod';

// Request Schemas
export const ChatRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  strategy: z.enum(['auto', 'dense-only', 'hybrid-bm25', 'hyde', 'multi-query']).default('auto'),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional().default([])
});

// Tool Input Schemas
export const GetFinancialMetricsInputSchema = z.object({
  ticker: z.enum(['AAPL', 'AMD', 'AMZN', 'AVGO', 'CRM', 'GOOGL', 'META', 'MSFT', 'NVDA', 'ORCL']),
  fiscalYear: z.string().regex(/^(20\d{2}|FY\d{2,4})$/),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  metrics: z.array(z.enum([
    'revenue', 'gross_profit', 'operating_income', 'net_income',
    'eps', 'eps_diluted', 'gross_margin', 'operating_margin',
    'net_margin', 'free_cash_flow', 'operating_cash_flow', 'revenue_segments'
  ])).min(1)
});

// Response Schemas
export const ChatResponseMetadataSchema = z.object({
  requestId: z.string().uuid(),
  strategy: z.string(),
  autoSelected: z.boolean(),
  citations: z.array(z.object({
    index: z.number(),
    source: z.string(),
    text: z.string(),
    fiscalYear: z.string().optional(),
    quarter: z.string().optional(),
    score: z.string().optional()
  })),
  detectedTickers: z.array(z.string()),
  detectedYear: z.string().nullable()
});
```

### Implementation Steps

1. Create `src/lib/schemas/` directory with:
   - `api.js` - API request/response schemas
   - `tools.js` - Tool input/output schemas
   - `evaluation.js` - Eval dataset schemas

2. Add validation middleware to API routes:

```javascript
// src/app/api/chat/financial/route.js
import { ChatRequestSchema } from '../../../../lib/schemas/api.js';

export async function POST(req) {
  const body = await req.json();
  
  // Validate request
  const parseResult = ChatRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request',
      details: parseResult.error.issues
    }, { status: 400 });
  }
  
  const { query, strategy, chatHistory } = parseResult.data;
  // ... rest of handler
}
```

---

## P1: Error Handling & Retries

### Current Gap
- No retry logic for API calls
- Silent failures in many catch blocks
- No circuit breaker for external services

### Solution: Centralized Error Handling

```javascript
// src/lib/utils/resilience.js

/**
 * Retry wrapper with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    retryOn = (error) => error.status >= 500 || error.status === 429
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !retryOn(error)) {
        throw error;
      }
      
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
        maxDelayMs
      );
      
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper
 */
export async function withTimeout(fn, timeoutMs = 30000) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  
  return Promise.race([fn(), timeoutPromise]);
}

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.failures = 0;
    this.lastFailure = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

### Apply to Voyage Client

```javascript
// src/app/lib/llm/voyageClient.js
import { withRetry, withTimeout } from '../../../lib/utils/resilience.js';

export async function embedText(text, options = {}) {
  return withRetry(
    () => withTimeout(
      () => requestEmbeddings([text], options),
      10000 // 10s timeout
    ),
    {
      maxAttempts: 3,
      retryOn: (error) => error.message?.includes('429') || error.message?.includes('503')
    }
  );
}
```

---

## P2: Full Observability

### Current Gap
- Langfuse only in `/api/chat/stream`
- No tracing in main RAG route
- Console.log throughout (no structured logging)

### Solution: Comprehensive Tracing

```javascript
// src/lib/observability/tracing.js
import { getLangfuse, createTrace, flush } from './langfuse.js';

/**
 * Trace wrapper for RAG pipeline operations
 */
export function createRAGTrace(requestId, query, metadata = {}) {
  const trace = createTrace({ requestId, userId: metadata.userId, query });
  
  return {
    trace,
    
    spanRetrieval(name, fn) {
      return this.span(name, 'retrieval', fn);
    },
    
    spanLLM(name, fn) {
      return this.span(name, 'llm', fn);
    },
    
    spanTool(name, fn) {
      return this.span(name, 'tool', fn);
    },
    
    async span(name, type, fn) {
      if (!trace) return fn();
      
      const span = trace.span({ name, metadata: { type } });
      const start = Date.now();
      
      try {
        const result = await fn();
        span.end({
          metadata: { 
            success: true, 
            durationMs: Date.now() - start 
          }
        });
        return result;
      } catch (error) {
        span.end({
          metadata: { 
            success: false, 
            error: error.message,
            durationMs: Date.now() - start
          }
        });
        throw error;
      }
    },
    
    async end() {
      await flush();
    }
  };
}
```

### Structured Logging

```javascript
// src/lib/observability/logger.js

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function formatLog(level, message, meta = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  });
}

export const logger = {
  debug(message, meta) {
    if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
      console.debug(formatLog('debug', message, meta));
    }
  },
  
  info(message, meta) {
    if (CURRENT_LEVEL <= LOG_LEVELS.info) {
      console.info(formatLog('info', message, meta));
    }
  },
  
  warn(message, meta) {
    if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
      console.warn(formatLog('warn', message, meta));
    }
  },
  
  error(message, meta) {
    if (CURRENT_LEVEL <= LOG_LEVELS.error) {
      console.error(formatLog('error', message, meta));
    }
  }
};
```

---

## P2: Testing Infrastructure

### Test Structure

```
tests/
├── unit/
│   ├── lib/
│   │   ├── prompts.test.js
│   │   ├── schemas.test.js
│   │   └── resilience.test.js
│   └── utils/
│       └── financialDataCache.test.js
├── integration/
│   ├── api/
│   │   ├── chat-financial.test.js
│   │   └── health.test.js
│   └── rag/
│       └── pipeline.test.js
└── e2e/
    └── golden-qa.test.js
```

### Example Unit Test

```javascript
// tests/unit/lib/schemas.test.js
import { describe, it, expect } from 'vitest';
import { ChatRequestSchema, GetFinancialMetricsInputSchema } from '../../../src/lib/schemas/api.js';

describe('ChatRequestSchema', () => {
  it('validates valid request', () => {
    const result = ChatRequestSchema.safeParse({
      query: 'What was Apple revenue in Q3 2024?',
      strategy: 'auto'
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty query', () => {
    const result = ChatRequestSchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid strategy', () => {
    const result = ChatRequestSchema.safeParse({
      query: 'test',
      strategy: 'invalid'
    });
    expect(result.success).toBe(false);
  });
});

describe('GetFinancialMetricsInputSchema', () => {
  it('validates valid tool input', () => {
    const result = GetFinancialMetricsInputSchema.safeParse({
      ticker: 'AAPL',
      fiscalYear: '2024',
      quarter: 'Q3',
      metrics: ['revenue', 'operating_margin']
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid ticker', () => {
    const result = GetFinancialMetricsInputSchema.safeParse({
      ticker: 'INVALID',
      fiscalYear: '2024',
      quarter: 'Q3',
      metrics: ['revenue']
    });
    expect(result.success).toBe(false);
  });
});
```

### Setup Commands

```bash
# Add to package.json scripts
npm pkg set scripts.test="vitest"
npm pkg set scripts.test:unit="vitest run tests/unit"
npm pkg set scripts.test:integration="vitest run tests/integration"
npm pkg set scripts.test:coverage="vitest run --coverage"

# Install dependencies
npm install -D vitest @vitest/coverage-v8
```

---

## P3: Security Hardening

### Rate Limiting

```javascript
// src/lib/middleware/rateLimit.js
const requestCounts = new Map();

export function rateLimit(options = {}) {
  const { windowMs = 60000, maxRequests = 30 } = options;
  
  return (request) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    const record = requestCounts.get(ip) || { count: 0, resetAt: now + windowMs };
    
    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }
    
    record.count++;
    requestCounts.set(ip, record);
    
    if (record.count > maxRequests) {
      return {
        limited: true,
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      };
    }
    
    return { limited: false };
  };
}
```

### Input Sanitization

```javascript
// src/lib/utils/sanitize.js

export function sanitizeQuery(query) {
  if (typeof query !== 'string') return '';
  
  return query
    .slice(0, 2000) // Max length
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

export function sanitizeTickerInput(ticker) {
  if (typeof ticker !== 'string') return null;
  
  const normalized = ticker.toUpperCase().replace(/[^A-Z]/g, '');
  
  const VALID_TICKERS = ['AAPL', 'AMD', 'AMZN', 'AVGO', 'CRM', 'GOOGL', 'META', 'MSFT', 'NVDA', 'ORCL'];
  
  return VALID_TICKERS.includes(normalized) ? normalized : null;
}
```

---

## Environment Variables (Updated)

```bash
# .env.example

# Required - Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-5-20251101  # or claude-sonnet-4-20250514

# Required - Voyage AI Embeddings
VOYAGE_API_KEY=pa-...

# Required - Pinecone Vector Store
PINECONE_API_KEY=...
PINECONE_INDEX=clarity-1024

# Optional - Observability
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...

# Optional - Logging
LOG_LEVEL=info  # debug, info, warn, error

# Optional - Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30
```

---

## Implementation Checklist

### Week 1
- [x] Remove OpenAI dependencies
- [x] Upgrade prompt system to v2.0
- [ ] Add Zod schemas for API validation
- [ ] Implement retry/timeout wrappers
- [ ] Add structured logging

### Week 2
- [ ] Full Langfuse integration in all routes
- [ ] Add unit tests for schemas and utils
- [ ] Add integration tests for API routes
- [ ] Implement rate limiting middleware

### Week 3
- [ ] E2E test suite with golden QA
- [ ] Security audit and hardening
- [ ] Documentation updates
- [ ] Performance benchmarking

---

## Metrics to Track

### Quality Metrics (from evals)
- **Relevance**: Target > 0.90 (current: 0.89)
- **Faithfulness**: Target > 0.85 (current: 0.74)
- **Accuracy**: Target > 0.90 (current: 0.85)

### Operational Metrics
- **P95 Latency**: Target < 5s
- **Error Rate**: Target < 1%
- **Tool Call Success Rate**: Target > 99%

### Code Quality
- **Test Coverage**: Target > 80%
- **Type Coverage**: Target 100% (with Zod + JSDoc)
- **Zero ESLint Errors**

---

## For Your Anthropic Application

When discussing this project, highlight:

1. **Anthropic-Native Architecture**: 100% Claude-powered, no OpenAI dependencies
2. **Prompt Engineering Excellence**: Versioned prompts with anti-pattern guards
3. **Evaluation Rigor**: LLM-as-judge with standardized rubrics
4. **Production Readiness**: Type safety, error handling, observability
5. **Domain Expertise**: Financial data requires precision - show you understand this

### Talking Points

- "I built an enterprise RAG system for financial analysis, powered entirely by Claude"
- "The system uses structured prompts with explicit citation requirements to minimize hallucination"
- "I implemented an LLM-as-judge evaluation framework measuring faithfulness, relevance, and accuracy"
- "The retrieval pipeline supports multiple strategies (dense, hybrid, HyDE, multi-query) with automatic selection"
- "I prioritized type safety and validation to catch errors at the API boundary"

