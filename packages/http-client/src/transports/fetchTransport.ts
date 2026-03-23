import type { HttpTransport, TransportRequest, TransportResponse } from './types';

function headersToRecord(headers: Headers): Record<string, string | string[] | undefined> {
  const output: Record<string, string | string[] | undefined> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}

export class FetchTransport implements HttpTransport {
  readonly kind = 'fetch' as const;

  async send(request: TransportRequest): Promise<TransportResponse> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      signal: request.signal,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: headersToRecord(response.headers),
      json: () => response.json(),
      text: () => response.text(),
    };
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}
