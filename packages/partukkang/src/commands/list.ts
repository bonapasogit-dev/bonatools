import { Command } from 'commander';
import { InstallType } from '../types';
import { listThings } from '../services/listingService';
import { log } from '../utils/logger';

interface ListCliOptions {
    org: string;
    repo: string;
    ref: string;
    token?: string;
    json: boolean;
}

function isInstallType(value: string): value is InstallType {
    return value === 'tools' || value === 'packages' || value === 'scripts';
}

export function registerListCommand(program: Command): void {
    program
        .command('list')
        .description('List installable items from bonatools repository')
        .argument('<type>', 'list type: tools | packages | scripts')
        .option('--org <org>', 'GitHub organization', 'bonapasogit-dev')
        .option('--repo <repo>', 'GitHub repository', 'bonatools')
        .option('--ref <ref>', 'Git reference (branch/tag/sha)', 'main')
        .option('--token <token>', 'GitHub token (optional, overrides config/env)')
        .option('--json', 'output machine-readable JSON', false)
        .action(async (type: string, options: ListCliOptions) => {
            if (!isInstallType(type)) {
                throw new Error(`Invalid list type: ${type}`);
            }

            const items = await listThings(type, {
                org: options.org,
                repo: options.repo,
                ref: options.ref,
                token: options.token,
            });

            if (options.json) {
                console.log(JSON.stringify({ type, count: items.length, items }, null, 2));
                return;
            }

            log.info(`Found ${items.length} ${type} item(s):`);
            for (const item of items) {
                console.log(item);
            }
        });
}
