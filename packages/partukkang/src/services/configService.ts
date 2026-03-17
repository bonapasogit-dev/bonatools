import fs from 'node:fs/promises';
import yaml from 'yaml';
import { PartukkangConfig } from '../types';
import { ensureDir, getPartukkangConfigPath, getPartukkangDir } from '../utils/paths';

const DEFAULT_CONFIG_FILE = 'partukkang.config.yaml';

function toConfig(data: unknown): PartukkangConfig {
    if (!data || typeof data !== 'object') {
        return {};
    }

    return data as PartukkangConfig;
}

export async function readConfigFromFile(filePath?: string): Promise<PartukkangConfig> {
    const resolvedPath = filePath ?? DEFAULT_CONFIG_FILE;
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return toConfig(yaml.parse(content));
}

export async function saveGlobalConfig(config: PartukkangConfig): Promise<string> {
    await ensureDir(getPartukkangDir());
    const configPath = getPartukkangConfigPath();
    await fs.writeFile(configPath, yaml.stringify(config), 'utf-8');
    return configPath;
}

export function mergeConfigs(base: PartukkangConfig, incoming: PartukkangConfig): PartukkangConfig {
    return {
        npm: {
            ...base.npm,
            ...incoming.npm,
        },
        github: {
            ...base.github,
            ...incoming.github,
        },
    };
}

export async function readGlobalConfig(): Promise<PartukkangConfig> {
    const configPath = getPartukkangConfigPath();

    try {
        const content = await fs.readFile(configPath, 'utf-8');
        return toConfig(yaml.parse(content));
    } catch {
        return {};
    }
}

export function createConfigTemplate(): string {
    const template: PartukkangConfig = {
        npm: {
            user: 'your-name',
            email: 'your.email@company.com',
            scope: '@bonapasogit-dev',
            registry: 'https://registry.npmjs.org',
            authToken: 'ghp_xxx',
        },
        github: {
            user: 'your-github-user',
            token: 'ghp_xxx',
            org: 'bonapasogit-dev',
            repo: 'bonatools',
            ref: 'main',
        },
    };

    return yaml.stringify(template);
}
