#!/usr/bin/env node

import { createProgram } from './cli';
import { log } from './utils/logger';

async function main(): Promise<void> {
    const program = createProgram();
    await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    log.error(message);
    process.exitCode = 1;
});
