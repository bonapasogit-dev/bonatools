/**
 * HTTP Client Error Classes
 * =========================
 *
 * Structured error hierarchy for robust error handling and logging.
 * Each error type provides toLogObject() for consistent logging.
 */

import type {
  AppErrorOptions,
  HttpErrorOptions,
  ErrorMetadata,
  ErrorLogObject,
} from './types';

/**
 * Base application error class.
 * All HTTP client errors extend from this.
 */
export class AppError extends Error {
  readonly name: string;
  readonly code?: string;
  readonly cause?: Error;
  readonly metadata?: ErrorMetadata;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = options.name ?? this.constructor.name;
    this.code = options.code;
    this.cause = options.cause;
    this.metadata = options.metadata;
  }

  /**
   * Serialize error for logging with structured format.
   * Safe for JSON serialization and consistent across error types.
   */
  toLogObject(): ErrorLogObject {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      cause: this.cause ? serializeCause(this.cause) : undefined,
      stack: this.stack,
    };
  }
}

/**
 * HTTP-specific error with status code and response body.
 * Thrown when server responds with 4xx or 5xx status code.
 */
export class HttpError extends AppError {
  readonly status: number;
  readonly responseBody?: unknown;
  readonly response?: import('./types').ApiResponse;

  constructor(
    message: string,
    options: HttpErrorOptions
  ) {
    super(message, {
      name: 'HttpError',
      code: options.code ?? 'HTTP_ERROR',
      metadata: {
        ...(options.metadata ?? {}),
        status: options.status,
      },
      cause: options.cause,
    });

    this.status = options.status;
    this.responseBody = options.responseBody;
    this.response = options.response;
  }

  /**
   * Extend base log object with HTTP-specific data.
   */
  override toLogObject(): ErrorLogObject {
    const baseLog = super.toLogObject();
    return {
      ...baseLog,
      status: this.status,
      responseBody: this.responseBody,
      response: this.response,
    };
  }
}

/**
 * Circuit breaker open error.
 * Thrown when circuit breaker prevents request due to excessive failures.
 */
export class CircuitOpenError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super('Circuit breaker is open', {
      ...options,
      name: 'CircuitOpenError',
      code: options.code ?? 'CIRCUIT_OPEN',
    });
  }
}

/**
 * Request timeout error.
 * Thrown when request exceeds configured timeout.
 */
export class TimeoutError extends AppError {
  readonly durationMs: number;

  constructor(durationMs: number, options: AppErrorOptions = {}) {
    super(`Request timeout after ${durationMs}ms`, {
      ...options,
      name: 'TimeoutError',
      code: options.code ?? 'TIMEOUT',
    });
    this.durationMs = durationMs;
  }
}

/**
 * Request aborted error.
 * Thrown when request is cancelled or aborted.
 */
export class AbortError extends AppError {
  constructor(options: AppErrorOptions = {}) {
    super('Request aborted', {
      ...options,
      name: 'AbortError',
      code: options.code ?? 'ABORT',
    });
  }
}

/**
 * Network connectivity error.
 * Thrown for network-level failures (DNS, connection refused, etc).
 */
export class NetworkError extends AppError {
  readonly originalError: Error;

  constructor(originalError: Error, options: AppErrorOptions = {}) {
    super(originalError.message, {
      ...options,
      name: 'NetworkError',
      code: options.code ?? 'NETWORK_ERROR',
      cause: originalError,
    });
    this.originalError = originalError;
  }
}

/**
 * Convert unknown error to ErrorLogObject for consistent logging.
 * Handles AppError subclasses, Error objects, and unknown types.
 *
 * @param error - Unknown error value
 * @returns Serializable error object
 */
export function errorToLogObject(error: unknown): ErrorLogObject {
  if (!error) {
    return {
      name: 'UnknownError',
      message: 'Unknown error',
    };
  }

  if (error instanceof AppError) {
    return error.toLogObject();
  }

  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

/**
 * Serialize error cause for logging.
 * Recursively handles nested causes up to 3 levels.
 */
function serializeCause(
  cause: unknown,
  depth: number = 0
): unknown {
  if (depth > 3 || !cause) return undefined;

  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      cause: serializeCause((cause as any).cause, depth + 1),
    };
  }

  if (typeof cause === 'object') {
    return JSON.parse(JSON.stringify(cause));
  }

  return String(cause);
}

/**
 * Type guard to check if error is retriable.
 * Used for retry logic decision making.
 *
 * @param error - Error to check
 * @returns True if error should be retried
 */
export function isRetriableError(error: unknown): boolean {
  if (error instanceof CircuitOpenError) {
    return false;
  }

  if (error instanceof HttpError) {
    // Retry 5xx errors, not client errors (4xx)
    return error.status >= 500;
  }

  if (error instanceof TimeoutError || error instanceof NetworkError) {
    return true;
  }

  return false;
}
