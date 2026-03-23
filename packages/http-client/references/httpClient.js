const { request, Agent } = require('undici');
const isRetryAllowed = require('is-retry-allowed').default;
const { HttpError, CircuitOpenError, errorToLogObject } = require('./error.js');

/* ---------- Http Client ---------- */

class HttpClient {
	constructor({
		baseUrl,
		timeoutMs = 5000,
		retries = 0,
		headers = {},
		logger = console,
		logResponseBody = true,
		maxLogBodyLength = 2000,
		connections = 100,
		pipelining = 1,
		backoff = { baseMs: 50, maxMs: 1000 },
		circuitBreaker = {
			failureThreshold: 5,
			openTimeoutMs: 10_000,
			halfOpenSuccessRate: 0.1, // 10% allowed through
		},
	}) {
		if (!baseUrl) throw new Error('baseUrl is required');

		this.baseUrl = baseUrl;
		this.timeoutMs = timeoutMs;
		this.retries = retries;
		this.headers = headers;
		this.logger = logger;
		this.logResponseBody = logResponseBody;
		this.maxLogBodyLength = maxLogBodyLength;
		this.backoff = backoff;

		this.agent = new Agent({ connections, pipelining });

		// Circuit breaker state (lock-free)
		this.cb = {
			failures: 0,
			state: 'CLOSED', // CLOSED | OPEN
			openedAt: 0,
			...circuitBreaker,
		};
	}

	get(path, options) {
		return this.#request('GET', path, null, options);
	}

	post(path, body, options) {
		return this.#request('POST', path, body, options);
	}

	#buildUrl(path, query) {
		let fullPath = path.startsWith('/') ? path : `/${path}`;

		if (query && Object.keys(query).length > 0) {
			// Filter out "zero values" (0, null, undefined, empty string)
			const filtered = filterQuery(query);

			if (Object.keys(filtered).length > 0) {
				const params = new URLSearchParams(filtered);
				fullPath += `?${params.toString()}`;
			}
		}

		// Combine with baseUrl (absolute URL required for undici)
		return new URL(fullPath, this.baseUrl).toString();
	}

	async #request(method, path, body, options = {}) {
		if (!this.#circuitAllowsRequest()) {
			this.#log('warn', 'HTTP circuit open, request blocked', {
				method,
				path,
				baseUrl: this.baseUrl,
			});
			throw new CircuitOpenError();
		}

		const url = this.#buildUrl(path, options.query);
		const headers = options.headers || this.headers;
		const timeoutMs = options.timeoutMs ?? this.timeoutMs;
		const requestId = createRequestId();
		const startedAt = Date.now();

		let attempt = 0;

		this.#log('info', 'HTTP request start', {
			requestId,
			method,
			path,
			url,
			query: filterQuery(options.query),
			headers: redactHeaders(headers),
			body,
			timeoutMs,
			retries: this.retries,
		});

		while (true) {
			try {
				const res = await request(url, {
					method,
					headers,
					body: body ? JSON.stringify(body) : undefined,
					dispatcher: this.agent,
					headersTimeout: timeoutMs,
					bodyTimeout: timeoutMs,
				});

				if (res.statusCode >= 400) {
					let errorBody = await safeRead(res);
					this.#log('warn', 'HTTP request failed response', {
						requestId,
						method,
						path,
						url,
						attempt,
						statusCode: res.statusCode,
						durationMs: Date.now() - startedAt,
						responseBody: errorBody,
					});
					throw new HttpError(
						`HTTP ${res.statusCode}`,
						res.statusCode,
						errorBody
					);
				}

				const data = await parseResponse(res);
				this.#log('info', 'HTTP request success', {
					requestId,
					method,
					path,
					url,
					attempt,
					statusCode: res.statusCode,
					durationMs: Date.now() - startedAt,
					responseBody: this.logResponseBody ? data : '[disabled]',
				});

				// Success closes circuit progressively
				this.#onSuccess();
				return data;
			} catch (err) {
				this.#onFailure(err);
				const willRetry = shouldRetry(err, attempt, this.retries);

				this.#log(willRetry ? 'warn' : 'error', 'HTTP request error', {
					requestId,
					method,
					path,
					url,
					attempt,
					durationMs: Date.now() - startedAt,
					willRetry,
					error: errorToLogObject(err),
				});

				if (!willRetry) {
					throw err;
				}

				const delay = computeBackoff(
					attempt,
					this.backoff.baseMs,
					this.backoff.maxMs
				);
				this.#log('warn', 'HTTP request retry scheduled', {
					requestId,
					method,
					path,
					url,
					attempt,
					nextAttempt: attempt + 1,
					delayMs: Math.round(delay),
				});
				await sleep(delay);
				attempt++;
			}
		}
	}

	#log(level, message, payload) {
		const logFn =
			this.logger && typeof this.logger[level] === 'function'
				? this.logger[level].bind(this.logger)
				: console.log;

		logFn(
			`[HttpClient] ${message}`,
			sanitizeForLog(payload, this.maxLogBodyLength)
		);
	}

	close() {
		return this.agent.close();
	}

	/* ---------- Circuit breaker internals ---------- */

	#circuitAllowsRequest() {
		const now = Date.now();

		if (this.cb.state === 'CLOSED') {
			return true;
		}

		// OPEN → check timeout
		if (now - this.cb.openedAt >= this.cb.openTimeoutMs) {
			// HALF-OPEN via probability
			return Math.random() < this.cb.halfOpenSuccessRate;
		}

		return false;
	}

	#onSuccess() {
		if (this.cb.state !== 'CLOSED') {
			this.cb.state = 'CLOSED';
		}
		this.cb.failures = 0;
	}

	#onFailure(err) {
		// Only count real failures
		if (
			err instanceof CircuitOpenError ||
			(err instanceof HttpError && err.status < 500)
		) {
			return;
		}

		this.cb.failures++;

		if (this.cb.failures >= this.cb.failureThreshold) {
			this.cb.state = 'OPEN';
			this.cb.openedAt = Date.now();
		}
	}
}

/* ---------- Helpers ---------- */

function shouldRetry(error, attempt, maxRetries) {
	if (attempt >= maxRetries) return false;
	if (isRetryAllowed({ code: error.status })) return true;
	if (error instanceof HttpError && error.status >= 500) return true;
	return false;
}

function filterQuery(query) {
	if (!query) return undefined;

	return Object.fromEntries(
		Object.entries(query)
			.filter(
				([, v]) => v !== null && v !== undefined && v !== '' && v !== 0
			)
			.map(([k, v]) => [k, String(v)])
	);
}

function computeBackoff(attempt, baseMs, maxMs) {
	const exp = baseMs * Math.pow(2, attempt);
	const capped = Math.min(exp, maxMs);
	return capped * (0.5 + Math.random());
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseResponse(res) {
	const contentType = res.headers['content-type'];
	if (contentType && contentType.includes('application/json')) {
		return res.body.json();
	}
	return res.body.text();
}

async function safeRead(res) {
	try {
		return await parseResponse(res);
	} catch {
		return null;
	}
}

function createRequestId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function redactHeaders(headers) {
	if (!headers || typeof headers !== 'object') return headers;

	const redacted = {};
	for (const [key, value] of Object.entries(headers)) {
		if (isSensitiveKey(key)) {
			redacted[key] = '[REDACTED]';
			continue;
		}
		redacted[key] = value;
	}
	return redacted;
}

function isSensitiveKey(key) {
	if (!key) return false;
	const normalized = String(key).toLowerCase();
	return (
		normalized.includes('authorization') ||
		normalized.includes('cookie') ||
		normalized.includes('token') ||
		normalized.includes('secret') ||
		normalized.includes('password') ||
		normalized.includes('api-key') ||
		normalized.includes('apikey')
	);
}

function sanitizeForLog(value, maxLen, depth = 0) {
	if (value === null || value === undefined) return value;
	if (depth > 5) return '[MaxDepthExceeded]';

	if (typeof value === 'string') {
		return value.length > maxLen
			? `${value.slice(0, maxLen)}...[truncated]`
			: value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeForLog(item, maxLen, depth + 1));
	}

	if (typeof value === 'object') {
		const output = {};
		for (const [key, val] of Object.entries(value)) {
			if (isSensitiveKey(key)) {
				output[key] = '[REDACTED]';
				continue;
			}
			output[key] = sanitizeForLog(val, maxLen, depth + 1);
		}
		return output;
	}

	return value;
}

/* ---------- Export ---------- */
module.exports = {
	HttpClient,
};