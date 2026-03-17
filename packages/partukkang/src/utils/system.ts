import { spawn } from 'node:child_process';

export function isCommandAvailable(
    command: string,
    versionArg: string = '--version',
): Promise<boolean> {
    return new Promise((resolve) => {
        const child = spawn(command, [versionArg], {
            stdio: 'ignore',
            shell: process.platform === 'win32',
        });

        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
    });
}
