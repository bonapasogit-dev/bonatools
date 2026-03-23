class AppError extends Error {
	constructor(message, options = {}) {
		super(message);
		this.name = options.name || this.constructor.name;
		this.code = options.code;
		this.cause = options.cause;
		this.metadata = options.metadata;
	}

	toLogObject() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			metadata: this.metadata,
			cause: this.cause,
		};
	}
}

class HttpError extends AppError {
	constructor(message, status, body, options = {}) {
		super(message, {
			...options,
			name: 'HttpError',
			code: options.code || 'HTTP_ERROR',
			metadata: {
				...(options.metadata || {}),
				status,
			},
		});
		this.status = status;
		this.body = body;
	}

	toLogObject() {
		return {
			...super.toLogObject(),
			status: this.status,
			body: this.body,
		};
	}
}

class CircuitOpenError extends AppError {
	constructor(options = {}) {
		super('Circuit breaker is open', {
			...options,
			name: 'CircuitOpenError',
			code: options.code || 'CIRCUIT_OPEN',
		});
	}
}

function errorToLogObject(error) {
	if (!error) return { name: 'UnknownError', message: 'Unknown error' };

	if (typeof error.toLogObject === 'function') {
		return error.toLogObject();
	}

	return {
		name: error.name || 'Error',
		message: error.message || String(error),
		code: error.code,
		status: error.status,
		body: error.body,
		stack: error.stack,
	};
}

module.exports = {
	AppError,
	HttpError,
	CircuitOpenError,
	errorToLogObject,
};