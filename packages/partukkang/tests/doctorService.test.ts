import { describe, expect, it } from 'vitest';
import {
    buildSafeFixedConfig,
    evaluateNodeVersion,
    summarizeChecks,
} from '../src/services/doctorService';

describe('doctorService', () => {
    it('passes supported node versions', () => {
        const check = evaluateNodeVersion('v20.11.1');
        expect(check.status).toBe('pass');
    });

    it('fails unsupported node versions', () => {
        const check = evaluateNodeVersion('v16.20.0');
        expect(check.status).toBe('fail');
        expect(check.recommendation).toContain('Node.js 18');
    });

    it('summarizes with fail priority over warn/pass', () => {
        const summary = summarizeChecks([
            { name: 'a', status: 'pass', message: 'ok' },
            { name: 'b', status: 'warn', message: 'warn' },
            { name: 'c', status: 'fail', message: 'fail' },
        ]);

        expect(summary).toBe('fail');
    });

    it('summarizes warn when no fails', () => {
        const summary = summarizeChecks([
            { name: 'a', status: 'pass', message: 'ok' },
            { name: 'b', status: 'warn', message: 'warn' },
        ]);

        expect(summary).toBe('warn');
    });

    it('adds safe defaults without overwriting existing values', () => {
        const fixed = buildSafeFixedConfig({
            npm: { user: 'vicktor' },
            github: { org: 'CUSTOM-ORG' },
        });

        expect(fixed.npm?.user).toBe('vicktor');
        expect(fixed.npm?.registry).toBe('https://registry.npmjs.org');
        expect(fixed.npm?.scope).toBe('@bonapasogit-dev');
        expect(fixed.github?.org).toBe('CUSTOM-ORG');
        expect(fixed.github?.repo).toBe('bonatools');
        expect(fixed.github?.ref).toBe('main');
    });
});
