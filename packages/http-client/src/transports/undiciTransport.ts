import type { HttpTransport, TransportRequest, TransportResponse } from './types';
import type { NodeUndiciOptions } from '../types';
import { AppError } from '../errors';

type UndiciModule = {
  request: (
    url: string,
    options: {
      method: string;
      headers?: Record<string, string>;
      body?: string;
      signal?: AbortSignal;
      dispatcher?: unknown;
      headersTimeout?: number;
      bodyTimeout?: number;
    }
  ) => Promise<{
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body: {
      json(): Promise<unknown>;
      text(): Promise<string>;
    };
  }>;
  Agent: new (options?: {
    connections?: number;
    pipelining?: number;
    keepAliveTimeout?: number;
    keepAliveMaxTimeout?: number;
  }) => { close(): Promise<void> };
};

export class UndiciTransport implements HttpTransport {
  readonly kind = 'undici' as const;

  private readonly options: NodeUndiciOptions;
  private mod: UndiciModule | null = null;
  private agent: { close(): Promise<void> } | null = null;

  constructor(options: NodeUndiciOptions = {}) {
    this.options = options;
  }

  async send(request: TransportRequest): Promise<TransportResponse> {
    const mod = await this.loadUndici();
    this.ensureAgent(mod);

    const result = await mod.request(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body !== undefined && request.body !== null ? JSON.stringify(request.body) : undefined,
      signal: request.signal,
      dispatcher: this.agent ?? undefined,
      headersTimeout: this.options.headersTimeout ?? request.timeoutMs,
      bodyTimeout: this.options.bodyTimeout ?? request.timeoutMs,
    });

    return {
      status: result.statusCode,
      statusText: '',
      headers: result.headers,
      json: () => result.body.json(),
      text: () => result.body.text(),
    };
  }

  async close(): Promise<void> {
    if (this.agent) {
      await this.agent.close();
      this.agent = null;
    }
  }

  private ensureAgent(mod: UndiciModule): void {
    if (this.agent) {
      return;
    }

    this.agent = new mod.Agent({
      connections: this.options.connections,
      pipelining: this.options.pipelining,
      keepAliveTimeout: this.options.keepAliveTimeout,
      keepAliveMaxTimeout: this.options.keepAliveMaxTimeout,
    });
  }

  private async loadUndici(): Promise<UndiciModule> {
    if (this.mod) {
      return this.mod;
    }

    try {
      const mod = (await import('undici')) as unknown as UndiciModule;
      this.mod = mod;
      return mod;
    } catch (error) {
      throw new AppError('Failed to load undici transport', {
        code: 'UNDICI_NOT_AVAILABLE',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
