import { Command } from 'commander';
import { registerInstallCommand } from './commands/install';
import { registerListCommand } from './commands/list';
import { registerConfigureCommand } from './commands/configure';
import { registerDoctorCommand } from './commands/doctor';

export function createProgram(): Command {
    const program = new Command();

    program
        .name('partukkang')
        .description('Partukkang internal CLI for tools, packages, and developer configuration')
        .version('0.1.0');

    registerInstallCommand(program);
    registerListCommand(program);
    registerConfigureCommand(program);
    registerDoctorCommand(program);

    return program;
}
