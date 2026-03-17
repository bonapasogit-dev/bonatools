import { describe, expect, it } from 'vitest';
import { resolveInstallTarget } from '../src/services/catalog';

describe('resolveInstallTarget', () => {
    it('returns package input as-is (no alias mapping)', () => {
        const target = resolveInstallTarget('packages', 'packages/jwt-manager');
        expect(target).toEqual({ kind: 'package', id: 'packages/jwt-manager' });
    });

    it('resolves scripts type to tools/script prefix', () => {
        const target = resolveInstallTarget('scripts', 'scpconfig.sh');
        expect(target.kind).toBe('file');
        expect(target.sourcePath).toBe('tools/script/scpconfig.sh');
    });

    it('treats direct tools path as directory when no extension', () => {
        const target = resolveInstallTarget('tools', 'cli');
        expect(target.kind).toBe('directory');
        expect(target.sourcePath).toBe('tools/cli');
    });
});
