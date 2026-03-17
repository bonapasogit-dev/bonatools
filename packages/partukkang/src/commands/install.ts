import { Command } from 'commander';
import { installThing } from '../services/installerService';
import { InstallType } from '../types';
import { log } from '../utils/logger';

interface InstallCliOptions {
    org: string;
    repo: string;
    ref: string;
    dest: string;
    token?: string;
    dryRun: boolean;
}

function isInstallType(value: string): value is InstallType {
    return value === 'tools' || value === 'packages' || value === 'scripts';
}

export function registerInstallCommand(program: Command): void {
    program
        .command('install')
        .description('Install internal tools/packages/scripts from bonatools repo')
        .argument('<type>', 'install type: tools | packages | scripts')
        .argument('<thing>', 'item path/name (recommended: copy from `partukkang list <type>` output)')
        .option('--org <org>', 'GitHub organization', 'bonapasogit-dev')
        .option('--repo <repo>', 'GitHub repository', 'bonatools')
        .option('--ref <ref>', 'Git reference (branch/tag/sha)', 'main')
        .option('--dest <dest>', 'destination folder for tools/scripts', '.')
        .option('--token <token>', 'GitHub token (optional, overrides config/env)')
        .option('--dry-run', 'print actions without executing', false)
        .action(async (type: string, thing: string, options: InstallCliOptions) => {
            if (!isInstallType(type)) {
                throw new Error(`Invalid install type: ${type}`);
            }

            const message = await installThing(type, thing, {
                org: options.org,
                repo: options.repo,
                ref: options.ref,
                dest: options.dest,
                token: options.token,
                dryRun: options.dryRun,
            });

            log.success(message);
        });
}
