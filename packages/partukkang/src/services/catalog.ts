import { InstallTarget, InstallType } from '../types';

function normalizeThing(thing: string): string {
    return thing.trim().replace(/^\/+/, '').replace(/\\/g, '/');
}

export function resolveInstallTarget(type: InstallType, thing: string): InstallTarget {
    const normalizedThing = normalizeThing(thing);

    if (type === 'packages') {
        const packageName = normalizedThing;
        return {
            kind: 'package',
            id: packageName,
        };
    }

    const basePrefix = type === 'scripts' ? 'tools/script/' : 'tools/';
    const sourcePath = normalizedThing.startsWith('tools/')
        ? normalizedThing
        : `${basePrefix}${normalizedThing}`;
    const isFile = /\.[a-zA-Z0-9]+$/.test(sourcePath);

    return {
        kind: isFile ? 'file' : 'directory',
        id: normalizedThing,
        sourcePath,
    };
}
