/**
 * HTTP Client Implementation
 * ==========================
 *
 * Production-grade HTTP client with comprehensive features:
 * - Automatic retries with exponential backoff + jitter
 * - Circuit breaker pattern for failure resilience
 * - Structured logging with sensitive data redaction
 * - Request timeout and abort support
 * - Query parameter filtering and URL construction
 * - Response type detection (JSON/text)
 *
 * Design principles:
 * - Type-safe with full TypeScript coverage
 * - Zero external dependencies for core functionality
 * - Lock-free circuit breaker (suitable for single-threaded Node.js)
 * - Memory efficient with proper cleanup
 * - Production telemetry through structured logging
 */

import type {
  HttpClientOptions,
  RequestOptions,
  Logger,
  CircuitBreakerState,
  CircuitBreakerConfig,
  BackoffConfig,
  HttpTransportOptions,
  RequestHeaders,
} from './types';

import {
  AppError,
  HttpError,
  CircuitOpenError,
  TimeoutError,
  NetworkError,
  AbortError,
  errorToLogObject,
  isRetriableError,
} from './errors';

import {
  HttpSuccess,
  getResponseType,
  normalizeErrorResponse,
  normalizeSuccessResponse,
} from './response';

import {
  computeBackoff,
  sleep,
  createRequestId,
  filterQuery,
  redactHeaders,
  sanitizeForLog,
  buildUrl,
} from './utils';

import {
  HttpClientLogger,
  logRequestStart,
  logRequestSuccess,
  logRequestError,
  logRetryScheduled,
  logCircuitBreakerBlocked,
} from './logger';

import { createTransport } from './transports';
import type { HttpTransport } from './transports/types';

/**
 * Production-grade HTTP client with circuit breaker and retries.
 *
 * Usage:
 * ```typescript
 * const client = new HttpClient({
 *   baseUrl: 'https://api.example.com',
 *   timeoutMs: 5000,
 *   retries: 3,
 *   logger: myLogger,
 * });
 *
 * try {
 *   const response = await client.get('/users/123');
 *   console.log(response.data);
 * } catch (error) {
 *   console.error(errorToLogObject(error));
 * } finally {
 *   await client.close();
 * }
 * ```
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly headers: RequestHeaders;
  private readonly logger: Logger;
  private readonly logResponseBody: boolean;
  private readonly maxLogBodyLength: number;
  private readonly backoff: BackoffConfig;
  private readonly circuitBreaker: CircuitBreakerState;
  private readonly transportOptions: HttpTransportOptions;
  private transport: HttpTransport;

  /**
   * Initialize HTTP client with configuration.
   *
   * @throws {AppError} If baseUrl is not provided
   */
  constructor(options: HttpClientOptions) {
    if (!options.baseUrl) {
      throw new AppError('baseUrl is required', {
        code: 'INVALID_CONFIG',
      });
    }

    this.baseUrl = options.baseUrl;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.retries = options.retries ?? 0;
    this.headers = options.headers ?? {};
    this.logger =
      options.logger instanceof HttpClientLogger
        ? options.logger
        : new HttpClientLogger(options.logger ?? console);
    this.logResponseBody = options.logResponseBody ?? true;
    this.maxLogBodyLength = options.maxLogBodyLength ?? 2000;
    this.backoff = {
      baseMs: options.backoff?.baseMs ?? 50,
      maxMs: options.backoff?.maxMs ?? 1000,
    };
    this.transportOptions = {
      mode: options.transport?.mode ?? 'auto',
      fallbackToFetchOnUndiciError:
        options.transport?.fallbackToFetchOnUndiciError ?? true,
      undici: options.transport?.undici,
    };
    this.transport = createTransport(this.transportOptions);

    // Initialize circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      state: 'CLOSED',
      openedAt: 0,
      ...this.getDefaultCircuitBreakerConfig(),
      ...(options.circuitBreaker ?? {}),
    };
  }

  /**
   * Perform GET request (no request body).
   *
   * @param path - URL path relative to baseUrl
   * @param options - Request options (query, headers, timeout)
   * @returns Promise resolving to HttpSuccess with parsed response data
   */
  async get<T = unknown>(
    path: string,
    options?: RequestOptions
  ): Promise<HttpSuccess<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * Perform POST request with JSON body.
   *
   * @param path - URL path relative to baseUrl
   * @param body - Request body (will be JSON stringified)
   * @param options - Request options (query, headers, timeout)
   * @returns Promise resolving to HttpSuccess with parsed response data
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<HttpSuccess<T>> {
    return this.request<T>('POST', path, body, options);
  }

  /**
   * Perform PUT request with JSON body.
   */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<HttpSuccess<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  /**
   * Perform PATCH request with JSON body.
   */
  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<HttpSuccess<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  /**
   * Perform DELETE request.
   */
  async delete<T = unknown>(
    path: string,
    options?: RequestOptions
  ): Promise<HttpSuccess<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Perform HEAD request (no response body).
   */
  async head(path: string, options?: RequestOptions): Promise<HttpSuccess<null>> {
    return this.request<null>('HEAD', path, undefined, options);
  }

  /**
   * Core request handler with retries and circuit breaker.
   * Implements retry loop with exponential backoff and circuit breaker checks.
   *
   * @internal
   */
  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<HttpSuccess<T>> {
    // Circuit breaker check
    if (!this.circuitAllowsRequest()) {
      logCircuitBreakerBlocked(this.logger, {
        method,
        path,
        baseUrl: this.baseUrl,
      });
      throw new CircuitOpenError();
    }

    const url = buildUrl(this.baseUrl, path, options.query);
    const headers = { ...this.headers, ...(options.headers ?? {}) };
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const requestId = options.requestId ?? createRequestId();
    const startedAt = Date.now();

    let attempt = 0;

    // Log request start
    logRequestStart(
      this.logger,
      {
        requestId,
        method,
        path,
        url,
        query: filterQuery(options.query),
        headers: redactHeaders(headers),
        body,
        timeoutMs,
        retries: this.retries,
      },
      this.maxLogBodyLength
    );

    // Retry loop
    while (true) {
      try {
        const result = await this.performRequest<T>(
          method,
          url,
          headers,
          body,
          timeoutMs
        );

        // Log success
        logRequestSuccess(
          this.logger,
          {
            requestId,
            method,
            path,
            url,
            attempt,
            statusCode: result.statusCode,
            durationMs: Date.now() - startedAt,
            responseBody: this.logResponseBody
              ? result.response.data
              : '[disabled]',
          },
          this.maxLogBodyLength
        );

        // Update circuit breaker on success
        this.onSuccess();

        return result.response;
      } catch (error) {
        // Update circuit breaker on failure
        this.onFailure(error);

        const willRetry =
          attempt < this.retries && isRetriableError(error);

        // Log error
        logRequestError(
          this.logger,
          {
            requestId,
            method,
            path,
            url,
            attempt,
            durationMs: Date.now() - startedAt,
            error: errorToLogObject(error),
          },
          willRetry,
          this.maxLogBodyLength
        );

        if (!willRetry) {
          throw error;
        }

        // Calculate backoff delay
        const delayMs = computeBackoff(
          attempt,
          this.backoff.baseMs,
          this.backoff.maxMs
        );

        logRetryScheduled(
          this.logger,
          {
            requestId,
            method,
            path,
            url,
            attempt,
            nextAttempt: attempt + 1,
            delayMs: Math.round(delayMs),
          },
          this.maxLogBodyLength
        );

        await sleep(delayMs);
        attempt++;
      }
    }
  }

  /**
   * Perform single HTTP request using fetch API.
   * Handles timeouts, response parsing, and error conversion.
   *
   * @internal
   */
  private async performRequest<T = unknown>(
    method: string,
    url: string,
    headers: RequestHeaders,
    body?: unknown,
    timeoutMs?: number
  ): Promise<{ response: HttpSuccess<T>; statusCode: number }> {
    const controller = new AbortController();
    let timeoutHandle: NodeJS.Timeout | null = null;
    let didTimeout = false;

    try {
      // Set request timeout
      if (timeoutMs && timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          didTimeout = true;
          controller.abort();
        }, timeoutMs);
      }

      // Perform fetch request
      const response = await this.sendWithTransportFallback({
        method,
        url,
        headers,
        body,
        signal: controller.signal,
        timeoutMs,
      });

      // Parse response
      const contentType = this.getHeaderValue(response.headers, 'content-type');
      const responseType = getResponseType(contentType ?? undefined);

      let data: unknown;
      if (responseType === 'json') {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle error status codes
      if (response.status >= 400) {
        const normalizedError = normalizeErrorResponse(
          data,
          response.statusText || `HTTP ${response.status}`,
          `HTTP_${response.status}`
        );

        throw new HttpError(`HTTP ${response.status}`, {
          status: response.status,
          responseBody: data,
          response: normalizedError,
          code: `HTTP_${response.status}`,
        });
      }

      const normalizedSuccess = normalizeSuccessResponse<T>(
        data,
        response.statusText || 'Success'
      );

      // Return success response
      return {
        response: new HttpSuccess(normalizedSuccess),
        statusCode: response.status,
      };
    } catch (error) {
      // Convert fetch errors to appropriate error types
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof TypeError) {
        const message = error.message.toLowerCase();

        if (message.includes('abort')) {
          if (didTimeout) {
            throw new TimeoutError(timeoutMs ?? 0);
          }
          throw new AbortError();
        }

        throw new NetworkError(error);
      }

      if (this.isAbortLikeError(error)) {
        if (didTimeout) {
          throw new TimeoutError(timeoutMs ?? 0);
        }
        throw new AbortError();
      }

      if (this.isUndiciLikeError(error)) {
        throw new NetworkError(error as Error);
      }

      // Re-throw app errors
      if (error instanceof AppError) {
        throw error;
      }

      // Wrap unknown errors
      throw new AppError(String(error), {
        code: 'UNKNOWN_ERROR',
        cause: error instanceof Error ? error : undefined,
      });
    } finally {
      // Clear timeout
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private getHeaderValue(
    headers: Record<string, string | string[] | undefined>,
    key: string
  ): string | string[] | undefined {
    const target = key.toLowerCase();
    for (const [name, value] of Object.entries(headers)) {
      if (name.toLowerCase() === target) {
        return value;
      }
    }
    return undefined;
  }

  private async sendWithTransportFallback(input: {
    method: string;
    url: string;
    headers: RequestHeaders;
    body?: unknown;
    signal: AbortSignal;
    timeoutMs?: number;
  }) {
    try {
      return await this.transport.send(input);
    } catch (error) {
      if (!this.shouldFallbackToFetch(error)) {
        throw error;
      }

      this.transport = createTransport({ mode: 'fetch' });

      this.#log('warn', 'Undici unavailable, falling back to fetch transport', {
        error: errorToLogObject(error),
      });

      return this.transport.send(input);
    }
  }

  private shouldFallbackToFetch(error: unknown): boolean {
    if (this.transport.kind !== 'undici') {
      return false;
    }

    if (this.transportOptions.mode !== 'auto') {
      return false;
    }

    if (!this.transportOptions.fallbackToFetchOnUndiciError) {
      return false;
    }

    return (
      error instanceof AppError &&
      error.code === 'UNDICI_NOT_AVAILABLE'
    );
  }

  private isAbortLikeError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const code = String((error as { code?: unknown }).code ?? '');
    const message = error.message.toLowerCase();

    return (
      error.name === 'AbortError' ||
      code === 'UND_ERR_ABORTED' ||
      message.includes('aborted') ||
      message.includes('abort')
    );
  }

  private isUndiciLikeError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
      return false;
    }

    const code = String((error as { code?: unknown }).code ?? '');
    return code.startsWith('UND_ERR_');
  }

  #log(level: 'debug' | 'info' | 'warn' | 'error', message: string, payload: unknown): void {
    const logFn =
      this.logger && typeof this.logger[level] === 'function'
        ? this.logger[level]?.bind(this.logger)
        : console.log;

    logFn?.(
      `[HttpClient] ${message}`,
      sanitizeForLog(payload, this.maxLogBodyLength)
    );
  }

  /**
   * Check if circuit breaker allows request.
   * Implements probabilistic half-open state for gradual recovery.
   *
   * @internal
   */
  private circuitAllowsRequest(): boolean {
    const now = Date.now();

    // CLOSED state: always allow
    if (this.circuitBreaker.state === 'CLOSED') {
      return true;
    }

    // OPEN state: reject until timeout elapses, then transition to HALF_OPEN.
    if (this.circuitBreaker.state === 'OPEN') {
      if (now - this.circuitBreaker.openedAt < this.circuitBreaker.openTimeoutMs) {
        return false;
      }

      this.circuitBreaker.state = 'HALF_OPEN';
    }

    // HALF_OPEN state: allow some requests probabilistically.
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      return Math.random() < this.circuitBreaker.halfOpenSuccessRate;
    }

    // Fallback: reject for unexpected state.
    return false;
  }

  /**
   * Handle successful request.
   * Resets failure counter and closes circuit if open.
   *
   * @internal
   */
  private onSuccess(): void {
    if (this.circuitBreaker.state !== 'CLOSED') {
      this.circuitBreaker.state = 'CLOSED';
    }
    this.circuitBreaker.failures = 0;
  }

  /**
   * Handle failed request.
   * Increments failure counter and opens circuit if threshold reached.
   * Only counts real errors, not client errors.
   *
   * @internal
   */
  private onFailure(error: unknown): void {
    // Don't count circuit open errors or 4xx client errors
    if (error instanceof CircuitOpenError) {
      return;
    }

    if (error instanceof HttpError && error.status < 500) {
      return;
    }

    // Any probe failure while HALF_OPEN immediately reopens circuit.
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.openedAt = Date.now();
      this.circuitBreaker.failures = this.circuitBreaker.failureThreshold;
      return;
    }

    this.circuitBreaker.failures++;

    // Open circuit if threshold reached
    if (this.circuitBreaker.failures >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.openedAt = Date.now();
    }
  }

  /**
   * Get circuit breaker configuration defaults.
   *
   * @internal
   */
  private getDefaultCircuitBreakerConfig(): CircuitBreakerConfig {
    return {
      failureThreshold: 5,
      openTimeoutMs: 10_000,
      halfOpenSuccessRate: 0.1,
    };
  }

  /**
   * Close HTTP client and cleanup resources.
   * Should be called when client is no longer needed.
   */
  async close(): Promise<void> {
    await this.transport.close();

    if (this.logger.debug) {
      this.logger.debug('HttpClient closed');
    }
  }

  /**
   * Get current circuit breaker state (for monitoring/debugging).
   */
  getCircuitBreakerState(): Readonly<CircuitBreakerState> {
    return Object.freeze({ ...this.circuitBreaker });
  }
}

export default HttpClient;
