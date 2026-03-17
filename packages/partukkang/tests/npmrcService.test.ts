import { describe, expect, it } from 'vitest';
import { renderNpmrcEntries } from '../src/services/npmrcService';

describe('renderNpmrcEntries', () => {
    it('renders expected npmrc entries with scoped registry and token', () => {
        const lines = renderNpmrcEntries({
            user: 'Vicktor',
            email: 'vicktor@example.com',
            scope: '@bonapasogit-dev',
            registry: 'https://npm.pkg.github.com',
            authToken: 'ghp_abc',
        });

        expect(lines).toContain('init-author-name=Vicktor');
        expect(lines).toContain('init-author-email=vicktor@example.com');
        expect(lines).toContain('registry=https://npm.pkg.github.com');
        expect(lines).toContain('@bonapasogit-dev:registry=https://npm.pkg.github.com');
        expect(lines).toContain('//npm.pkg.github.com/:_authToken=ghp_abc');
    });

    it('does not include token line when token missing', () => {
        const lines = renderNpmrcEntries({
            registry: 'https://npm.pkg.github.com',
        });

        expect(lines.some((line) => line.includes('_authToken'))).toBe(false);
    });
});
