import type { TokenStore } from './types';

/**
 * In-memory implementation of TokenStore.
 * Suitable for development and single-instance deployments.
 * For production with multiple instances, use Redis or PostgreSQL.
 */
export class InMemoryTokenStore implements TokenStore {
    private readonly store: Map<string, number> = new Map();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Create a new InMemoryTokenStore.
     * @param autoCleanupInterval - Interval in ms to auto-cleanup expired entries (default: 60000)
     */
    constructor(autoCleanupInterval: number = 60000) {
        if (autoCleanupInterval > 0) {
            this.startAutoCleanup(autoCleanupInterval);
        }
    }

    /**
     * Add a JTI to the denylist with expiration time.
     */
    async add(jti: string, expiresAt: number): Promise<void> {
        this.store.set(jti, expiresAt);
    }

    /**
     * Check if a JTI is in the denylist and not expired.
     */
    async has(jti: string): Promise<boolean> {
        const expiresAt = this.store.get(jti);
        if (expiresAt === undefined) {
            return false;
        }

        const now = Math.floor(Date.now() / 1000);
        if (expiresAt < now) {
            // Entry has expired, remove it
            this.store.delete(jti);
            return false;
        }

        return true;
    }

    /**
     * Remove a JTI from the denylist.
     */
    async remove(jti: string): Promise<void> {
        this.store.delete(jti);
    }

    /**
     * Remove all expired entries from the store.
     */
    async cleanup(): Promise<void> {
        const now = Math.floor(Date.now() / 1000);
        for (const [jti, expiresAt] of this.store.entries()) {
            if (expiresAt < now) {
                this.store.delete(jti);
            }
        }
    }

    /**
     * Get the current size of the denylist.
     */
    size(): number {
        return this.store.size;
    }

    /**
     * Clear all entries from the store.
     */
    clear(): void {
        this.store.clear();
    }

    /**
     * Stop the automatic cleanup interval.
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Start automatic cleanup of expired entries.
     */
    private startAutoCleanup(intervalMs: number): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup().catch(() => {
                // Ignore cleanup errors in background task
            });
        }, intervalMs);

        // Allow the process to exit even if cleanup is scheduled
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }
}

/**
 * Create a new InMemoryTokenStore instance.
 * Factory function for convenience.
 */
export function createInMemoryTokenStore(autoCleanupInterval?: number): InMemoryTokenStore {
    return new InMemoryTokenStore(autoCleanupInterval);
}
