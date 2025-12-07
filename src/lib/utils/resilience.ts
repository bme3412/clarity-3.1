// =============================================================================
// Resilience Utilities
// =============================================================================
// Enterprise-grade error handling: retries, timeouts, circuit breakers.
// Use these wrappers for all external API calls.
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterMs?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (info: RetryInfo) => void;
}

export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  delay: number;
  error: Error;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterMs: 500
};

/**
 * Error patterns that should trigger a retry
 */
const RETRYABLE_ERROR_PATTERNS = [
  /rate.?limit/i,
  /too.?many.?requests/i,
  /429/,
  /503/,
  /502/,
  /504/,
  /timeout/i,
  /ECONNRESET/,
  /ETIMEDOUT/,
  /ENOTFOUND/,
  /overloaded/i
];

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Custom timeout error class
 */
export class TimeoutError extends Error {
  readonly isTimeout = true;

  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Custom error for open circuit
 */
export class CircuitOpenError extends Error {
  readonly isCircuitOpen = true;

  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines if an error should trigger a retry
 */
function isRetryableError(error: Error): boolean {
  if (!error) return false;
  
  const message = error.message || '';
  const status = (error as Error & { status?: number; statusCode?: number }).status || 
                 (error as Error & { statusCode?: number }).statusCode;
  
  // Check status codes
  if (status === 429 || status === 503 || status === 502 || status === 504) {
    return true;
  }
  
  // Check error message patterns
  return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Calculates delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number, 
  options: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>>
): number {
  const { baseDelayMs, maxDelayMs, backoffMultiplier, jitterMs } = options;
  
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);
  const jitter = Math.random() * jitterMs;
  
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

// =============================================================================
// RETRY FUNCTION
// =============================================================================

/**
 * Retries an async function with exponential backoff
 * 
 * @example
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3, baseDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>, 
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const { maxAttempts, shouldRetry = isRetryableError, onRetry } = opts;
  
  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      const isLastAttempt = attempt === maxAttempts - 1;
      const canRetry = shouldRetry(lastError);
      
      if (isLastAttempt || !canRetry) {
        throw error;
      }
      
      const delay = calculateDelay(attempt, opts);
      
      if (onRetry) {
        onRetry({ attempt: attempt + 1, maxAttempts, delay, error: lastError });
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// =============================================================================
// TIMEOUT FUNCTION
// =============================================================================

/**
 * Wraps an async function with a timeout
 * 
 * @example
 * const result = await withTimeout(
 *   () => fetch('https://slow-api.com'),
 *   5000,
 *   'API call'
 * );
 */
export async function withTimeout<T>(
  fn: () => Promise<T>, 
  timeoutMs: number, 
  operationName = 'Operation'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Failing, reject all requests
  HALF_OPEN = 'HALF_OPEN'  // Testing if service recovered
}

/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by failing fast when a service is down.
 * 
 * @example
 * const breaker = new CircuitBreaker({ failureThreshold: 5 });
 * 
 * try {
 *   const result = await breaker.execute(() => callExternalAPI());
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Service is known to be down, fail fast
 *   }
 * }
 */
export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;
  
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private halfOpenAttempts = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 3;
  }

  /**
   * Executes a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
      } else {
        throw new CircuitOpenError('Circuit breaker is OPEN');
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

  /**
   * Records a successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.halfOpenMaxAttempts) {
        this.reset();
      }
    } else {
      this.failures = 0;
    }
  }

  /**
   * Records a failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failures >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Resets the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.halfOpenAttempts = 0;
  }

  /**
   * Gets the current state of the circuit breaker
   */
  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// =============================================================================
// COMBINED UTILITIES
// =============================================================================

export interface RetryAndTimeoutOptions extends RetryOptions {
  timeoutMs?: number;
  operationName?: string;
}

/**
 * Combines retry and timeout for robust API calls
 * 
 * @example
 * const result = await withRetryAndTimeout(
 *   () => callExternalAPI(),
 *   { timeoutMs: 5000, maxAttempts: 3, operationName: 'Voyage embedding' }
 * );
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>, 
  options: RetryAndTimeoutOptions = {}
): Promise<T> {
  const { 
    timeoutMs = 30000, 
    operationName = 'API call',
    ...retryOptions 
  } = options;
  
  return withRetry(
    () => withTimeout(fn, timeoutMs, operationName),
    {
      ...retryOptions,
      onRetry: ({ attempt, maxAttempts, delay, error }) => {
        console.warn(
          `[${operationName}] Attempt ${attempt}/${maxAttempts} failed: ${error.message}. ` +
          `Retrying in ${Math.round(delay)}ms...`
        );
      }
    }
  );
}

/**
 * Wraps a function to add automatic retry on specific errors
 * Returns a new function with the same signature
 */
export function withAutoRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>, 
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    return withRetry(() => fn(...args), options);
  };
}

// =============================================================================
// PRE-CONFIGURED INSTANCES
// =============================================================================

/**
 * Circuit breaker for Voyage AI
 */
export const voyageCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 60000
});

/**
 * Circuit breaker for Pinecone
 */
export const pineconeCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000
});

/**
 * Circuit breaker for Anthropic
 */
export const anthropicCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 60000
});

