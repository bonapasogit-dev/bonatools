import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    JwtManager,
    createJwtManager,
    InMemoryTokenStore,
    JwtExpiredError,
    JwtRevokedError,
    JwtReplayError,
    JwtInvalidSignatureError,
    JwtMalformedError,
    JwtErrorCode,
    isJwtError,
} from '../src';

describe('JwtManager', () => {
    let jwtManager: JwtManager;
    let tokenStore: InMemoryTokenStore;

    beforeEach(() => {
        tokenStore = new InMemoryTokenStore(0); // Disable auto-cleanup for tests
        jwtManager = createJwtManager({
            algorithm: 'HS256',
            secret: 'test-secret-key-that-is-at-least-32-characters-long',
            tokenStore,
        });
    });

    afterEach(() => {
        tokenStore.destroy();
    });

    describe('sign', () => {
        it('should generate a valid JWT with required claims', () => {
            const token = jwtManager.sign({
                subject: 'user-123',
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);

            const payload = jwtManager.decode(token);
            expect(payload).toBeDefined();
            expect(payload?.jti).toBeDefined();
            expect(payload?.jti).toMatch(/^[0-9A-Z]{26}$/); // ULID format
            expect(payload?.sub).toBe('user-123');
            expect(payload?.aud).toBe('test-app');
            expect(payload?.iss).toBe('test-issuer');
            expect(payload?.iat).toBeDefined();
            expect(payload?.exp).toBeDefined();
        });

        it('should include custom claims', () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
                claims: {
                    role: 'admin',
                    permissions: ['read', 'write'],
                },
            });

            const payload = jwtManager.decode(token);
            expect(payload?.role).toBe('admin');
            expect(payload?.permissions).toEqual(['read', 'write']);
        });

        it('should set correct expiration time', () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
                expiresIn: 7200, // 2 hours
            });

            const payload = jwtManager.decode(token);
            const expectedExp = Math.floor(Date.now() / 1000) + 7200;
            expect(payload?.exp).toBeGreaterThanOrEqual(expectedExp - 2);
            expect(payload?.exp).toBeLessThanOrEqual(expectedExp + 2);
        });

        it('should mark one-time tokens', () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
                oneTimeToken: true,
            });

            const payload = jwtManager.decode(token);
            expect(payload?._ott).toBe(true);
        });
    });

    describe('verify', () => {
        it('should verify a valid token', async () => {
            const token = jwtManager.sign({
                subject: 'user-123',
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            const result = await jwtManager.verify(token);

            expect(result.payload.sub).toBe('user-123');
            expect(result.payload.aud).toBe('test-app');
            expect(result.payload.iss).toBe('test-issuer');
            expect(result.isOneTimeToken).toBe(false);
        });

        it('should verify with audience check', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            const result = await jwtManager.verify(token, { audience: 'test-app' });
            expect(result.payload.aud).toBe('test-app');
        });

        it('should verify with issuer check', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            const result = await jwtManager.verify(token, { issuer: 'test-issuer' });
            expect(result.payload.iss).toBe('test-issuer');
        });

        it('should throw JwtExpiredError for expired tokens', async () => {
            const shortLivedManager = createJwtManager({
                algorithm: 'HS256',
                secret: 'test-secret-key-that-is-at-least-32-characters-long',
                defaultExpiresIn: 0, // Expires immediately
            });

            const token = shortLivedManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
                expiresIn: -1, // Already expired
            });

            await expect(shortLivedManager.verify(token)).rejects.toThrow(JwtExpiredError);
        });

        it('should throw JwtInvalidSignatureError for tampered tokens', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            // Tamper with the token
            const [header, payload, signature] = token.split('.');
            const tamperedToken = `${header}.${payload}.${signature.slice(0, -5)}XXXXX`;

            await expect(jwtManager.verify(tamperedToken)).rejects.toThrow(
                JwtInvalidSignatureError,
            );
        });

        it('should throw JwtMalformedError for invalid tokens', async () => {
            await expect(jwtManager.verify('not-a-valid-token')).rejects.toThrow(JwtMalformedError);
        });
    });

    describe('revocation', () => {
        it('should revoke a token by JTI', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            const payload = jwtManager.decode(token)!;
            await jwtManager.revoke(payload.jti, payload.exp);

            await expect(jwtManager.verify(token)).rejects.toThrow(JwtRevokedError);
        });

        it('should revoke a token directly', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            await jwtManager.revokeToken(token);

            await expect(jwtManager.verify(token)).rejects.toThrow(JwtRevokedError);
        });

        it('should check if a JTI is revoked', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            const payload = jwtManager.decode(token)!;

            expect(await jwtManager.isRevoked(payload.jti)).toBe(false);

            await jwtManager.revoke(payload.jti, payload.exp);

            expect(await jwtManager.isRevoked(payload.jti)).toBe(true);
        });

        it('should unrevoke a token', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            const payload = jwtManager.decode(token)!;
            await jwtManager.revoke(payload.jti, payload.exp);

            expect(await jwtManager.isRevoked(payload.jti)).toBe(true);

            await jwtManager.unrevoke(payload.jti);

            expect(await jwtManager.isRevoked(payload.jti)).toBe(false);
            const result = await jwtManager.verify(token);
            expect(result.payload.jti).toBe(payload.jti);
        });
    });

    describe('one-time tokens', () => {
        it('should verify one-time token on first use', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
                oneTimeToken: true,
            });

            const result = await jwtManager.verify(token);
            expect(result.isOneTimeToken).toBe(true);
        });

        it('should throw JwtReplayError on second use of one-time token', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
                oneTimeToken: true,
            });

            // First use - should succeed
            await jwtManager.verify(token);

            // Second use - should fail
            try {
                await jwtManager.verify(token);
                expect.fail('Should have thrown JwtReplayError');
            } catch (error) {
                expect(isJwtError(error)).toBe(true);
                expect((error as JwtReplayError).code).toBe(JwtErrorCode.REPLAY);
            }
        });
    });

    describe('decode', () => {
        it('should decode a token without verification', () => {
            const token = jwtManager.sign({
                subject: 'user-123',
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            const payload = jwtManager.decode(token);
            expect(payload?.sub).toBe('user-123');
        });

        it('should return null for invalid tokens', () => {
            const payload = jwtManager.decode('invalid-token');
            expect(payload).toBeNull();
        });
    });

    describe('error handling', () => {
        it('should have correct error codes', async () => {
            const token = jwtManager.sign({
                audience: 'test-app',
                issuer: 'test-issuer',
            });

            await jwtManager.revokeToken(token);

            try {
                await jwtManager.verify(token);
            } catch (error) {
                expect(isJwtError(error)).toBe(true);
                expect((error as JwtRevokedError).code).toBe(JwtErrorCode.REVOKED);
                expect((error as JwtRevokedError).toJSON()).toEqual({
                    code: JwtErrorCode.REVOKED,
                    message: expect.stringContaining('has been revoked'),
                    name: 'JwtRevokedError',
                });
            }
        });
    });
});

describe('InMemoryTokenStore', () => {
    let store: InMemoryTokenStore;

    beforeEach(() => {
        store = new InMemoryTokenStore(0);
    });

    afterEach(() => {
        store.destroy();
    });

    it('should add and check JTI', async () => {
        const jti = 'test-jti-123';
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;

        await store.add(jti, expiresAt);
        expect(await store.has(jti)).toBe(true);
    });

    it('should remove JTI', async () => {
        const jti = 'test-jti-123';
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;

        await store.add(jti, expiresAt);
        await store.remove(jti);
        expect(await store.has(jti)).toBe(false);
    });

    it('should auto-expire entries on check', async () => {
        const jti = 'test-jti-123';
        const expiresAt = Math.floor(Date.now() / 1000) - 1; // Already expired

        await store.add(jti, expiresAt);
        expect(await store.has(jti)).toBe(false);
    });

    it('should cleanup expired entries', async () => {
        const activeJti = 'active-jti';
        const expiredJti = 'expired-jti';

        await store.add(activeJti, Math.floor(Date.now() / 1000) + 3600);
        await store.add(expiredJti, Math.floor(Date.now() / 1000) - 1);

        await store.cleanup();

        expect(store.size()).toBe(1);
        expect(await store.has(activeJti)).toBe(true);
    });

    it('should clear all entries', async () => {
        await store.add('jti-1', Math.floor(Date.now() / 1000) + 3600);
        await store.add('jti-2', Math.floor(Date.now() / 1000) + 3600);

        expect(store.size()).toBe(2);

        store.clear();

        expect(store.size()).toBe(0);
    });
});
