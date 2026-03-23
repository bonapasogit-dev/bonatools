/**
 * HTTP Client Public API
 * ======================
 *
 * Main entry point exporting all public types and classes.
 */

// Core client
export { HttpClient } from './httpClient';
export { default } from './httpClient';

// Error classes and utilities
export {
  AppError,
  HttpError,
  CircuitOpenError,
  TimeoutError,
  AbortError,
  NetworkError,
  errorToLogObject,
  isRetriableError,
} from './errors';

// Response wrapper
export {
  HttpSuccess,
  getResponseType,
  normalizeSuccessResponse,
  normalizeErrorResponse,
} from './response';

// Logger
export { HttpClientLogger } from './logger';

// Utility functions
export {
  isRetryAllowedStatus,
  computeBackoff,
  sleep,
  createRequestId,
  filterQuery,
  redactHeaders,
  sanitizeForLog,
  buildUrl,
  delay,
} from './utils';

// Types
export type {
  ApiMeta,
  ApiErrorDetail,
  ApiErrorObject,
  ApiResponse,
  Logger,
  ErrorMetadata,
  AppErrorOptions,
  HttpErrorOptions,
  ErrorLogObject,
  CircuitBreakerConfig,
  BackoffConfig,
  QueryParams,
  RequestHeaders,
  RequestOptions,
  TransportMode,
  NodeUndiciOptions,
  HttpTransportOptions,
  HttpClientOptions,
  CircuitBreakerState,
  UndiciResponse,
  UndiciReadable,
  HttpLogContext,
  HttpResponse,
} from './types';
