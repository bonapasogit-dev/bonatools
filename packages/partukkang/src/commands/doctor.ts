import { Command } from 'commander';
import { runDoctor, summarizeChecks } from '../services/doctorService';
import { DoctorCheck } from '../types';
import { log } from '../utils/logger';

interface DoctorCliOptions {
    skipNetwork: boolean;
    json: boolean;
    fix: boolean;
}

function icon(status: DoctorCheck['status']): string {
    if (status === 'pass') {
        return '✔';
    }
    if (status === 'warn') {
        return '⚠';
    }
    return '✖';
}

function printHuman(checks: DoctorCheck[]): void {
    for (const check of checks) {
        console.log(`${icon(check.status)} ${check.name} - ${check.message}`);
        if (check.recommendation) {
            console.log(`  → ${check.recommendation}`);
        }
    }
}

export function registerDoctorCommand(program: Command): void {
    program
        .command('doctor')
        .description('Run environment and configuration health checks')
        .option('--skip-network', 'skip external network connectivity checks', false)
        .option('--fix', 'apply safe, non-destructive remediations before checks', false)
        .option('--json', 'output machine-readable JSON result', false)
        .action(async (options: DoctorCliOptions) => {
            const checks = await runDoctor({
                skipNetwork: options.skipNetwork,
                fix: options.fix,
            });
            const summary = summarizeChecks(checks);

            if (options.json) {
                console.log(JSON.stringify({ summary, checks }, null, 2));
            } else {
                printHuman(checks);
                log.info(`Doctor summary: ${summary.toUpperCase()}`);
            }

            if (summary === 'fail') {
                process.exitCode = 1;
            }
        });
}
