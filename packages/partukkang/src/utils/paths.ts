import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

export function getHomeDir(): string {
    return os.homedir();
}

export function getBonaToolsDir(): string {
    return path.join(getHomeDir(), '.bonatools');
}

export function getPartukkangDir(): string {
    return path.join(getBonaToolsDir(), '.partukkang');
}

export function getPartukkangConfigPath(): string {
    return path.join(getPartukkangDir(), 'config.yaml');
}

export function getNpmrcPath(): string {
    return path.join(getHomeDir(), '.npmrc');
}

export async function ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
}
