import { describe, expect, it } from 'vitest';
import { mergeConfigs } from '../src/services/configService';

describe('mergeConfigs', () => {
    it('merges incoming npm and github config over existing values', () => {
        const merged = mergeConfigs(
            {
                npm: { user: 'old-user', registry: 'https://old.registry' },
                github: { org: 'OLD-ORG', repo: 'old-repo' },
            },
            {
                npm: { user: 'new-user' },
                github: { repo: 'bonatools', ref: 'main' },
            },
        );

        expect(merged.npm?.user).toBe('new-user');
        expect(merged.npm?.registry).toBe('https://old.registry');
        expect(merged.github?.org).toBe('OLD-ORG');
        expect(merged.github?.repo).toBe('bonatools');
        expect(merged.github?.ref).toBe('main');
    });
});
