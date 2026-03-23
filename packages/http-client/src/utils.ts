/**
 * HTTP Client Utility Functions
 * =============================
 *
 * Helper functions for retry logic, backoff, request ID generation,
 * header redaction, and safe body reading.
 */

import type { QueryParams, RequestHeaders } from './types';

/**
 * Determine if error should trigger a retry.
 * Checks HTTP status codes and error types.
 *
 * @param statusCode - HTTP status code to check
 * @param isNetworkError - Whether this is a network-level error
 * @returns True if request should be retried
 */
export function isRetryAllowedStatus(
  statusCode: number | undefined,
  isNetworkError: boolean = false
): boolean {
  if (isNetworkError) {
    return true;
  }

  if (!statusCode) {
    return false;
  }

  // Retry 5xx server errors
  if (statusCode >= 500) {
    return true;
  }

  // Retry specific 4xx errors that are idempotent-safe
  const retryableStatuses = [408, 429]; // Request Timeout, Too Many Requests
  return retryableStatuses.includes(statusCode);
}

/**
 * Compute exponential backoff with jitter.
 * Strategy: 2^attempt * baseMs, capped at maxMs, with ±50% random jitter.
 *
 * Uses jitter to prevent thundering herd problem in distributed scenarios.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseMs - Base milliseconds for exponential calculation
 * @param maxMs - Maximum milliseconds to wait
 * @returns Milliseconds to wait before next retry
 */
export function computeBackoff(
  attempt: number,
  baseMs: number,
  maxMs: number
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxMs);
  // Apply jitter: random between 50% and 150% of capped value (±50%)
  return capped * (0.5 + Math.random());
}

/**
 * Sleep for specified milliseconds.
 * Utility for retry delays and scheduling.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Create unique request ID for tracing.
 * Format: timestamp-randomSuffix for both uniqueness and readability.
 *
 * @returns Unique request identifier
 */
export function createRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Filter query parameters, removing zero/falsy values.
 * Converts all values to strings for URLSearchParams compatibility.
 *
 * Filters out:
 * - null, undefined
 * - empty string
 * - 0 (numeric zero)
 * - false (boolean false)
 *
 * @param query - Query parameters to filter
 * @returns Filtered and stringified query object
 */
export function filterQuery(query?: QueryParams): QueryParams | undefined {
  if (!query || typeof query !== 'object') {
    return undefined;
  }

  const filtered: QueryParams = {};

  for (const [key, value] of Object.entries(query)) {
    // Filter zero-values: null, undefined, empty string, 0, false
    if (value === null || value === undefined || value === '' || value === 0 || value === false) {
      continue;
    }

    filtered[key] = String(value);
  }

  // Return undefined if no values remain
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

/**
 * Redact sensitive headers for safe logging.
 * Protects secrets in logs while preserving other header information.
 *
 * Redacts:
 * - Authorization, Cookie, Token headers
 * - API keys, secrets, passwords
 *
 * @param headers - Headers to redact
 * @returns Headers with sensitive values masked
 */
export function redactHeaders(
  headers?: RequestHeaders
): RequestHeaders | undefined {
  if (!headers || typeof headers !== 'object') {
    return headers;
  }

  const redacted: RequestHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    if (isSensitiveHeaderKey(key)) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Check if header key contains sensitive information.
 * Case-insensitive pattern matching.
 *
 * @param key - Header key to check
 * @returns True if header contains sensitive data
 */
export function isSensitiveHeaderKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  const normalized = key.toLowerCase();

  return (
    normalized.includes('authorization') ||
    normalized.includes('cookie') ||
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized.includes('api-key') ||
    normalized.includes('apikey') ||
    normalized.includes('x-api-key') ||
    normalized.includes('x-auth')
  );
}

/**
 * Sanitize values for logging, truncating large strings and redacting sensitive data.
 * Handles nested objects and arrays with depth limit to prevent stack overflow.
 *
 * Configuration:
 * - Truncates strings longer than maxLen
 * - Stops recursion at depth > 5
 * - Redacts sensitive keys
 *
 * @param value - Value to sanitize
 * @param maxLen - Maximum string length before truncation
 * @param depth - Current recursion depth
 * @returns Sanitized value safe for logging
 */
export function sanitizeForLog(
  value: unknown,
  maxLen: number,
  depth: number = 0
): unknown {
  // Base cases
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > 5) {
    return '[MaxDepthExceeded]';
  }

  // String truncation
  if (typeof value === 'string') {
    return value.length > maxLen
      ? `${value.slice(0, maxLen)}...[truncated]`
      : value;
  }

  // Primitive types
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  // Array recursion
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, maxLen, depth + 1));
  }

  // Object recursion with sensitive key redaction
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      if (isSensitiveHeaderKey(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = sanitizeForLog(val, maxLen, depth + 1);
      }
    }

    return output;
  }

  // Default: convert to string
  return String(value);
}

/**
 * Build full URL from base URL and path.
 * Handles query parameters and ensures valid URL construction.
 *
 * @param baseUrl - Base URL (must be valid absolute URL)
 * @param path - Path to append (with or without leading slash)
 * @param query - Query parameters to append
 * @returns Complete URL as string
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  query?: QueryParams
): string {
  // Normalize path to a relative segment (no leading slash) so we don't
  // discard any pathname present in baseUrl.
  const relativePath = path.replace(/^\/+/, '');

  // Ensure baseUrl is treated as a "directory" URL so existing path
  // segments are preserved when appending the relative path.
  const baseForJoin = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  // Build base URL with path
  const url = new URL(relativePath, baseForJoin);

  // Append query parameters
  const filteredQuery = filterQuery(query);
  if (filteredQuery) {
    const params = new URLSearchParams(filteredQuery as Record<string, string>);
    url.search = params.toString();
  }

  return url.toString();
}

/**
 * Delay execution for testing and utility purposes.
 * More precise than setTimeout for test timing.
 *
 * @param ms - Milliseconds to delay
 * @param callback - Optional callback to execute after delay
 * @returns Promise that resolves after delay
 */
export async function delay(ms: number, callback?: () => void): Promise<void> {
  return sleep(ms).then(() => {
    callback?.();
  });
}
