// =============================================================================
// Structured Logger
// =============================================================================
// Enterprise-grade logging with JSON output and log levels.
// Replaces console.log throughout the application.
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
}

interface LogEntry extends LogMeta {
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  child(defaultMeta: LogMeta): Logger;
  timed<T>(operationName: string, fn: () => Promise<T>, meta?: LogMeta): Promise<T>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const CURRENT_LEVEL = LOG_LEVELS[(process.env.LOG_LEVEL?.toLowerCase() as LogLevel)] ?? LOG_LEVELS.info;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Formats a log entry
 */
function formatLog(level: LogLevel, message: string, meta: LogMeta = {}): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  if (IS_PRODUCTION) {
    return JSON.stringify(entry);
  }

  // Pretty print for development
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m'  // red
  };
  const reset = '\x1b[0m';
  const color = levelColors[level] || reset;

  const metaStr = Object.keys(meta).length > 0 
    ? `\n  ${JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')}`
    : '';

  return `${color}[${level.toUpperCase()}]${reset} ${entry.timestamp} - ${message}${metaStr}`;
}

// =============================================================================
// LOGGER IMPLEMENTATION
// =============================================================================

/**
 * Creates a logger instance
 */
function createLogger(defaultMeta: LogMeta = {}): Logger {
  return {
    debug(message: string, meta: LogMeta = {}) {
      if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
        console.debug(formatLog('debug', message, { ...defaultMeta, ...meta }));
      }
    },

    info(message: string, meta: LogMeta = {}) {
      if (CURRENT_LEVEL <= LOG_LEVELS.info) {
        console.info(formatLog('info', message, { ...defaultMeta, ...meta }));
      }
    },

    warn(message: string, meta: LogMeta = {}) {
      if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
        console.warn(formatLog('warn', message, { ...defaultMeta, ...meta }));
      }
    },

    error(message: string, meta: LogMeta = {}) {
      if (CURRENT_LEVEL <= LOG_LEVELS.error) {
        console.error(formatLog('error', message, { ...defaultMeta, ...meta }));
      }
    },

    child(moreMeta: LogMeta): Logger {
      return createLogger({ ...defaultMeta, ...moreMeta });
    },

    async timed<T>(operationName: string, fn: () => Promise<T>, meta: LogMeta = {}): Promise<T> {
      const start = Date.now();
      try {
        const result = await fn();
        const durationMs = Date.now() - start;
        this.info(`${operationName} completed`, { ...meta, durationMs });
        return result;
      } catch (error) {
        const durationMs = Date.now() - start;
        this.error(`${operationName} failed`, { 
          ...meta, 
          durationMs, 
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Structured logger instance
 * 
 * @example
 * logger.info('Processing query', { query: 'Apple revenue', strategy: 'auto' });
 * logger.error('API call failed', { error: err.message, statusCode: 500 });
 */
export const logger = createLogger();

/**
 * Request-scoped logger factory
 * Creates a logger with request context for tracing
 * 
 * @example
 * export async function POST(req: NextRequest) {
 *   const log = createRequestLogger(requestId);
 *   log.info('Request started');
 *   // ... processing
 *   log.info('Request completed', { strategy: 'auto' });
 * }
 */
export function createRequestLogger(requestId: string, additionalMeta: LogMeta = {}): Logger {
  return logger.child({
    requestId,
    ...additionalMeta
  });
}

export type { Logger, LogMeta, LogLevel };

