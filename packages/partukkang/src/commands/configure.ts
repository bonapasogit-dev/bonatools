import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import {
    createConfigTemplate,
    mergeConfigs,
    readConfigFromFile,
    readGlobalConfig,
    saveGlobalConfig,
} from '../services/configService';
import { applyNpmConfig } from '../services/npmrcService';
import { log } from '../utils/logger';
import { getPartukkangConfigPath } from '../utils/paths';

interface ConfigureInitOptions {
    output: string;
}

interface ConfigureApplyOptions {
    file: string;
    dryRun: boolean;
}

export function registerConfigureCommand(program: Command): void {
    const configure = program
        .command('configure')
        .description('Manage partukkang CLI configuration via YAML');

    configure
        .command('init')
        .description('Create a local partukkang.yaml template')
        .option('--output <path>', 'template output file path', getPartukkangConfigPath())
        .action(async (options: ConfigureInitOptions) => {
            const dir = path.dirname(path.resolve(options.output));
            await fs.mkdir(dir, { recursive: true });
            const outputPath = path.resolve(options.output);
            await fs.writeFile(outputPath, createConfigTemplate(), 'utf-8');
            log.success(`Template created at ${outputPath}`);
        });

    configure
        .command('apply')
        .description('Apply configuration from YAML file')
        .option('--file <path>', 'configuration yaml file', getPartukkangConfigPath())
        .option('--dry-run', 'validate and print without writing files', false)
        .action(async (options: ConfigureApplyOptions) => {
            const incoming = await readConfigFromFile(options.file);
            const existing = await readGlobalConfig();
            const merged = mergeConfigs(existing, incoming);

            if (options.dryRun) {
                log.info('Dry run: configuration parsed successfully');
                log.info(JSON.stringify(merged, null, 2));
                return;
            }

            const configPath = await saveGlobalConfig(merged);
            log.success(`Saved global partukkang config to ${configPath}`);

            if (merged.npm) {
                const npmrcPath = await applyNpmConfig(merged.npm);
                log.success(`Applied npm configuration into ${npmrcPath}`);
            }

            if (merged.github?.token) {
                log.warn(
                    'GitHub token saved in ~/.bonatools/.partukkang/config.yaml. Ensure your local profile is secure.',
                );
            }
        });
}
