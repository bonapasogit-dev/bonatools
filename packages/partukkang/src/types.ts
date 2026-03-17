export type InstallType = 'tools' | 'packages' | 'scripts';

export interface InstallOptions {
    org?: string;
    repo?: string;
    ref?: string;
    dest?: string;
    token?: string;
    registry?: string;
    scope?: string;
    dryRun?: boolean;
}

export interface NpmConfig {
    user?: string;
    email?: string;
    registry?: string;
    scope?: string;
    authToken?: string;
}

export interface GitHubConfig {
    user?: string;
    token?: string;
    org?: string;
    repo?: string;
    ref?: string;
}

export interface PartukkangConfig {
    npm?: NpmConfig;
    github?: GitHubConfig;
}

export interface ConfigureOptions {
    file?: string;
    dryRun?: boolean;
}

export interface InstallTarget {
    kind: 'package' | 'file' | 'directory';
    id: string;
    sourcePath?: string;
}

export type DoctorStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
    name: string;
    status: DoctorStatus;
    message: string;
    recommendation?: string;
}

export interface DoctorOptions {
    skipNetwork?: boolean;
    fix?: boolean;
}
