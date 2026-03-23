/**
 * HTTP Client Core Types
 * =====================
 *
 * Production-grade type definitions for HTTP client with comprehensive
 * circuit breaker, retry, and error handling capabilities.
 */

/**
 * Logger interface compatible with console and custom loggers.
 * Supports standard log levels: info, warn, error, debug.
 */
export interface Logger {
  info(message?: unknown, ...args: unknown[]): void;
  warn(message?: unknown, ...args: unknown[]): void;
  error(message?: unknown, ...args: unknown[]): void;
  debug?(message?: unknown, ...args: unknown[]): void;
}

/**
 * Error metadata object for structured error tracking.
 * Extended to support domain-specific error details.
 */
export interface ErrorMetadata extends Record<string, unknown> {
  status?: number;
  traceId?: string;
  attemptNumber?: number;
}

export type ApiMeta = Record<string, unknown>;

export interface ApiErrorDetail {
  field?: string;
  issue: string;
  [key: string]: unknown;
}

export interface ApiErrorObject {
  code?: string;
  message: string;
  details?: ApiErrorDetail[];
  traceId?: string;
  [key: string]: unknown;
}

export interface ApiResponse<TData = unknown> {
  message: string;
  data: TData | null;
  meta: ApiMeta;
  error: ApiErrorObject | null;
}

/**
 * Options for creating application-level errors.
 */
export interface AppErrorOptions {
  name?: string;
  code?: string;
  cause?: Error;
  metadata?: ErrorMetadata;
}

/**
 * Options for creating HTTP-specific errors.
 */
export interface HttpErrorOptions extends AppErrorOptions {
  status: number;
  responseBody?: unknown;
  response?: ApiResponse;
}

/**
 * Serializable error object for logging.
 */
export interface ErrorLogObject {
  name: string;
  message: string;
  code?: string;
  status?: number;
  responseBody?: unknown;
  response?: ApiResponse;
  metadata?: ErrorMetadata;
  cause?: unknown;
  stack?: string;
}

/**
 * Circuit breaker configuration.
 * Prevents cascading failures by stopping requests when failure threshold is reached.
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Milliseconds to wait before attempting to half-open */
  openTimeoutMs: number;
  /** Probability of allowing request through in half-open state (0-1) */
  halfOpenSuccessRate: number;
}

/**
 * Backoff strategy configuration for retries.
 * Uses exponential backoff with jitter for optimal retry behavior.
 */
export interface BackoffConfig {
  /** Base milliseconds for exponential backoff calculation */
  baseMs: number;
  /** Maximum milliseconds to wait between retries */
  maxMs: number;
}

/**
 * Query parameters object.
 * Values are stringified and falsy values are filtered.
 */
export interface QueryParams extends Record<string, unknown> {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * HTTP request headers dictionary.
 */
export interface RequestHeaders extends Record<string, string> {
  [key: string]: string;
}

/**
 * HTTP request options for individual requests.
 * Override constructor defaults.
 */
export interface RequestOptions {
  /** Query parameters to append to URL */
  query?: QueryParams;
  /** Override default headers for this request */
  headers?: RequestHeaders;
  /** Override default timeout for this request */
  timeoutMs?: number;
  /** Custom request ID for tracing */
  requestId?: string;
}

export type TransportMode = 'auto' | 'fetch' | 'undici';

export interface NodeUndiciOptions {
  connections?: number;
  pipelining?: number;
  keepAliveTimeout?: number;
  keepAliveMaxTimeout?: number;
  headersTimeout?: number;
  bodyTimeout?: number;
}

export interface HttpTransportOptions {
  /** Runtime transport mode. auto prefers undici on Node.js and fetch elsewhere. */
  mode?: TransportMode;
  /** Fallback to fetch when undici is unavailable in auto mode. */
  fallbackToFetchOnUndiciError?: boolean;
  /** Node-specific undici tuning options. */
  undici?: NodeUndiciOptions;
}

/**
 * HTTP Client constructor options.
 * Comprehensive configuration for behavior, performance, and reliability.
 */
export interface HttpClientOptions {
  /** Base URL for all requests (absolute URL required) */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Maximum number of automatic retries (default: 0) */
  retries?: number;
  /** Default headers sent with every request */
  headers?: RequestHeaders;
  /** Logger instance (default: console) */
  logger?: Logger;
  /** Log response bodies in success logs (default: true) */
  logResponseBody?: boolean;
  /** Maximum length of logged response bodies (default: 2000) */
  maxLogBodyLength?: number;
  /**
   * @deprecated This option is not used. Configure maximum concurrent connections via `transport.undici.connections`.
   * @see HttpTransportOptions
   */
  maxConnections?: number;
  /**
   * @deprecated This option is not used. Configure HTTP pipelining depth via `transport.undici.pipelining`.
   * @see HttpTransportOptions
   */
  pipelining?: number;
  /** Backoff strategy configuration */
  backoff?: BackoffConfig;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  /** Transport selection and performance tuning options */
  transport?: HttpTransportOptions;
}

/**
 * Internal circuit breaker state.
 */
export interface CircuitBreakerState extends CircuitBreakerConfig {
  failures: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  openedAt: number;
}

/**
 * Undici Response-like interface for type safety.
 */
export interface UndiciResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: UndiciReadable;
}

/**
 * Undici readable body interface.
 */
export interface UndiciReadable {
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * HTTP Client log context for structured logging.
 */
export interface HttpLogContext extends Record<string, unknown> {
  requestId: string;
  method: string;
  path: string;
  url: string;
  attempt?: number;
  statusCode?: number;
  durationMs?: number;
  error?: ErrorLogObject;
  willRetry?: boolean;
  query?: QueryParams;
  headers?: RequestHeaders;
  body?: unknown;
  responseBody?: unknown;
  delayMs?: number;
}

/**
 * Success response wrapper.
 */
export type HttpResponse<T = unknown> = ApiResponse<T>;
