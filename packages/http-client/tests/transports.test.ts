/**
 * Transport Unit Tests
 * ====================
 *
 * Tests for UndiciTransport, FetchTransport, and transport selection logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UndiciTransport } from '../src/transports/undiciTransport';
import { FetchTransport } from '../src/transports/fetchTransport';
import { createTransport } from '../src/transports';
import HttpClient from '../src/httpClient';
import { AppError } from '../src/errors';
import { createMockLogger } from './helpers';

/** ============================================================
 *  UNDICI TRANSPORT MOCK SETUP
 *
 *  vi.hoisted() ensures mock variables are available inside vi.mock()
 *  factory, which is hoisted before module imports by Vitest's transform.
 *  ============================================================ */

const { mockUndiciRequest, mockAgentClose, MockAgent } = vi.hoisted(() => {
  const mockAgentClose = vi.fn().mockResolvedValue(undefined);
  const MockAgent = vi.fn().mockImplementation(() => ({ close: mockAgentClose }));
  const mockUndiciRequest = vi.fn();
  return { mockUndiciRequest, mockAgentClose, MockAgent };
});

vi.mock('undici', () => ({
  request: mockUndiciRequest,
  Agent: MockAgent,
}));

function makeUndiciResponse(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...headers },
    body: {
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(bodyStr),
    },
  };
}

/** ============================================================
 *  UNDICI TRANSPORT
 *  ============================================================ */

describe('UndiciTransport', () => {
  let transport: UndiciTransport;

  beforeEach(() => {
    transport = new UndiciTransport();
    mockUndiciRequest.mockReset();
    mockAgentClose.mockReset().mockResolvedValue(undefined);
    MockAgent.mockClear().mockImplementation(() => ({ close: mockAgentClose }));
  });

  afterEach(async () => {
    await transport.close();
  });

  it('should send a GET request and return a response', async () => {
    mockUndiciRequest.mockResolvedValue(makeUndiciResponse(200, { id: 1 }));

    const response = await transport.send({
      method: 'GET',
      url: 'https://example.com/users/1',
      headers: {},
    });

    expect(response.status).toBe(200);
    expect(response.statusText).toBe('');
    expect(await response.json()).toEqual({ id: 1 });
  });

  it('should return empty statusText regardless of status code', async () => {
    mockUndiciRequest.mockResolvedValue(makeUndiciResponse(404, { error: 'not found' }));

    const response = await transport.send({
      method: 'GET',
      url: 'https://example.com/users/999',
      headers: {},
    });

    expect(response.statusText).toBe('');
    expect(response.status).toBe(404);
  });

  it('should serialize a defined body (including falsy value 0)', async () => {
    mockUndiciRequest.mockResolvedValue(makeUndiciResponse(200, {}));

    await transport.send({
      method: 'POST',
      url: 'https://example.com/items',
      headers: {},
      body: 0,
    });

    expect(mockUndiciRequest).toHaveBeenCalledWith(
      'https://example.com/items',
      expect.objectContaining({ body: '0' })
    );
  });

  it('should serialize false as a body value', async () => {
    mockUndiciRequest.mockResolvedValue(makeUndiciResponse(200, {}));

    await transport.send({
      method: 'POST',
      url: 'https://example.com/items',
      headers: {},
      body: false,
    });

    expect(mockUndiciRequest).toHaveBeenCalledWith(
      'https://example.com/items',
      expect.objectContaining({ body: 'false' })
    );
  });

  it('should omit body when undefined', async () => {
    mockUndiciRequest.mockResolvedValue(makeUndiciResponse(200, {}));

    await transport.send({
      method: 'GET',
      url: 'https://example.com/items',
      headers: {},
    });

    expect(mockUndiciRequest).toHaveBeenCalledWith(
      'https://example.com/items',
      expect.objectContaining({ body: undefined })
    );
  });

  it('should close the undici agent on transport.close()', async () => {
    mockUndiciRequest.mockResolvedValue(makeUndiciResponse(200, {}));

    await transport.send({ method: 'GET', url: 'https://example.com', headers: {} });
    await transport.close();

    expect(mockAgentClose).toHaveBeenCalled();
  });
});

/** ============================================================
 *  FETCH TRANSPORT
 *  ============================================================ */

describe('FetchTransport', () => {
  let transport: FetchTransport;

  beforeEach(() => {
    transport = new FetchTransport();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await transport.close();
  });

  it('should send a GET request using fetch', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      })
    );

    const response = await transport.send({
      method: 'GET',
      url: 'https://example.com/users/1',
      headers: {},
    });

    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
    expect(await response.json()).toEqual({ id: 1 });
  });

  it('should serialize a defined body (including falsy value 0)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    );

    await transport.send({
      method: 'POST',
      url: 'https://example.com/items',
      headers: {},
      body: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/items',
      expect.objectContaining({ body: '0' })
    );
  });

  it('should serialize false as a body value', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    );

    await transport.send({
      method: 'POST',
      url: 'https://example.com/items',
      headers: {},
      body: false,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/items',
      expect.objectContaining({ body: 'false' })
    );
  });

  it('should omit body when undefined', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    );

    await transport.send({ method: 'GET', url: 'https://example.com', headers: {} });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ body: undefined })
    );
  });
});

/** ============================================================
 *  CREATE TRANSPORT
 *  ============================================================ */

describe('createTransport', () => {
  it('should return a FetchTransport for mode=fetch', () => {
    const transport = createTransport({ mode: 'fetch' });
    expect(transport.kind).toBe('fetch');
  });

  it('should return an UndiciTransport for mode=undici', () => {
    const transport = createTransport({ mode: 'undici' });
    expect(transport.kind).toBe('undici');
  });
});

/** ============================================================
 *  TRANSPORT FALLBACK (undici → fetch)
 *  ============================================================ */

describe('HttpClient - transport fallback', () => {
  beforeEach(() => {
    mockUndiciRequest.mockReset();
    mockAgentClose.mockReset().mockResolvedValue(undefined);
    MockAgent.mockClear().mockImplementation(() => ({ close: mockAgentClose }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should succeed using undici transport when undici is available', async () => {
    mockUndiciRequest.mockResolvedValue(
      makeUndiciResponse(200, { message: 'ok', data: { id: 1 }, meta: {}, error: null })
    );

    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      logger: createMockLogger(),
      transport: { mode: 'undici' },
    });

    try {
      const response = await client.get<{ id: number }>('/users/1');
      expect(response.data).toEqual({ id: 1 });
      expect(response.error).toBeNull();
      expect(mockUndiciRequest).toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });

  it('should fall back to fetch transport when undici throws UNDICI_NOT_AVAILABLE', async () => {
    // Simulate undici send failing as if it cannot be loaded
    mockUndiciRequest.mockRejectedValue(
      new AppError('Failed to load undici transport', {
        code: 'UNDICI_NOT_AVAILABLE',
      })
    );

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'ok via fetch', data: { id: 2 }, meta: {}, error: null }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    // auto mode with fallback enabled
    const client = new HttpClient({
      baseUrl: 'https://api.example.com',
      logger: createMockLogger(),
      transport: { mode: 'auto', fallbackToFetchOnUndiciError: true },
    });

    try {
      const response = await client.get<{ id: number }>('/users/2');
      expect(response.error).toBeNull();
      expect(global.fetch).toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });
});
