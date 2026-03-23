/**
 * Browser-only transport factory.
 * Exports only the fetch-based transport so that bundlers targeting
 * browser environments never include UndiciTransport or the undici import.
 */
import type { HttpTransport } from './types';
import type { HttpTransportOptions } from '../types';
import { FetchTransport } from './fetchTransport';

export function createTransport(_options?: HttpTransportOptions): HttpTransport {
  return new FetchTransport();
}
