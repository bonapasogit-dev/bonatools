/**
 * HTTP Client Logger
 * ==================
 *
 * Structured logging for HTTP client operations.
 * Provides consistent log formatting and level management.
 */

import type { Logger, HttpLogContext } from './types';
import { sanitizeForLog } from './utils';

/**
 * Structured logger implementation for HTTP client.
 * Adds context prefix and respects log levels.
 */
export class HttpClientLogger implements Logger {
  private readonly baseLogger: Logger;
  private readonly prefix = '[HttpClient]';

  constructor(baseLogger: Logger = console) {
    this.baseLogger = baseLogger;
  }

  info(message?: unknown, ...args: unknown[]): void {
    this.baseLogger.info(`${this.prefix} ${String(message)}`, ...args);
  }

  warn(message?: unknown, ...args: unknown[]): void {
    this.baseLogger.warn(`${this.prefix} ${String(message)}`, ...args);
  }

  error(message?: unknown, ...args: unknown[]): void {
    this.baseLogger.error(`${this.prefix} ${String(message)}`, ...args);
  }

  debug(message?: unknown, ...args: unknown[]): void {
    if (this.baseLogger.debug) {
      this.baseLogger.debug(`${this.prefix} ${String(message)}`, ...args);
    }
  }
}

/**
 * Log HTTP request start event.
 * Includes all request parameters for full traceability.
 */
export function logRequestStart(
  logger: Logger,
  context: HttpLogContext,
  maxLogBodyLength: number
): void {
  const sanitized = sanitizeForLog(context, maxLogBodyLength);
  logger.info('Request start', sanitized);
}

/**
 * Log HTTP request success event.
 * Includes response status and result data.
 */
export function logRequestSuccess(
  logger: Logger,
  context: HttpLogContext,
  maxLogBodyLength: number
): void {
  const sanitized = sanitizeForLog(context, maxLogBodyLength);
  logger.info('Request success', sanitized);
}

/**
 * Log HTTP request error event.
 * Includes error details and retry information.
 */
export function logRequestError(
  logger: Logger,
  context: HttpLogContext,
  willRetry: boolean,
  maxLogBodyLength: number
): void {
  const logLevel = willRetry ? 'warn' : 'error';
  const logFn = logLevel === 'warn' ? logger.warn : logger.error;

  const sanitized = sanitizeForLog(context, maxLogBodyLength);
  logFn.call(logger, `Request ${willRetry ? 'will retry' : 'failed'}`, sanitized);
}

/**
 * Log HTTP request retry scheduled.
 * Includes delay and next attempt info.
 */
export function logRetryScheduled(
  logger: Logger,
  context: HttpLogContext,
  maxLogBodyLength: number
): void {
  const sanitized = sanitizeForLog(context, maxLogBodyLength);
  logger.warn('Request retry scheduled', sanitized);
}

/**
 * Log circuit breaker state change.
 */
export function logCircuitStateChange(
  logger: Logger,
  previousState: string,
  newState: string,
  context: Record<string, unknown>
): void {
  logger.warn('Circuit breaker state change', {
    from: previousState,
    to: newState,
    ...context,
  });
}

/**
 * Log circuit breaker rejection.
 */
export function logCircuitBreakerBlocked(
  logger: Logger,
  context: Record<string, unknown>
): void {
  logger.warn('Circuit breaker blocking request', context);
}
