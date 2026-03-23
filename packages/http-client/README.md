# HTTP Client

Production-grade HTTP client for Node.js with advanced reliability features.

## Features

### Core Capabilities
- **Type-Safe**: Full TypeScript support with comprehensive interfaces
- **Automatic Retries**: Exponential backoff with jitter for failed requests
- **Circuit Breaker**: Prevents cascading failures in distributed systems
- **Request Timeout**: Configurable timeout per request or globally
- **Responder Contract**: Success/error responses normalized to `{ message, data, meta, error }`
- **URL Building**: Query parameter filtering and URL construction

### Reliability
- **Structured Logging**: Consistent, contextual logging with redaction of secrets
- **Error Classification**: Specific error types for different failure scenarios
- **Graceful Degradation**: Circuit breaker with half-open state for recovery
- **Network Resilience**: Retry support for transient failures

### Developer Experience
- **Detailed Error Objects**: Rich error information for debugging
- **Request Tracing**: Unique request IDs for end-to-end tracing
- **Sensitive Data Protection**: Automatic redaction of secrets in logs
- **Memory Safe**: Proper cleanup and resource management

## Installation

```bash
npm install @bonapasogit-dev/http-client
```

## Quick Start

```typescript
import { HttpClient, errorToLogObject } from '@bonapasogit-dev/http-client';

const client = new HttpClient({
  baseUrl: 'https://api.example.com',
  timeoutMs: 5000,
  retries: 3,
});

try {
  const response = await client.get('/users/123');
  console.log(response.message);
  console.log(response.data);
  console.log(response.meta);
  
  const created = await client.post('/users', {
    name: 'John',
    email: 'john@example.com',
  });
  console.log(created.message);
  console.log(created.data);
} catch (error) {
  // HttpError carries responder-formatted payload in error.response
  console.error(errorToLogObject(error));
} finally {
  await client.close();
}
```

## Configuration

### HttpClientOptions

```typescript
interface HttpClientOptions {
  // Required
  baseUrl: string;                    // Base URL for all requests
  
  // Optional - Behavior
  timeoutMs?: number;                 // Request timeout (default: 5000ms)
  retries?: number;                   // Maximum retry attempts (default: 0)
  
  // Optional - Headers & Logging
  headers?: Record<string, string>;   // Default headers
  logger?: Logger;                    // Custom logger (default: console)
  logResponseBody?: boolean;          // Log response bodies (default: true)
  maxLogBodyLength?: number;          // Max response log size (default: 2000)
  
  // Optional - Performance
  maxConnections?: number;            // Connection pool size (default: 100)
  pipelining?: number;                // HTTP pipelining depth (default: 1)
  
  // Optional - Advanced
  backoff?: BackoffConfig;            // Retry backoff strategy
  circuitBreaker?: CircuitBreakerConfig;
  transport?: HttpTransportOptions;   // Hybrid runtime transport strategy
}
```

### Transport Configuration (Hybrid Fetch/Undici)

```typescript
type TransportMode = 'auto' | 'fetch' | 'undici';

interface HttpTransportOptions {
  mode?: TransportMode;
  fallbackToFetchOnUndiciError?: boolean;
  undici?: {
    connections?: number;
    pipelining?: number;
    keepAliveTimeout?: number;
    keepAliveMaxTimeout?: number;
    headersTimeout?: number;
    bodyTimeout?: number;
  };
}
```

- `auto` (default): Node.js prefers `undici`; browser/edge uses `fetch`.
- `fetch`: force runtime-native fetch behavior.
- `undici`: force undici transport (Node-only runtime target).

### Throughput Benchmark (Fetch vs Undici vs Auto)

Run local synthetic benchmark:

```bash
npm run benchmark
```

Run against real endpoint:

```bash
npm run benchmark:real -- \
  --target https://api.your-service.com \
  --path /health \
  --requests 20000 \
  --concurrency 300 \
  --warmup 2000
```

Direct invocation is also supported:

```bash
tsx ./benchmarks/transport-benchmark.ts --target https://api.your-service.com
```

Supported benchmark flags:

- `--target <url>`: base URL for real workload (omit to use local server)
- `--path <path>`: request path (default: `/bench`)
- `--requests <n>`: measured requests (default: 10000)
- `--concurrency <n>`: concurrent workers (default: 200)
- `--warmup <n>`: warmup requests (default: 1000)
- `--mode <all|fetch|undici|auto>`: transport mode set (default: all)
- `--timeout <ms>`: request timeout in milliseconds (default: 5000)
- `--connections <n>`: undici max connections (default: auto)
- `--pipelining <n>`: undici pipelining factor (default: 4)

Principle benchmark guidance:

- Use representative payload size and endpoint logic.
- Run 3-5 iterations and compare median throughput + p95 latency.
- Always evaluate success rate alongside throughput. High fail rates can make a mode look artificially fast or slow.
- Benchmark runner disables circuit opening to isolate transport performance; this is intentional for fair mode comparison.
- For Node service-to-service traffic, `undici` or `auto` is usually best.
- For browser compatibility and universal code paths, keep `auto` as default.

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;           // Failures before opening (default: 5)
  openTimeoutMs: number;              // Time in open state (default: 10000ms)
  halfOpenSuccessRate: number;        // Success probability in half-open (default: 0.1)
}
```

### Backoff Configuration

```typescript
interface BackoffConfig {
  baseMs: number;                     // Base milliseconds (default: 50)
  maxMs: number;                      // Maximum milliseconds (default: 1000)
}
```

## API Reference

### HTTP Methods

All methods return `Promise<HttpSuccess<T>>` where `T` is the type of `data`.

```typescript
// GET request
const response = await client.get<User>('/users/123');

// POST request with body
const created = await client.post<User>('/users', { name: 'John' });

// PUT request
const updated = await client.put<User>('/users/123', { name: 'Jane' });

// PATCH request
const patched = await client.patch<User>('/users/123', { status: 'active' });

// DELETE request
const deleted = await client.delete<void>('/users/123');

// HEAD request
const head = await client.head('/users/123');
```

### Request Options

Override default behavior per request:
```typescript
// GET request
const response = await client.get('/users', {
  query: { page: 1, limit: 10 },
  headers: { 'X-Custom-Header': 'value' },
  timeoutMs: 10000,
  requestId: 'custom-trace-id',
});
```
```typescript
// POST request with body
const response = await client.post(
  '/users',
  { name: 'John' },
  {
    headers: { 'X-Custom-Header': 'value' },
    timeoutMs: 10000,
    requestId: 'custom-trace-id',
  }
);
```

### Response Object

```typescript
interface ApiResponse<T> {
  message: string;
  data: T | null;
  meta: Record<string, unknown>;
  error: ApiErrorObject | null;
}

interface HttpSuccess<T> {
  message: string;
  data: T | null;
  meta: Record<string, unknown>;
  error: ApiErrorObject | null;
  
  json(): Promise<ApiResponse<T>>;    // Get full responder payload
  text(): Promise<string>;            // Get payload as JSON string
}
```

### Responder Contract Behavior

- If upstream already returns responder shape, it is preserved.
- If upstream returns raw success body, client wraps it as:
  - `{ message: <statusText|Success>, data: <raw>, meta: {}, error: null }`
- If upstream returns raw error body on non-2xx, client throws `HttpError` with:
  - `error.response = { message, data: null, meta, error: { code, message, details } }`

### Error Handling

```typescript
import {
  HttpError,
  CircuitOpenError,
  TimeoutError,
  NetworkError,
  errorToLogObject,
} from '@bonapasogit-dev/http-client';

try {
  const response = await client.get<User>('/api/endpoint');
  console.log(response.data); // strongly typed
} catch (error) {
  if (error instanceof HttpError) {
    console.error(`HTTP ${error.status}`);
    console.error(error.response?.message);
    console.error(error.response?.error?.code);
    console.error(error.response?.error?.details ?? []);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof CircuitOpenError) {
    console.error('Service unavailable (circuit open)');
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  }
  
  // Always available: serialize to log object
  console.error(errorToLogObject(error));
}
```

### Using With Responder (Frontend Pattern)

```typescript
import { HttpClient, HttpError } from '@bonapasogit-dev/http-client';

type User = { id: string; name: string; email: string };

const client = new HttpClient({
  baseUrl: 'https://api.example.com',
});

export async function fetchUser(userId: string): Promise<User> {
  try {
    const res = await client.get<User>(`/users/${userId}`);

    // Responder success envelope
    // { message, data, meta, error: null }
    if (!res.data) {
      throw new Error('User not found');
    }

    return res.data;
  } catch (error) {
    if (error instanceof HttpError && error.response?.error) {
      // Responder error envelope
      // { message, data: null, meta, error: { code, message, details } }
      throw new Error(error.response.error.message);
    }

    throw error;
  }
}
```

## Logging

### Structured Logging

The client provides structured logging for all operations:

```typescript
const client = new HttpClient({
  baseUrl: 'https://api.example.com',
  logger: myLogger, // Must implement Logger interface
  logResponseBody: true,
  maxLogBodyLength: 2000,
});
```

### Logger Interface

```typescript
interface Logger {
  info(message?: unknown, ...args: unknown[]): void;
  warn(message?: unknown, ...args: unknown[]): void;
  error(message?: unknown, ...args: unknown[]): void;
  debug?(message?: unknown, ...args: unknown[]): void;
}
```

### Log Events

- **Request start**: Initial request with parameters
- **Request success**: Successful response with data
- **Request error**: Failed request with error details
- **Retry scheduled**: Scheduled retry with delay
- **Circuit state change**: Circuit breaker state transitions
- **Circuit blocked**: Request blocked by circuit breaker

### Security

Sensitive headers are automatically redacted:
- Authorization, Cookie, Token headers
- API keys, secrets, passwords
- Custom sensitive keys containing "secret", "password", "token"

## Retry Strategy

Retry logic follows these rules:

1. **Max Retries**: Respects `retries` option
2. **Retriable Errors**:
   - Network errors (connection failed, DNS error)
   - Timeout errors
   - 5xx server errors
   - 408 (Request Timeout)
   - 429 (Too Many Requests)
3. **Non-Retriable**:
   - 4xx client errors (400, 401, 403, 404, etc.)
   - Circuit breaker open errors
4. **Backoff**: Exponential backoff with jitter

## Circuit Breaker Pattern

Protects against cascading failures:

### States

- **CLOSED**: Normal operation, all requests allowed
- **OPEN**: Failure threshold reached, requests rejected immediately
- **HALF_OPEN**: Gradual recovery, some requests allowed

### Behavior

1. Each 5xx error increments failure counter
2. 4xx errors don't count as failures
3. When failures reach threshold, circuit opens
4. After timeout, enters half-open state
5. In half-open, some requests are allowed (configurable probability)
6. If requests succeed, circuit closes
7. If requests fail, circuit reopens

## Example: Advanced Configuration

```typescript
import { HttpClient } from '@bonapasogit-dev/http-client';

const client = new HttpClient({
  baseUrl: 'https://api.example.com',
  timeoutMs: 10000,
  retries: 5,
  transport: {
    mode: 'auto',
    undici: {
      connections: 200,
      pipelining: 4,
      keepAliveTimeout: 10000,
    },
  },
  
  // Custom headers for all requests
  headers: {
    'User-Agent': 'MyApp/1.0.0',
    'Accept': 'application/json',
  },
  
  // Structured logging
  logger: winston.createLogger({
    format: winston.format.json(),
  }),
  
  // Aggressive retry backoff
  backoff: {
    baseMs: 100,
    maxMs: 5000,
  },
  
  // Sensitive circuit breaker
  circuitBreaker: {
    failureThreshold: 3,
    openTimeoutMs: 30000,
    halfOpenSuccessRate: 0.2,
  },
});

try {
  const users = await client.get('/users', {
    query: { page: 1, limit: 50 },
    timeoutMs: 15000, // Override per-request
  });
} finally {
  await client.close();
}
```

## Testing

Run tests with Vitest:

```bash
npm test                    # Watch mode
npm run test:run           # Single run
npm run test:coverage      # With coverage report
npm run test:ui            # UI dashboard
```

Test coverage includes:
- Error classes and serialization
- Utility functions and helpers
- Response parsing and formatting
- HTTP client core functionality
- Circuit breaker logic and state management
- Retry mechanisms and backoff calculation
- Logging and sensitive data redaction

## Architecture

### Module Structure

```
src/
├── types.ts              # Core types and interfaces
├── errors.ts             # Error classes and classification
├── response.ts           # Response wrapper
├── httpClient.ts         # Main client implementation
├── utils.ts              # Utility functions
├── logger.ts             # Logging utilities
└── index.ts              # Public API exports
```

### Design Principles

1. **Type Safety**: Full TypeScript, strict mode enabled
2. **Composition**: Utilities combined into cohesive client
3. **Separation of Concerns**: Errors, logging, and networking isolated
4. **Resource Management**: Proper cleanup and GC considerations
5. **Observability**: Structured logging with tracing support
6. **Production Ready**: Error handling, timeouts, and graceful degradation

## Performance

- **Zero External Dependencies**: Minimal bundle footprint
- **Efficient Backoff**: Jitter prevents thundering herd
- **Connection Pooling**: Reuses HTTP connections
- **Memory Efficient**: Proper cleanup and streaming
- **Lock-Free**: No synchronization overhead in single-threaded Node.js

## Browser Compatibility

Requires Node.js 18+ with native `fetch` API support.

## License

Private package - @bonapasogit-dev
