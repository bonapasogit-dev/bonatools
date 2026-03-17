/**
 * @bonapasogit-dev/jwt-manager
 * High-performance JWT lifecycle management with JTI validation.
 */

// Core manager
export { JwtManager, createJwtManager } from './jwtManager';

// Token store implementations
export { InMemoryTokenStore, createInMemoryTokenStore } from './tokenStore';

// Types
export type {
    Algorithm,
    JwtManagerConfig,
    JwtPayload,
    SignOptions,
    TokenStore,
    VerifyOptions,
    VerifyResult,
} from './types';
export { JwtErrorCode } from './types';

// Errors
export {
    JwtError,
    JwtExpiredError,
    JwtRevokedError,
    JwtReplayError,
    JwtInvalidSignatureError,
    JwtInvalidClaimsError,
    JwtMalformedError,
    JwtErrors,
    isJwtError,
} from './errors';
