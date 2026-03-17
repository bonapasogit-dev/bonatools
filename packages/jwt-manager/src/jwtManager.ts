import jwt, { JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { ulid } from 'ulid';
import type {
    Algorithm,
    JwtManagerConfig,
    JwtPayload,
    SignOptions,
    TokenStore,
    VerifyOptions,
    VerifyResult,
} from './types';
import {
    JwtExpiredError,
    JwtInvalidClaimsError,
    JwtInvalidSignatureError,
    JwtMalformedError,
    JwtReplayError,
    JwtRevokedError,
} from './errors';
import { InMemoryTokenStore } from './tokenStore';

/** One-time token marker in payload */
const ONE_TIME_TOKEN_KEY = '_ott';

/**
 * High-performance JWT manager with JTI validation.
 * Implements secure token lifecycle with revocation support.
 */
export class JwtManager {
    private readonly algorithm: Algorithm;
    private readonly secret?: string;
    private readonly privateKey?: string;
    private readonly publicKey?: string;
    private readonly tokenStore: TokenStore;
    private readonly defaultExpiresIn: number;

    constructor(config: JwtManagerConfig) {
        this.algorithm = config.algorithm;
        this.secret = config.secret;
        this.privateKey = config.privateKey;
        this.publicKey = config.publicKey;
        this.tokenStore = config.tokenStore ?? new InMemoryTokenStore();
        this.defaultExpiresIn = config.defaultExpiresIn ?? 3600;

        this.validateConfig();
    }

    /**
     * Validate configuration on initialization.
     */
    private validateConfig(): void {
        const isHmac = this.algorithm.startsWith('HS');

        if (isHmac) {
            if (!this.secret) {
                throw new Error(`HMAC algorithm ${this.algorithm} requires a secret`);
            }
        } else {
            if (!this.privateKey) {
                throw new Error(`Asymmetric algorithm ${this.algorithm} requires a privateKey`);
            }
            if (!this.publicKey) {
                throw new Error(`Asymmetric algorithm ${this.algorithm} requires a publicKey`);
            }
        }
    }

    /**
     * Get the signing key based on algorithm type.
     */
    private getSigningKey(): string {
        return this.algorithm.startsWith('HS') ? this.secret! : this.privateKey!;
    }

    /**
     * Get the verification key based on algorithm type.
     */
    private getVerifyKey(): string {
        return this.algorithm.startsWith('HS') ? this.secret! : this.publicKey!;
    }

    /**
     * Sign a new JWT with auto-injected jti, iat, exp claims.
     * All tokens include required security claims (jti, aud, iss, exp).
     */
    sign(options: SignOptions): string {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = options.expiresIn ?? this.defaultExpiresIn;

        const payload: Record<string, unknown> = {
            ...options.claims,
            jti: ulid(),
            aud: options.audience,
            iss: options.issuer,
            iat: now,
            exp: now + expiresIn,
        };

        if (options.subject) {
            payload.sub = options.subject;
        }

        if (options.oneTimeToken) {
            payload[ONE_TIME_TOKEN_KEY] = true;
        }

        return jwt.sign(payload, this.getSigningKey(), {
            algorithm: this.algorithm,
        });
    }

    /**
     * Verify a JWT's signature, expiry, and JTI status.
     * Returns decoded payload if valid.
     * @throws {JwtExpiredError} Token has expired
     * @throws {JwtRevokedError} Token JTI is in denylist
     * @throws {JwtReplayError} One-time token already used
     * @throws {JwtInvalidSignatureError} Signature verification failed
     * @throws {JwtInvalidClaimsError} Required claims missing/invalid
     * @throws {JwtMalformedError} Token cannot be decoded
     */
    async verify(token: string, options?: VerifyOptions): Promise<VerifyResult> {
        let payload: JwtPayload;

        try {
            const verifyOpts: jwt.VerifyOptions = {
                algorithms: [this.algorithm],
                clockTolerance: options?.clockTolerance ?? 0,
            };

            if (options?.audience !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (verifyOpts as any).audience = options.audience;
            }
            if (options?.issuer !== undefined) {
                verifyOpts.issuer = options.issuer;
            }

            payload = jwt.verify(token, this.getVerifyKey(), verifyOpts) as JwtPayload;
        } catch (error) {
            if (error instanceof TokenExpiredError) {
                throw new JwtExpiredError(error.expiredAt);
            }
            if (error instanceof JsonWebTokenError) {
                if (error.message.includes('invalid signature')) {
                    throw new JwtInvalidSignatureError();
                }
                if (error.message.includes('jwt malformed')) {
                    throw new JwtMalformedError();
                }
                throw new JwtMalformedError(error.message);
            }
            if (error instanceof NotBeforeError) {
                throw new JwtInvalidClaimsError('nbf', 'Token not yet valid');
            }
            throw error;
        }

        // Validate required claims
        this.validateRequiredClaims(payload);

        // Check if JTI is revoked
        const isRevoked = await this.tokenStore.has(payload.jti);
        if (isRevoked) {
            const isOneTimeToken = payload[ONE_TIME_TOKEN_KEY] === true;
            if (isOneTimeToken) {
                throw new JwtReplayError(payload.jti);
            }
            throw new JwtRevokedError(payload.jti);
        }

        // Handle one-time tokens - mark as used after first verification
        const isOneTimeToken = payload[ONE_TIME_TOKEN_KEY] === true;
        if (isOneTimeToken) {
            await this.tokenStore.add(payload.jti, payload.exp);
        }

        return {
            payload,
            isOneTimeToken,
        };
    }

    /**
     * Validate that required claims are present in the payload.
     */
    private validateRequiredClaims(payload: JwtPayload): void {
        if (!payload.jti) {
            throw new JwtInvalidClaimsError('jti', 'Missing required claim');
        }
        if (!payload.aud) {
            throw new JwtInvalidClaimsError('aud', 'Missing required claim');
        }
        if (!payload.iss) {
            throw new JwtInvalidClaimsError('iss', 'Missing required claim');
        }
        if (typeof payload.exp !== 'number') {
            throw new JwtInvalidClaimsError('exp', 'Missing or invalid');
        }
    }

    /**
     * Revoke a token by adding its JTI to the denylist.
     * Token will be rejected on future verification attempts.
     * @param jti - The JWT ID to revoke
     * @param expiresAt - When this revocation can be removed (should match token exp)
     */
    async revoke(jti: string, expiresAt: number): Promise<void> {
        await this.tokenStore.add(jti, expiresAt);
    }

    /**
     * Revoke a token by decoding it and extracting the JTI.
     * @param token - The JWT string to revoke
     */
    async revokeToken(token: string): Promise<void> {
        const payload = this.decode(token);
        if (!payload || !payload.jti || typeof payload.exp !== 'number') {
            throw new JwtMalformedError('Cannot revoke token: invalid or missing claims');
        }
        await this.revoke(payload.jti, payload.exp);
    }

    /**
     * Decode a JWT without verification.
     * Use for inspection only, never trust the payload without verification.
     */
    decode(token: string): JwtPayload | null {
        try {
            const decoded = jwt.decode(token, { json: true });
            return decoded as JwtPayload | null;
        } catch {
            return null;
        }
    }

    /**
     * Check if a specific JTI has been revoked.
     */
    async isRevoked(jti: string): Promise<boolean> {
        return this.tokenStore.has(jti);
    }

    /**
     * Unrevoke a token by removing its JTI from the denylist.
     * Use with caution - this re-enables a previously revoked token.
     */
    async unrevoke(jti: string): Promise<void> {
        await this.tokenStore.remove(jti);
    }
}

/**
 * Create a new JwtManager instance.
 * Factory function for convenience.
 */
export function createJwtManager(config: JwtManagerConfig): JwtManager {
    return new JwtManager(config);
}
