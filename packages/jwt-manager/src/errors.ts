import { JwtErrorCode } from './types';

/**
 * Base error class for all JWT-related errors.
 */
export abstract class JwtError extends Error {
    abstract readonly code: JwtErrorCode;

    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert error to a structured object for logging/API responses.
     */
    toJSON(): { code: JwtErrorCode; message: string; name: string } {
        return {
            code: this.code,
            message: this.message,
            name: this.name,
        };
    }
}

/**
 * Token has expired (exp claim is in the past).
 */
export class JwtExpiredError extends JwtError {
    readonly code = JwtErrorCode.EXPIRED;
    readonly expiredAt: Date;

    constructor(expiredAt: Date) {
        super(`Token expired at ${expiredAt.toISOString()}`);
        this.expiredAt = expiredAt;
    }
}

/**
 * Token has been revoked (JTI found in denylist).
 */
export class JwtRevokedError extends JwtError {
    readonly code = JwtErrorCode.REVOKED;
    readonly jti: string;

    constructor(jti: string) {
        super(`Token with JTI "${jti}" has been revoked`);
        this.jti = jti;
    }
}

/**
 * One-time token has already been used (replay attack detected).
 */
export class JwtReplayError extends JwtError {
    readonly code = JwtErrorCode.REPLAY;
    readonly jti: string;

    constructor(jti: string) {
        super(`Token with JTI "${jti}" has already been used`);
        this.jti = jti;
    }
}

/**
 * Token signature is invalid.
 */
export class JwtInvalidSignatureError extends JwtError {
    readonly code = JwtErrorCode.INVALID_SIGNATURE;

    constructor() {
        super('Token signature is invalid');
    }
}

/**
 * Token claims validation failed (missing or invalid aud, iss, etc).
 */
export class JwtInvalidClaimsError extends JwtError {
    readonly code = JwtErrorCode.INVALID_CLAIMS;
    readonly claim: string;

    constructor(claim: string, reason: string) {
        super(`Invalid claim "${claim}": ${reason}`);
        this.claim = claim;
    }
}

/**
 * Token is malformed or cannot be decoded.
 */
export class JwtMalformedError extends JwtError {
    readonly code = JwtErrorCode.MALFORMED;

    constructor(reason?: string) {
        super(reason ? `Malformed token: ${reason}` : 'Token is malformed');
    }
}

/**
 * Type guard to check if an error is a JwtError.
 */
export function isJwtError(error: unknown): error is JwtError {
    return error instanceof JwtError;
}

/**
 * Map of error codes to error classes for programmatic handling.
 */
export const JwtErrors = {
    JwtExpiredError,
    JwtRevokedError,
    JwtReplayError,
    JwtInvalidSignatureError,
    JwtInvalidClaimsError,
    JwtMalformedError,
} as const;
