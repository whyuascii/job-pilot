/**
 * Lightweight structured JSON logger.
 * No external dependencies - uses console with structured output.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  tenantId?: string;
  userId?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  return JSON.stringify(entry);
}

function createLogger(defaultContext?: LogContext) {
  return {
    debug(message: string, context?: LogContext) {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', message, { ...defaultContext, ...context }));
      }
    },
    info(message: string, context?: LogContext) {
      if (shouldLog('info')) {
        console.info(formatMessage('info', message, { ...defaultContext, ...context }));
      }
    },
    warn(message: string, context?: LogContext) {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', message, { ...defaultContext, ...context }));
      }
    },
    error(message: string, context?: LogContext) {
      if (shouldLog('error')) {
        console.error(formatMessage('error', message, { ...defaultContext, ...context }));
      }
    },
    child(childContext: LogContext) {
      return createLogger({ ...defaultContext, ...childContext });
    },
  };
}

export const logger = createLogger();
export type Logger = ReturnType<typeof createLogger>;
export { createLogger };
