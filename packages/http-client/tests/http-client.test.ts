/**
 * HTTP Client Unit Tests
 * ======================
 *
 * Comprehensive test coverage for HTTP client functionality using Vitest.
 * Tests cover: error classes, utilities, response wrapper, client logic,
 * circuit breaker, retries, and logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HttpClient from '../src/httpClient';
import {
  AppError,
  HttpError,
  CircuitOpenError,
  TimeoutError,
  NetworkError,
  AbortError,
  errorToLogObject,
  isRetriableError,
} from '../src/errors';
import {
  HttpSuccess,
  getResponseType,
  normalizeErrorResponse,
  normalizeSuccessResponse,
} from '../src/response';
import {
  isRetryAllowedStatus,
  computeBackoff,
  sleep,
  createRequestId,
  filterQuery,
  redactHeaders,
  sanitizeForLog,
  buildUrl,
} from '../src/utils';
import type { Logger, RequestHeaders, QueryParams } from '../src/types';

/** ============================================================
 *  ERROR CLASSES
 *  ============================================================ */

describe('AppError', () => {
  it('should create error with default name', () => {
    const error = new AppError('Test error');
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('Test error');
    expect(error).toBeInstanceOf(Error);
  });

  it('should create error with custom name and code', () => {
    const error = new AppError('Test error', {
      name: 'CustomError',
      code: 'CUSTOM_CODE',
    });
    expect(error.name).toBe('CustomError');
    expect(error.code).toBe('CUSTOM_CODE');
  });

  it('should create error with metadata', () => {
    const metadata = { userId: 123, traceId: 'abc' };
    const error = new AppError('Test error', { metadata });
    expect(error.metadata).toEqual(metadata);
  });

  it('should serialize to log object', () => {
    const error = new AppError('Test error', {
      code: 'TEST_CODE',
      metadata: { key: 'value' },
    });
    const logObj = error.toLogObject();
    expect(logObj.name).toBe('AppError');
    expect(logObj.message).toBe('Test error');
    expect(logObj.code).toBe('TEST_CODE');
    expect(logObj.metadata).toEqual({ key: 'value' });
  });
});

describe('HttpError', () => {
  it('should create HTTP error with status code', () => {
    const error = new HttpError('Not Found', {
      status: 404,
      responseBody: { error: 'not found' },
    });
    expect(error.status).toBe(404);
    expect(error.name).toBe('HttpError');
    expect(error.code).toBe('HTTP_ERROR');
  });

  it('should serialize to log object with HTTP details', () => {
    const responseBody = { error: 'not found' };
    const error = new HttpError('Not Found', {
      status: 404,
      responseBody,
    });
    const logObj = error.toLogObject();
    expect(logObj.status).toBe(404);
    expect(logObj.responseBody).toEqual(responseBody);
  });

  it('should support custom HTTP error code', () => {
    const error = new HttpError('Server Error', {
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(error.code).toBe('INTERNAL_ERROR');
  });
});

describe('CircuitOpenError', () => {
  it('should create circuit open error', () => {
    const error = new CircuitOpenError();
    expect(error.name).toBe('CircuitOpenError');
    expect(error.message).toBe('Circuit breaker is open');
    expect(error.code).toBe('CIRCUIT_OPEN');
  });
});

describe('TimeoutError', () => {
  it('should create timeout error with duration', () => {
    const error = new TimeoutError(5000);
    expect(error.name).toBe('TimeoutError');
    expect(error.durationMs).toBe(5000);
    expect(error.message).toContain('5000');
  });
});

describe('NetworkError', () => {
  it('should wrap network error with original cause', () => {
    const originalError = new Error('ECONNREFUSED');
    const error = new NetworkError(originalError);
    expect(error.name).toBe('NetworkError');
    expect(error.originalError).toBe(originalError);
  });
});

describe('errorToLogObject', () => {
  it('should handle null/undefined error', () => {
    const logObj = errorToLogObject(null);
    expect(logObj.name).toBe('UnknownError');
    expect(logObj.message).toBe('Unknown error');
  });

  it('should handle AppError', () => {
    const error = new AppError('Test', { code: 'TEST' });
    const logObj = errorToLogObject(error);
    expect(logObj.name).toBe('AppError');
    expect(logObj.code).toBe('TEST');
  });

  it('should handle plain Error', () => {
    const error = new Error('Plain error');
    const logObj = errorToLogObject(error);
    expect(logObj.name).toBe('Error');
    expect(logObj.message).toBe('Plain error');
  });

  it('should handle string error', () => {
    const logObj = errorToLogObject('string error');
    expect(logObj.name).toBe('UnknownError');
    expect(logObj.message).toBe('string error');
  });
});

describe('isRetriableError', () => {
  it('should not retry CircuitOpenError', () => {
    const error = new CircuitOpenError();
    expect(isRetriableError(error)).toBe(false);
  });

  it('should retry 5xx HTTP errors', () => {
    const error = new HttpError('Server Error', {
      status: 500,
    });
    expect(isRetriableError(error)).toBe(true);
  });

  it('should not retry 4xx HTTP errors', () => {
    const error = new HttpError('Not Found', {
      status: 404,
    });
    expect(isRetriableError(error)).toBe(false);
  });

  it('should retry TimeoutError', () => {
    const error = new TimeoutError(5000);
    expect(isRetriableError(error)).toBe(true);
  });

  it('should retry NetworkError', () => {
    const error = new NetworkError(new Error('ECONNREFUSED'));
    expect(isRetriableError(error)).toBe(true);
  });
});

/** ============================================================
 *  UTILITY FUNCTIONS
 *  ============================================================ */

describe('isRetryAllowedStatus', () => {
  it('should retry on network error', () => {
    expect(isRetryAllowedStatus(undefined, true)).toBe(true);
  });

  it('should retry 5xx errors', () => {
    expect(isRetryAllowedStatus(500)).toBe(true);
    expect(isRetryAllowedStatus(503)).toBe(true);
  });

  it('should retry 408 and 429', () => {
    expect(isRetryAllowedStatus(408)).toBe(true);
    expect(isRetryAllowedStatus(429)).toBe(true);
  });

  it('should not retry 4xx errors', () => {
    expect(isRetryAllowedStatus(404)).toBe(false);
    expect(isRetryAllowedStatus(400)).toBe(false);
  });

  it('should not retry 2xx/3xx errors', () => {
    expect(isRetryAllowedStatus(200)).toBe(false);
    expect(isRetryAllowedStatus(301)).toBe(false);
  });
});

describe('computeBackoff', () => {
  it('should compute exponential backoff', () => {
    const base = 50;
    const max = 1000;
    const delay0 = computeBackoff(0, base, max);
    const delay1 = computeBackoff(1, base, max);
    const delay2 = computeBackoff(2, base, max);

    // With jitter (0.5 + random [0-1]), values can range from 50% to 150% of cap
    expect(delay0).toBeGreaterThanOrEqual(base * 0.5);
    expect(delay0).toBeLessThanOrEqual(base * 1.5);
    
    expect(delay1).toBeGreaterThanOrEqual(base * 0.5);
    expect(delay1).toBeLessThanOrEqual(base * 2 * 1.5);
    
    expect(delay2).toBeGreaterThanOrEqual(base * 0.5);
    expect(delay2).toBeLessThanOrEqual(base * 4 * 1.5);
  });

  it('should cap backoff at max value', () => {
    const base = 50;
    const max = 100;
    const delay = computeBackoff(10, base, max);
    // Delay is capped at max, then jitter applied: max * (0.5 to 1.5)
    expect(delay).toBeGreaterThanOrEqual(max * 0.5);
    expect(delay).toBeLessThanOrEqual(max * 1.5);
  });

  it('should add jitter', () => {
    const base = 100;
    const max = 200;
    const delays = Array.from({ length: 100 }, (_, i) =>
      computeBackoff(0, base, max)
    );

    // Check that delays vary (jitter is working)
    const unique = new Set(delays).size;
    expect(unique).toBeGreaterThan(50);

    // Check all are within range (base is capped at max, then jitter: 0.5 to 1.5x)
    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(base * 0.5);
      expect(delay).toBeLessThanOrEqual(base * 1.5);
    });
  });
});

describe('sleep', () => {
  it('should resolve after specified milliseconds', async () => {
    const start = Date.now();
    await sleep(100);
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(90);
    expect(duration).toBeLessThan(200);
  });
});

describe('createRequestId', () => {
  it('should create unique request IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(createRequestId());
    }
    expect(ids.size).toBe(100);
  });

  it('should create readable request IDs', () => {
    const id = createRequestId();
    expect(id).toMatch(/^\d+-[a-z0-9]+$/);
  });
});

describe('filterQuery', () => {
  it('should filter falsy values', () => {
    const query: QueryParams = {
      name: 'John',
      age: 30,
      empty: '',
      zero: 0,
      nothing: null,
      undef: undefined,
      false: false,
    };
    const filtered = filterQuery(query);
    expect(filtered).toEqual({
      name: 'John',
      age: '30',
    });
  });

  it('should return undefined for empty query', () => {
    expect(filterQuery({})).toBeUndefined();
    expect(filterQuery(undefined)).toBeUndefined();
  });

  it('should convert values to strings', () => {
    const query = { count: 42, active: true };
    const filtered = filterQuery(query);
    expect(filtered?.count).toBe('42');
    expect(filtered?.active).toBe('true');
  });
});

describe('redactHeaders', () => {
  it('should redact sensitive headers', () => {
    const headers: RequestHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token123',
      'X-API-Key': 'secret-key',
      'X-Custom-Header': 'public-value',
    };
    const redacted = redactHeaders(headers);
    expect(redacted?.Authorization).toBe('[REDACTED]');
    expect(redacted?.['X-API-Key']).toBe('[REDACTED]');
    expect(redacted?.['Content-Type']).toBe('application/json');
    expect(redacted?.['X-Custom-Header']).toBe('public-value');
  });

  it('should handle case-insensitive keys', () => {
    const headers: RequestHeaders = {
      authorization: 'Bearer token',
      COOKIE: 'session=123',
    };
    const redacted = redactHeaders(headers);
    expect(redacted?.authorization).toBe('[REDACTED]');
    expect(redacted?.COOKIE).toBe('[REDACTED]');
  });
});

describe('sanitizeForLog', () => {
  it('should truncate long strings', () => {
    const longString = 'x'.repeat(5000);
    const sanitized = sanitizeForLog(longString, 2000);
    expect(String(sanitized).length).toBeLessThan(5000);
    expect(String(sanitized)).toContain('[truncated]');
  });

  it('should preserve short strings', () => {
    const short = 'hello';
    const sanitized = sanitizeForLog(short, 100);
    expect(sanitized).toBe('hello');
  });

  it('should redact nested sensitive fields', () => {
    const obj = {
      username: 'john',
      authorization: 'secret',
      data: {
        password: 'pass123',
        public: 'info',
      },
    };
    const sanitized = sanitizeForLog(obj, 1000);
    expect(sanitized).toEqual(
      expect.objectContaining({
        authorization: '[REDACTED]',
        username: 'john',
        data: expect.objectContaining({
          password: '[REDACTED]',
          public: 'info',
        }),
      })
    );
  });

  it('should handle arrays', () => {
    const array = ['public', 'data', 'token123', 'secret_key'];
    const sanitized = sanitizeForLog(array, 1000);
    expect(Array.isArray(sanitized)).toBe(true);
  });

  it('should stop recursion at depth 5', () => {
    let obj: any = { value: 'deep' };
    for (let i = 0; i < 10; i++) {
      obj = { nested: obj };
    }
    const sanitized = sanitizeForLog(obj, 1000);
    // Convert to string and check for the depth limit marker
    const jsonStr = JSON.stringify(sanitized);
    expect(jsonStr).toContain('[MaxDepthExceeded]');
  });
});

describe('buildUrl', () => {
  it('should build URL from base and path', () => {
    const url = buildUrl('https://api.example.com', '/users/123');
    expect(url).toBe('https://api.example.com/users/123');
  });

  it('should handle paths with leading slash', () => {
    const url = buildUrl('https://api.example.com', 'users');
    expect(url).toBe('https://api.example.com/users');
  });

  it('should append query parameters', () => {
    const url = buildUrl('https://api.example.com', '/users', { page: 1, limit: 10 });
    expect(url).toContain('page=1');
    expect(url).toContain('limit=10');
  });

  it('should filter falsy query values', () => {
    const url = buildUrl('https://api.example.com', '/users', {
      page: 1,
      filter: '',
      sort: null,
    });
    expect(url).toContain('page=1');
    expect(url).not.toContain('filter');
    expect(url).not.toContain('sort');
  });
});

/** ============================================================
 *  RESPONSE WRAPPER
 *  ============================================================ */

describe('HttpSuccess', () => {
  it('should create success response', () => {
    const response = new HttpSuccess({
      message: 'Success',
      data: { user: 'john' },
      meta: {},
      error: null,
    });
    expect(response.data).toEqual({ user: 'john' });
    expect(response.message).toBe('Success');
    expect(response.error).toBeNull();
  });

  it('should provide json() method', async () => {
    const response = new HttpSuccess({
      message: 'Success',
      data: { user: 'john' },
      meta: {},
      error: null,
    });
    const data = await response.json();
    expect(data).toEqual({
      message: 'Success',
      data: { user: 'john' },
      meta: {},
      error: null,
    });
  });

  it('should provide text() method', async () => {
    const response = new HttpSuccess({
      message: 'Success',
      data: 'hello',
      meta: {},
      error: null,
    });
    const text = await response.text();
    expect(text).toContain('"message":"Success"');
    expect(text).toContain('"data":"hello"');
  });
});

describe('response normalization', () => {
  it('should normalize raw success payload to responder format', () => {
    const normalized = normalizeSuccessResponse({ user: 'john' }, 'OK');
    expect(normalized).toEqual({
      message: 'OK',
      data: { user: 'john' },
      meta: {},
      error: null,
    });
  });

  it('should preserve responder success payload', () => {
    const payload = {
      message: 'Fetched',
      data: { id: 1 },
      meta: { page: 1 },
      error: null,
    };
    const normalized = normalizeSuccessResponse(payload);
    expect(normalized).toEqual(payload);
  });

  it('should normalize raw error payload to responder format', () => {
    const normalized = normalizeErrorResponse(
      { reason: 'invalid' },
      'Bad Request',
      'HTTP_400'
    );

    expect(normalized.message).toBe('Bad Request');
    expect(normalized.data).toBeNull();
    expect(normalized.error?.code).toBe('HTTP_400');
    expect(normalized.error?.message).toBe('Bad Request');
  });

  it('should preserve responder error payload', () => {
    const payload = {
      message: 'Validation failed',
      data: null,
      meta: {},
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: [{ field: 'email', issue: 'required' }],
      },
    };

    const normalized = normalizeErrorResponse(payload, 'Fallback', 'HTTP_400');
    expect(normalized).toEqual(payload);
  });
});

describe('getResponseType', () => {
  it('should detect JSON content type', () => {
    expect(getResponseType('application/json')).toBe('json');
    expect(getResponseType('application/json; charset=utf-8')).toBe('json');
  });

  it('should detect text content type', () => {
    expect(getResponseType('text/plain')).toBe('text');
    expect(getResponseType('text/html')).toBe('text');
  });

  it('should detect other types', () => {
    expect(getResponseType('image/png')).toBe('other');
  });

  it('should handle missing content type', () => {
    expect(getResponseType(undefined)).toBe('text');
    expect(getResponseType('')).toBe('text');
  });

  it('should handle array content types', () => {
    expect(getResponseType(['application/json', 'text/plain'])).toBe('json');
  });
});

/** ============================================================
 *  HTTP CLIENT
 *  ============================================================ */

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient({
      baseUrl: 'https://api.example.com',
      timeoutMs: 5000,
      logger: createMockLogger(),
      transport: { mode: 'fetch' },
    });
  });

  afterEach(async () => {
    await client.close();
    vi.restoreAllMocks();
  });

  it('should throw error if baseUrl not provided', () => {
    expect(() => {
      new HttpClient({ baseUrl: '' });
    }).toThrow('baseUrl is required');
  });

  it('should initialize with default config', () => {
    const defaultClient = new HttpClient({
      baseUrl: 'https://api.example.com',
      transport: { mode: 'fetch' },
    });
    expect(defaultClient).toBeDefined();
  });

  it('should close gracefully', async () => {
    await client.close();
    expect(client).toBeDefined();
  });

  it('should get circuit breaker state', () => {
    const state = client.getCircuitBreakerState();
    expect(state.state).toBe('CLOSED');
    expect(state.failures).toBe(0);
  });

  it('should normalize raw success body to responder response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1, name: 'John' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      })
    );

    const response = await client.get<{ id: number; name: string }>('/users/1');

    expect(response.message).toBe('OK');
    expect(response.data).toEqual({ id: 1, name: 'John' });
    expect(response.meta).toEqual({});
    expect(response.error).toBeNull();
  });

  it('should preserve responder success response from API', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Fetched user',
          data: { id: 1 },
          meta: { source: 'api' },
          error: null,
        }),
        {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const response = await client.get<{ id: number }>('/users/1');
    expect(response.message).toBe('Fetched user');
    expect(response.data).toEqual({ id: 1 });
    expect(response.meta).toEqual({ source: 'api' });
    expect(response.error).toBeNull();
  });

  it('should throw HttpError with responder-formatted error payload', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'invalid request' }), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/json' },
      })
    );

    await expectAsync(() => client.get('/users/1')).rejects.toMatchObject({
      name: 'HttpError',
      status: 400,
      response: {
        message: 'Bad Request',
        data: null,
        meta: {},
        error: {
          code: 'HTTP_400',
          message: 'Bad Request',
        },
      },
    });
  });

  it('should classify abort-like errors as AbortError when timeout did not fire', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(
      new TypeError('aborted by upstream')
    );

    await expectAsync(() => client.get('/users/1')).rejects.toThrow(AbortError);
  });

  it('should classify abort caused by timeout as TimeoutError', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              reject(new TypeError('aborted'));
            });
          }
        }) as Promise<Response>;
      }
    );

    await expectAsync(() => client.get('/users/1', { timeoutMs: 10 })).rejects.toThrow(TimeoutError);
  });
});

describe('HttpClient - Circuit Breaker', () => {
  let client: HttpClient;
  let nowValue: number;

  beforeEach(() => {
    nowValue = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowValue);

    client = new HttpClient({
      baseUrl: 'https://api.example.com',
      circuitBreaker: {
        failureThreshold: 2,
        openTimeoutMs: 100,
        halfOpenSuccessRate: 0.5,
      },
      logger: createMockLogger(),
      transport: { mode: 'fetch' },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await client.close();
  });
  it('should throw CircuitOpenError when circuit open', async () => {
    // Mock fetch to fail
    vi.spyOn(global as any, 'fetch' as any).mockRejectedValue(
      new HttpError('Server Error', { status: 500 })
    );

    // Make 2 failing requests to open circuit
    await expectAsync(() => client.post('/test')).rejects.toThrow(HttpError);
    await expectAsync(() => client.post('/test')).rejects.toThrow(HttpError);

    // Third request should fail with CircuitOpenError
    await expectAsync(() => client.get('/test')).rejects.toThrow(CircuitOpenError);
  });

  it('should expose circuit breaker state', () => {
    const state = client.getCircuitBreakerState();
    expect(state).toHaveProperty('state');
    expect(state).toHaveProperty('failures');
    expect(state).toHaveProperty('failureThreshold');
  });

  it('should transition OPEN to HALF_OPEN after timeout window', async () => {
    vi.spyOn(global as any, 'fetch' as any).mockRejectedValue(
      new HttpError('Server Error', { status: 500 })
    );

    await expectAsync(() => client.post('/test')).rejects.toThrow(HttpError);
    await expectAsync(() => client.post('/test')).rejects.toThrow(HttpError);

    // Open timeout elapsed -> transition to HALF_OPEN, but random gate blocks this probe.
    nowValue = 1_200;
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    await expectAsync(() => client.get('/test')).rejects.toThrow(CircuitOpenError);
    expect(client.getCircuitBreakerState().state).toBe('HALF_OPEN');
  });

  it('should reopen circuit if HALF_OPEN probe fails', async () => {
    vi.spyOn(global as any, 'fetch' as any).mockRejectedValue(
      new HttpError('Server Error', { status: 500 })
    );

    await expectAsync(() => client.post('/test')).rejects.toThrow(HttpError);
    await expectAsync(() => client.post('/test')).rejects.toThrow(HttpError);

    nowValue = 1_200;
    vi.spyOn(Math, 'random').mockReturnValue(0.0);

    await expectAsync(() => client.get('/test')).rejects.toThrow(HttpError);
    expect(client.getCircuitBreakerState().state).toBe('OPEN');
  });

  it('should close circuit if HALF_OPEN probe succeeds', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok', data: { ok: true }, meta: {}, error: null }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      })
    );

    // Open it first using temporary failure mock.
    vi.spyOn(global as any, 'fetch' as any)
      .mockRejectedValueOnce(new HttpError('Server Error', { status: 500 }))
      .mockRejectedValueOnce(new HttpError('Server Error', { status: 500 }))
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'ok', data: { ok: true }, meta: {}, error: null }), {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
        })
      );

    await expectAsync(() => client.post('/test')).rejects.toThrow(HttpError);
    await expectAsync(() => client.post('/test')).rejects.toThrow(HttpError);

    nowValue = 1_200;
    vi.spyOn(Math, 'random').mockReturnValue(0.0);

    await expectAsync(() => client.get('/test')).resolves.toMatchObject({
      message: 'ok',
      error: null,
    });

    expect(client.getCircuitBreakerState().state).toBe('CLOSED');
    expect(client.getCircuitBreakerState().failures).toBe(0);
  });
});

/** ============================================================
 *  TESTING UTILITIES
 *  ============================================================ */

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function expectAsync(fn: () => Promise<any>) {
  return expect(fn());
}
