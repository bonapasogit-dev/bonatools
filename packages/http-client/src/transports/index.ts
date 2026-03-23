import type { HttpTransport } from './types';
import type { HttpTransportOptions } from '../types';
import { FetchTransport } from './fetchTransport';
import { UndiciTransport } from './undiciTransport';
import { hasFetchApi, isNodeRuntime } from './runtime';

export function createTransport(options?: HttpTransportOptions): HttpTransport {
  const mode = options?.mode ?? 'auto';

  if (mode === 'fetch') {
    return new FetchTransport();
  }

  if (mode === 'undici') {
    return new UndiciTransport(options?.undici);
  }

  // auto mode: prefer undici on node for throughput; fallback to fetch elsewhere.
  if (isNodeRuntime()) {
    return new UndiciTransport(options?.undici);
  }

  if (hasFetchApi()) {
    return new FetchTransport();
  }

  // Last-resort fallback. FetchTransport will throw naturally if fetch is unavailable.
  return new FetchTransport();
}
