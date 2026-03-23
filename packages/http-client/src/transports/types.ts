import type { RequestHeaders } from '../types';

export interface TransportRequest {
  method: string;
  url: string;
  headers: RequestHeaders;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface TransportResponse {
  status: number;
  statusText: string;
  headers: Record<string, string | string[] | undefined>;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface HttpTransport {
  readonly kind: 'fetch' | 'undici';
  send(request: TransportRequest): Promise<TransportResponse>;
  close(): Promise<void>;
}
