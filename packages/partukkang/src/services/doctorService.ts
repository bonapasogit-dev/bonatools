import fs from 'node:fs/promises';
import { DoctorCheck, DoctorOptions, DoctorStatus, PartukkangConfig } from '../types';
import { mergeConfigs, readGlobalConfig, saveGlobalConfig } from './configService';
import { applyNpmConfig } from './npmrcService';
import { getNpmrcPath, getPartukkangConfigPath } from '../utils/paths';
import { isCommandAvailable } from '../utils/system';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const DEFAULT_ORG = 'bonapasogit-dev';
const DEFAULT_REPO = 'bonatools';
const DEFAULT_REF = 'main';

function makeCheck(
    name: string,
    status: DoctorStatus,
    message: string,
    recommendation?: string,
): DoctorCheck {
    return { name, status, message, recommendation };
}

export function buildSafeFixedConfig(config: PartukkangConfig): PartukkangConfig {
    const safeDefaults: PartukkangConfig = {
        npm: {
            scope: '@bonapasogit-dev',
            registry: DEFAULT_REGISTRY,
        },
        github: {
            org: DEFAULT_ORG,
            repo: DEFAULT_REPO,
            ref: DEFAULT_REF,
        },
    };

    return mergeConfigs(safeDefaults, config);
}

async function applySafeFixes(): Promise<DoctorCheck[]> {
    const checks: DoctorCheck[] = [];
    const currentConfig = await readGlobalConfig();
    const fixedConfig = buildSafeFixedConfig(currentConfig);
    const configPath = getPartukkangConfigPath();

    const hasConfigFile = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);

    const currentText = JSON.stringify(currentConfig);
    const fixedText = JSON.stringify(fixedConfig);

    if (!hasConfigFile || currentText !== fixedText) {
        await saveGlobalConfig(fixedConfig);
        checks.push(
            makeCheck(
                'fix-partukkang-config',
                'pass',
                `Applied safe defaults into ${configPath}`,
                'Review and add your personal values (user/email/token) as needed',
            ),
        );
    } else {
        checks.push(makeCheck('fix-partukkang-config', 'pass', 'Global Partukkang config already aligned'));
    }

    if (fixedConfig.npm) {
        const npmrcPath = await applyNpmConfig(fixedConfig.npm);
        checks.push(
            makeCheck(
                'fix-npmrc',
                'pass',
                `Ensured npm registry defaults are present in ${npmrcPath}`,
            ),
        );
    }

    if (!fixedConfig.github?.token) {
        checks.push(
            makeCheck(
                'fix-github-token',
                'warn',
                'GitHub token is not auto-generated for safety',
                'Set github.token manually in partukkang config',
            ),
        );
    }

    return checks;
}

export function evaluateNodeVersion(versionString: string): DoctorCheck {
    const major = Number.parseInt(versionString.replace(/^v/, '').split('.')[0] ?? '0', 10);

    if (major >= 18) {
        return makeCheck('node-version', 'pass', `Node.js ${versionString} is supported`);
    }

    return makeCheck(
        'node-version',
        'fail',
        `Node.js ${versionString} is not supported`,
        'Install Node.js 18 or newer',
    );
}

async function checkGlobalConfig(config: PartukkangConfig): Promise<DoctorCheck[]> {
    const checks: DoctorCheck[] = [];
    const configPath = getPartukkangConfigPath();

    try {
        await fs.access(configPath);
        checks.push(makeCheck('partukkang-config', 'pass', `Found global config at ${configPath}`));
    } catch {
        checks.push(
            makeCheck(
                'partukkang-config',
                'warn',
                `No global config found at ${configPath}`,
                'Run `partukkang configure init` then `partukkang configure apply`',
            ),
        );
    }

    if (config.github?.token) {
        checks.push(makeCheck('github-token', 'pass', 'GitHub token is configured'));
    } else {
        checks.push(
            makeCheck(
                'github-token',
                'warn',
                'GitHub token is not configured',
                'Add github.token in partukkang config for private repository access',
            ),
        );
    }

    return checks;
}

async function checkNpmrc(config: PartukkangConfig): Promise<DoctorCheck> {
    const npmrcPath = getNpmrcPath();

    try {
        const npmrc = await fs.readFile(npmrcPath, 'utf-8');
        const registry = config.npm?.registry ?? DEFAULT_REGISTRY;
        const hasRegistry =
            npmrc.includes(`registry=${registry}`) || npmrc.includes(`:registry=${registry}`);

        if (hasRegistry) {
            return makeCheck('npmrc-registry', 'pass', `Registry is configured in ${npmrcPath}`);
        }

        return makeCheck(
            'npmrc-registry',
            'warn',
            `Registry ${registry} not found in ${npmrcPath}`,
            'Run `partukkang configure apply` to update npmrc',
        );
    } catch {
        return makeCheck(
            'npmrc-registry',
            'warn',
            `No npmrc found at ${npmrcPath}`,
            'Run `partukkang configure apply` to create npmrc entries',
        );
    }
}

async function checkNetwork(config: PartukkangConfig): Promise<DoctorCheck[]> {
    const checks: DoctorCheck[] = [];
    const registry = config.npm?.registry ?? DEFAULT_REGISTRY;

    try {
        const response = await fetch(registry, { method: 'GET' });
        if (response.ok) {
            checks.push(makeCheck('network-registry', 'pass', `Registry reachable: ${registry}`));
        } else {
            checks.push(
                makeCheck(
                    'network-registry',
                    'warn',
                    `Registry returned HTTP ${response.status}: ${registry}`,
                    'Check VPN, internet, or registry URL',
                ),
            );
        }
    } catch {
        checks.push(
            makeCheck(
                'network-registry',
                'warn',
                `Cannot reach registry: ${registry}`,
                'Check internet connectivity or proxy settings',
            ),
        );
    }

    return checks;
}

export function summarizeChecks(checks: DoctorCheck[]): DoctorStatus {
    if (checks.some((check) => check.status === 'fail')) {
        return 'fail';
    }
    if (checks.some((check) => check.status === 'warn')) {
        return 'warn';
    }
    return 'pass';
}

export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorCheck[]> {
    const checks: DoctorCheck[] = [];

    if (options.fix) {
        checks.push(...(await applySafeFixes()));
    }

    const config = await readGlobalConfig();

    checks.push(evaluateNodeVersion(process.version));

    const npmExists = await isCommandAvailable('npm');
    checks.push(
        npmExists
            ? makeCheck('npm-command', 'pass', 'npm command is available')
            : makeCheck(
                'npm-command',
                'fail',
                'npm command is not available',
                'Install Node.js with npm',
            ),
    );

    const gitExists = await isCommandAvailable('git');
    checks.push(
        gitExists
            ? makeCheck('git-command', 'pass', 'git command is available')
            : makeCheck(
                'git-command',
                'warn',
                'git command is not available',
                'Install git for tool sync operations',
            ),
    );

    checks.push(...(await checkGlobalConfig(config)));
    checks.push(await checkNpmrc(config));

    if (!options.skipNetwork) {
        checks.push(...(await checkNetwork(config)));
    } else {
        checks.push(
            makeCheck('network-registry', 'warn', 'Network check skipped (--skip-network)'),
        );
    }

    return checks;
}
