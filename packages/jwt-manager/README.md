# @bonapasogit-dev/jwt-manager

High-performance JWT lifecycle management library with JTI validation for preventing replay attacks and enabling token revocation.

## Features

- ✅ **JTI Validation** - Unique token IDs using ULID for collision-free identification
- ✅ **Token Revocation** - Blacklist tokens before expiry
- ✅ **One-Time Tokens** - Single-use tokens with automatic invalidation
- ✅ **Security-First** - Enforces `aud`, `iss`, `exp` claims on all tokens
- ✅ **Multiple Algorithms** - RS256, ES256, HS256, and more
- ✅ **TypeScript** - Full type safety with comprehensive types

## Installation

```bash
npm install @bonapasogit-dev/jwt-manager
```

## Quick Start

### Using HMAC (HS256)

```typescript
import { createJwtManager } from '@bonapasogit-dev/jwt-manager';

const jwtManager = createJwtManager({
    algorithm: 'HS256',
    secret: 'your-secret-key-min-32-characters-long',
});

// Sign a token
const token = jwtManager.sign({
    subject: 'user-123',
    audience: 'my-app',
    issuer: 'auth-service',
    expiresIn: 3600, // 1 hour
    claims: {
        role: 'admin',
    },
});

// Verify a token
const result = await jwtManager.verify(token);
console.log(result.payload.sub); // 'user-123'
console.log(result.payload.jti); // ULID (e.g., '01ARZ3NDEKTSV4RRFFQ69DT1FK')
```

### Using RSA (RS256) - Recommended for Production

```typescript
import { createJwtManager } from '@bonapasogit-dev/jwt-manager';
import fs from 'fs';

const jwtManager = createJwtManager({
    algorithm: 'RS256',
    privateKey: fs.readFileSync('./private.pem', 'utf-8'),
    publicKey: fs.readFileSync('./public.pem', 'utf-8'),
});
```

## Token Revocation

Revoke tokens before their natural expiry:

```typescript
// Revoke by JTI
const payload = jwtManager.decode(token);
await jwtManager.revoke(payload.jti, payload.exp);

// Or revoke directly from token
await jwtManager.revokeToken(token);

// Verification will now fail
try {
    await jwtManager.verify(token);
} catch (error) {
    if (error instanceof JwtRevokedError) {
        console.log('Token has been revoked');
    }
}
```

## One-Time Tokens

Create tokens that can only be used once (e.g., for password reset):

```typescript
const oneTimeToken = jwtManager.sign({
    subject: 'user-123',
    audience: 'password-reset',
    issuer: 'auth-service',
    expiresIn: 900, // 15 minutes
    oneTimeToken: true,
});

// First verification succeeds
const result = await jwtManager.verify(oneTimeToken);

// Second verification throws JwtReplayError
try {
    await jwtManager.verify(oneTimeToken);
} catch (error) {
    if (error instanceof JwtReplayError) {
        console.log('Token already used');
    }
}
```

## Custom Token Store

For distributed systems, implement the `TokenStore` interface with Redis or PostgreSQL:

```typescript
import { TokenStore, createJwtManager } from '@bonapasogit-dev/jwt-manager';
import Redis from 'ioredis';

class RedisTokenStore implements TokenStore {
    private redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    async add(jti: string, expiresAt: number): Promise<void> {
        const ttl = expiresAt - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
            await this.redis.setex(`jwt:revoked:${jti}`, ttl, '1');
        }
    }

    async has(jti: string): Promise<boolean> {
        const exists = await this.redis.exists(`jwt:revoked:${jti}`);
        return exists === 1;
    }

    async remove(jti: string): Promise<void> {
        await this.redis.del(`jwt:revoked:${jti}`);
    }

    async cleanup(): Promise<void> {
        // Redis handles TTL automatically
    }
}

const jwtManager = createJwtManager({
    algorithm: 'RS256',
    privateKey: '...',
    publicKey: '...',
    tokenStore: new RedisTokenStore(new Redis()),
});
```

## Error Handling

```typescript
import {
    JwtExpiredError,
    JwtRevokedError,
    JwtReplayError,
    JwtInvalidSignatureError,
    JwtInvalidClaimsError,
    JwtMalformedError,
    isJwtError,
    JwtErrorCode,
} from '@bonapasogit-dev/jwt-manager';

try {
    const result = await jwtManager.verify(token);
} catch (error) {
    if (isJwtError(error)) {
        switch (error.code) {
            case JwtErrorCode.EXPIRED:
                // Token has expired
                break;
            case JwtErrorCode.REVOKED:
                // Token was revoked
                break;
            case JwtErrorCode.REPLAY:
                // One-time token already used
                break;
            case JwtErrorCode.INVALID_SIGNATURE:
                // Signature verification failed
                break;
            case JwtErrorCode.INVALID_CLAIMS:
                // Missing or invalid claims
                break;
            case JwtErrorCode.MALFORMED:
                // Token cannot be decoded
                break;
        }
    }
}
```

## API Reference

### `JwtManager`

#### `sign(options: SignOptions): string`

Generate a JWT with auto-injected `jti`, `iat`, `exp` claims.

#### `verify(token: string, options?: VerifyOptions): Promise<VerifyResult>`

Verify a JWT's signature, expiry, and JTI status.

#### `revoke(jti: string, expiresAt: number): Promise<void>`

Add a JTI to the denylist.

#### `revokeToken(token: string): Promise<void>`

Revoke a token by decoding and extracting its JTI.

#### `decode(token: string): JwtPayload | null`

Decode without verification (for inspection only).

#### `isRevoked(jti: string): Promise<boolean>`

Check if a JTI has been revoked.

## Security Best Practices

1. **Use Asymmetric Algorithms** - RS256/ES256 for shared environments
2. **Rotate Keys Regularly** - Every 24-48 hours for production
3. **Keep Secrets Secure** - Use environment variables or secret managers
4. **Set Reasonable Expiry** - Balance security with user experience
5. **Implement Token Refresh** - Short-lived access tokens + long-lived refresh tokens

## License

MIT
