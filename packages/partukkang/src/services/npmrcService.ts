import fs from 'node:fs/promises';
import { NpmConfig } from '../types';
import { getNpmrcPath } from '../utils/paths';

function normalizeRegistryHost(registry?: string): string | undefined {
    if (!registry) {
        return undefined;
    }

    const cleaned = registry.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return cleaned;
}

export function renderNpmrcEntries(npmConfig: NpmConfig): string[] {
    const entries: string[] = [];

    if (npmConfig.user) {
        entries.push(`init-author-name=${npmConfig.user}`);
    }

    if (npmConfig.email) {
        entries.push(`init-author-email=${npmConfig.email}`);
    }

    if (npmConfig.registry) {
        entries.push(`registry=${npmConfig.registry}`);
    }

    if (npmConfig.scope && npmConfig.registry) {
        entries.push(`${npmConfig.scope}:registry=${npmConfig.registry}`);
    }

    const host = normalizeRegistryHost(npmConfig.registry);
    if (host && npmConfig.authToken) {
        entries.push(`//${host}/:_authToken=${npmConfig.authToken}`);
    }

    return entries;
}

function mergeByKey(existingLines: string[], newLines: string[]): string[] {
    const merged = new Map<string, string>();
    const removedLegacyKeys = new Set(['email']);
    const keyFor = (line: string): string => {
        const idx = line.indexOf('=');
        if (idx === -1) {
            return line;
        }
        return line.slice(0, idx);
    };

    for (const line of existingLines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        const key = keyFor(trimmed);
        if (removedLegacyKeys.has(key)) {
            continue;
        }
        merged.set(key, trimmed);
    }

    for (const line of newLines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        merged.set(keyFor(trimmed), trimmed);
    }

    return Array.from(merged.values());
}

export async function applyNpmConfig(npmConfig: NpmConfig): Promise<string> {
    const npmrcPath = getNpmrcPath();
    const entries = renderNpmrcEntries(npmConfig);

    if (entries.length === 0) {
        return npmrcPath;
    }

    let existing = '';
    try {
        existing = await fs.readFile(npmrcPath, 'utf-8');
    } catch {
        existing = '';
    }

    const merged = mergeByKey(existing.split(/\r?\n/), entries);
    await fs.writeFile(npmrcPath, `${merged.join('\n')}\n`, 'utf-8');
    return npmrcPath;
}
