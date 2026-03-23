/**
 * HTTP Response Wrapper
 * =====================
 *
 * Provides a clean, type-safe wrapper around HTTP responses.
 * Enables consistent response handling across different response types.
 */

import type {
  ApiErrorDetail,
  ApiErrorObject,
  ApiResponse,
  HttpResponse,
} from './types';

const DEFAULT_SUCCESS_MESSAGE = 'Success';
const DEFAULT_ERROR_MESSAGE = 'Request failed';

/**
 * HTTP Success response wrapper.
 * Provides consistent interface for successful HTTP responses.
 *
 * @template T - Type of response data
 */
export class HttpSuccess<T = unknown> implements HttpResponse<T> {
  readonly message: string;
  readonly data: T | null;
  readonly meta: Record<string, unknown>;
  readonly error: ApiErrorObject | null;

  constructor(payload: ApiResponse<T>) {
    this.message = payload.message;
    this.data = payload.data;
    this.meta = payload.meta;
    this.error = payload.error;
  }

  /**
   * Return data as resolved Promise for async compatibility.
   * Useful for request handlers that expect Promise-based responses.
   */
  json(): Promise<ApiResponse<T>> {
    return Promise.resolve({
      message: this.message,
      data: this.data,
      meta: this.meta,
      error: this.error,
    });
  }

  /**
   * Return data as string for text-based responses.
   */
  text(): Promise<string> {
    return Promise.resolve(
      JSON.stringify({
        message: this.message,
        data: this.data,
        meta: this.meta,
        error: this.error,
      })
    );
  }
}

export function normalizeSuccessResponse<T = unknown>(
  input: unknown,
  fallbackMessage: string = DEFAULT_SUCCESS_MESSAGE
): ApiResponse<T> {
  if (isApiResponseShape(input) && input.error === null) {
    return {
      message: input.message,
      data: (input.data ?? null) as T | null,
      meta: isRecord(input.meta) ? input.meta : {},
      error: null,
    };
  }

  return {
    message: fallbackMessage,
    data: (input ?? null) as T | null,
    meta: {},
    error: null,
  };
}

export function normalizeErrorResponse(
  input: unknown,
  fallbackMessage: string = DEFAULT_ERROR_MESSAGE,
  fallbackCode?: string
): ApiResponse<null> {
  if (isApiResponseShape(input) && isRecord(input.error)) {
    const responderError = input.error as ApiErrorObject;
    return {
      message: input.message || responderError.message || fallbackMessage,
      data: null,
      meta: isRecord(input.meta) ? input.meta : {},
      error: {
        ...responderError,
        message: responderError.message || input.message || fallbackMessage,
        ...(fallbackCode && !responderError.code ? { code: fallbackCode } : {}),
      },
    };
  }

  if (isRecord(input) && isRecord(input.error)) {
    const nested = input.error as Record<string, unknown>;
    const message =
      (typeof nested.message === 'string' && nested.message) ||
      (typeof input.message === 'string' && input.message) ||
      fallbackMessage;

    return {
      message,
      data: null,
      meta: isRecord(input.meta) ? input.meta : {},
      error: {
        ...(nested as ApiErrorObject),
        message,
        ...(fallbackCode && !nested.code ? { code: fallbackCode } : {}),
        details: normalizeDetails(nested.details),
      },
    };
  }

  if (typeof input === 'string' && input) {
    return {
      message: input,
      data: null,
      meta: {},
      error: {
        code: fallbackCode,
        message: input,
        details: [],
      },
    };
  }

  return {
    message: fallbackMessage,
    data: null,
    meta: {},
    error: {
      code: fallbackCode,
      message: fallbackMessage,
      details: [],
    },
  };
}

/**
 * Parse content-type header to determine response format.
 * Handles various content-type formats.
 *
 * @param contentType - Content-Type header value
 * @returns Type: 'json' | 'text' | 'other'
 */
export function getResponseType(
  contentType: string | string[] | undefined
): 'json' | 'text' | 'other' {
  if (!contentType) return 'text';

  const type = Array.isArray(contentType) ? contentType[0] : contentType;
  const normalized = type.toLowerCase();

  if (
    normalized.includes('application/json') ||
    normalized.includes('application/ld+json')
  ) {
    return 'json';
  }

  if (normalized.includes('text')) {
    return 'text';
  }

  return 'other';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isApiResponseShape(value: unknown): value is ApiResponse {
  if (!isRecord(value)) {
    return false;
  }

  const hasMessage = typeof value.message === 'string';
  const hasData = 'data' in value;
  const hasMeta = isRecord(value.meta);
  const hasError = value.error === null || isRecord(value.error);

  return hasMessage && hasData && hasMeta && hasError;
}

function normalizeDetails(details: unknown): ApiErrorDetail[] {
  if (!Array.isArray(details)) {
    return [];
  }

  return details
    .filter((detail) => isRecord(detail) && typeof detail.issue === 'string')
    .map((detail) => detail as ApiErrorDetail);
}
