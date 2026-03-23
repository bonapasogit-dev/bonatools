#!/usr/bin/env -S tsx

import http from 'node:http';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { HttpClient } from '../src/index';

const quietLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

type Mode = 'all' | 'fetch' | 'undici' | 'auto';
type BenchmarkMode = Exclude<Mode, 'all'>;
const BENCHMARK_MODES: readonly BenchmarkMode[] = ['fetch', 'undici', 'auto'];

const DEFAULTS = {
  totalRequests: 10000,
  concurrency: 200,
  warmupRequests: 1000,
  path: '/bench',
  payloadBytes: 512,
  mode: 'all' as Mode,
  timeoutMs: 5000,
};

const args = parseArgs(process.argv.slice(2));
const config = {
  totalRequests: toInt(args.requests, DEFAULTS.totalRequests),
  concurrency: toInt(args.concurrency, DEFAULTS.concurrency),
  warmupRequests: toInt(args.warmup, DEFAULTS.warmupRequests),
  timeoutMs: toInt(args.timeout, DEFAULTS.timeoutMs),
  path: args.path || DEFAULTS.path,
  payloadBytes: toInt(args.payloadBytes, DEFAULTS.payloadBytes),
  undiciConnections: toInt(args.connections, 0),
  undiciPipelining: toInt(args.pipelining, 4),
  mode: (args.mode as Mode) || DEFAULTS.mode,
  target: args.target || process.env.TARGET_URL,
};

const availableModes: BenchmarkMode[] =
  config.mode === 'all' ? [...BENCHMARK_MODES] : [config.mode];

const localServer = config.target ? null : await createLocalServer(config.path, config.payloadBytes);
const targetBaseUrl = config.target || localServer!.baseUrl;

console.log('HTTP Client Transport Benchmark');
console.log('================================');
console.log(`Target: ${targetBaseUrl}`);
console.log(`Path: ${config.path}`);
console.log(`Total requests: ${config.totalRequests}`);
console.log(`Concurrency: ${config.concurrency}`);
console.log(`Warmup requests: ${config.warmupRequests}`);
console.log(`Timeout: ${config.timeoutMs}ms`);
console.log(`Undici connections: ${config.undiciConnections > 0 ? config.undiciConnections : `auto(max(100, concurrency) => ${Math.max(100, config.concurrency)})`}`);
console.log(`Undici pipelining: ${config.undiciPipelining}`);
console.log('');

const results: Array<{
  mode: string;
  totalRequests: number;
  successful: number;
  failed: number;
  durationMs: number;
  throughput: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  successRate: number;
  attemptedThroughput: number;
  errorBreakdown: Record<string, number>;
}> = [];

for (const mode of availableModes) {
  const result = await runBenchmark({
    mode,
    baseUrl: targetBaseUrl,
    path: config.path,
    totalRequests: config.totalRequests,
    concurrency: config.concurrency,
    warmupRequests: config.warmupRequests,
    timeoutMs: config.timeoutMs,
    undiciConnections: config.undiciConnections,
    undiciPipelining: config.undiciPipelining,
  });

  results.push(result);
  printResult(result);
}

printComparison(results);

if (localServer) {
  await localServer.close();
}

async function runBenchmark({
  mode,
  baseUrl,
  path,
  totalRequests,
  concurrency,
  warmupRequests,
  timeoutMs,
  undiciConnections,
  undiciPipelining,
}: {
  mode: BenchmarkMode;
  baseUrl: string;
  path: string;
  totalRequests: number;
  concurrency: number;
  warmupRequests: number;
  timeoutMs: number;
  undiciConnections: number;
  undiciPipelining: number;
}) {
  const client = new HttpClient({
    baseUrl,
    timeoutMs,
    retries: 0,
    logResponseBody: false,
    logger: quietLogger,
    transport: {
      mode,
      fallbackToFetchOnUndiciError: false,
      undici: {
        connections: undiciConnections > 0 ? undiciConnections : Math.max(100, concurrency),
        pipelining: Math.max(1, undiciPipelining),
      },
    },
  });

  try {
    if (warmupRequests > 0) {
      await executeLoad({ client, path, totalRequests: warmupRequests, concurrency, collectLatencies: false });
    }

    const startedAt = performance.now();
    const measurement = await executeLoad({
      client,
      path,
      totalRequests,
      concurrency,
      collectLatencies: true,
    });
    const endedAt = performance.now();

    const durationMs = endedAt - startedAt;
    const successful = measurement.success;
    const failed = measurement.fail;
    const attemptedThroughput = totalRequests / (durationMs / 1000);
    const throughput = successful / (durationMs / 1000);
    const successRate = totalRequests > 0 ? (successful / totalRequests) * 100 : 0;

    const latencies = measurement.latencies;
    latencies.sort((a, b) => a - b);

    return {
      mode,
      totalRequests,
      successful,
      failed,
      durationMs,
      throughput,
      attemptedThroughput,
      successRate,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      min: latencies.length ? latencies[0] : 0,
      max: latencies.length ? latencies[latencies.length - 1] : 0,
      errorBreakdown: measurement.errorBreakdown,
    };
  } finally {
    await client.close();
  }
}

async function executeLoad({
  client,
  path,
  totalRequests,
  concurrency,
  collectLatencies,
}: {
  client: HttpClient;
  path: string;
  totalRequests: number;
  concurrency: number;
  collectLatencies: boolean;
}) {
  let issued = 0;
  let success = 0;
  let fail = 0;
  const latencies: number[] = [];
  const errorBreakdown: Record<string, number> = {};

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = issued;
      issued += 1;
      if (index >= totalRequests) {
        return;
      }

      const started = performance.now();
      try {
        const response = await client.get(path);
        if (response.error !== null) {
          fail += 1;
        } else {
          success += 1;
        }
      } catch (err) {
        fail += 1;
        const key = classifyErrorKey(err);
        errorBreakdown[key] = (errorBreakdown[key] ?? 0) + 1;
      } finally {
        if (collectLatencies) {
          latencies.push(performance.now() - started);
        }
      }
    }
  });

  await Promise.all(workers);

  return { success, fail, latencies, errorBreakdown };
}

function printResult(result: {
  mode: string;
  successful: number;
  failed: number;
  durationMs: number;
  throughput: number;
  attemptedThroughput: number;
  successRate: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  errorBreakdown: Record<string, number>;
}) {
  console.log(`Mode: ${result.mode}`);
  console.log(`  Success/Fail : ${result.successful}/${result.failed}`);
  console.log(`  Success rate : ${result.successRate.toFixed(2)}%`);
  console.log(`  Duration     : ${result.durationMs.toFixed(2)} ms`);
  console.log(`  Attempted TPS: ${result.attemptedThroughput.toFixed(2)} req/s`);
  console.log(`  Throughput   : ${result.throughput.toFixed(2)} req/s`);
  console.log(`  Latency (ms) : p50=${result.p50.toFixed(2)} p95=${result.p95.toFixed(2)} p99=${result.p99.toFixed(2)} min=${result.min.toFixed(2)} max=${result.max.toFixed(2)}`);
  const topErrors = Object.entries(result.errorBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topErrors.length > 0) {
    console.log('  Top errors   :');
    for (const [errorKey, count] of topErrors) {
      console.log(`    - ${errorKey}: ${count}`);
    }
  }
  console.log('');
}

function printComparison(results: Array<{ mode: string; throughput: number }>) {
  if (results.length < 2) {
    return;
  }

  const baseline = results[0];
  console.log('Comparison (throughput relative to first mode)');
  for (const result of results) {
    const ratio = baseline.throughput > 0 ? result.throughput / baseline.throughput : 0;
    console.log(`  ${result.mode.padEnd(8)} : ${ratio.toFixed(2)}x`);
  }
  console.log('');
}

function classifyErrorKey(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };
    const name = typeof err.name === 'string' ? err.name : 'UnknownError';
    const code = typeof err.code === 'string' ? err.code : '';
    const status = typeof err.status === 'number' ? `:${err.status}` : '';
    const message = typeof err.message === 'string' ? err.message : '';

    if (code) {
      return `${name}:${code}${status}`;
    }

    if (status) {
      return `${name}${status}`;
    }

    if (message) {
      return `${name}:${message}`;
    }
    return name;
  }

  return 'UnknownError';
}

function percentile(sortedValues: number[], p: number) {
  if (!sortedValues.length) {
    return 0;
  }

  const index = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[index];
}

async function createLocalServer(path: string, payloadBytes: number) {
  const server = http.createServer((req, res) => {
    if (req.url !== path) {
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ message: 'not found', data: null, meta: {}, error: { code: 'NOT_FOUND', message: 'not found', details: [] } }));
      return;
    }

    const payload = {
      message: 'ok',
      data: {
        id: 'bench',
        blob: 'x'.repeat(Math.max(1, payloadBytes)),
      },
      meta: {
        source: 'local-benchmark',
      },
      error: null,
    };

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(payload));
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine local benchmark server address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[key] = value;
  }

  return out;
}

function toInt(value: string | undefined, fallback: number) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
