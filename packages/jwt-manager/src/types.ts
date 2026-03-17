import type { JwtPayload as BaseJwtPayload } from 'jsonwebtoken';

/**
 * Supported signing algorithms.
 * RS256/ES256 preferred for shared environments.
 */
export type Algorithm =
    | 'HS256'
    | 'HS384'
    | 'HS512'
    | 'RS256'
    | 'RS384'
    | 'RS512'
    | 'ES256'
    | 'ES384'
    | 'ES512';

/**
 * JWT payload with required security claims.
 * All tokens MUST include jti, aud, iss, and exp.
 */
export interface JwtPayload extends BaseJwtPayload {
    /** JWT ID - unique identifier for this token (ULID) */
    jti: string;
    /** Audience - intended recipient(s) of the token */
    aud: string | string[];
    /** Issuer - who issued this token */
    iss: string;
    /** Expiration time (Unix timestamp) */
    exp: number;
    /** Issued at (Unix timestamp) */
    iat: number;
    /** Subject - typically the user ID */
    sub?: string;
    /** Custom claims */
    [key: string]: unknown;
}

/**
 * Options for signing a new token.
 */
export interface SignOptions {
    /** Token subject (e.g., user ID) */
    subject?: string;
    /** Token audience */
    audience: string | string[];
    /** Token issuer */
    issuer: string;
    /** Expiration time in seconds (default: 3600) */
    expiresIn?: number;
    /** Additional custom claims */
    claims?: Record<string, unknown>;
    /** Enable one-time token mode (JTI added to denylist after first use) */
    oneTimeToken?: boolean;
}

/**
 * Options for verifying a token.
 */
export interface VerifyOptions {
    /** Expected audience(s) */
    audience?: string | string[];
    /** Expected issuer */
    issuer?: string;
    /** Clock tolerance in seconds for exp/nbf checks */
    clockTolerance?: number;
}

/**
 * Result of a successful token verification.
 */
export interface VerifyResult {
    /** Decoded payload */
    payload: JwtPayload;
    /** Whether this is a one-time token */
    isOneTimeToken: boolean;
}

/**
 * Configuration for JwtManager.
 */
export interface JwtManagerConfig {
    /** Signing algorithm (default: RS256) */
    algorithm: Algorithm;
    /** Secret key for HMAC algorithms (HS256, HS384, HS512) */
    secret?: string;
    /** Private key for RSA/EC algorithms (RS256, RS384, RS512, ES256, etc.) */
    privateKey?: string;
    /** Public key for RSA/EC algorithms (RS256, RS384, RS512, ES256, etc.) */
    publicKey?: string;
    /** Token store for JTI denylist */
    tokenStore?: TokenStore;
    /** Default token expiration in seconds (default: 3600) */
    defaultExpiresIn?: number;
}

/**
 * Abstract interface for JTI storage (denylist/whitelist).
 * Implementations can use Redis, PostgreSQL, or in-memory storage.
 */
export interface TokenStore {
    /**
     * Add a JTI to the denylist.
     * @param jti - The JWT ID to blacklist
     * @param expiresAt - Unix timestamp when this entry can be removed
     */
    add(jti: string, expiresAt: number): Promise<void>;

    /**
     * Check if a JTI is in the denylist.
     * @param jti - The JWT ID to check
     * @returns true if JTI is blacklisted
     */
    has(jti: string): Promise<boolean>;

    /**
     * Remove a JTI from the denylist.
     * @param jti - The JWT ID to remove
     */
    remove(jti: string): Promise<void>;

    /**
     * Clean up expired entries from the store.
     * Should be called periodically.
     */
    cleanup(): Promise<void>;
}

/**
 * Error codes for JWT operations.
 */
export enum JwtErrorCode {
    EXPIRED = 'ERR_JWT_EXPIRED',
    REVOKED = 'ERR_JWT_REVOKED',
    REPLAY = 'ERR_JWT_REPLAY',
    INVALID_SIGNATURE = 'ERR_JWT_INVALID_SIGNATURE',
    INVALID_CLAIMS = 'ERR_JWT_INVALID_CLAIMS',
    MALFORMED = 'ERR_JWT_MALFORMED',
}
