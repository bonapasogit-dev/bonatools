import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { InstallOptions, InstallType } from '../types';
import { resolveInstallTarget } from './catalog';
import { ensureDir } from '../utils/paths';
import { runCommand } from '../utils/process';
import {
    fetchGitHubContents,
    fetchGitHubRawFile,
    GitHubRepoRef,
    resolveGitHubToken,
} from './githubService';

const DEFAULT_ORG = 'bonapasogit-dev';
const DEFAULT_REPO = 'bonatools';
const DEFAULT_REF = 'main';

function buildRepoUrls(org: string, repo: string, ref: string, sourcePath: string) {
    const normalizedPath = sourcePath.replace(/^\/+/, '');
    return {
        rawUrl: `https://raw.githubusercontent.com/${org}/${repo}/${ref}/${normalizedPath}`,
        apiUrl: `https://api.github.com/repos/${org}/${repo}/contents/${normalizedPath}?ref=${encodeURIComponent(
            ref,
        )}`,
        cloneUrl: `https://github.com/${org}/${repo}.git`,
    };
}

function buildAuthenticatedCloneUrl(org: string, repo: string, token?: string): string {
    if (!token) {
        return `https://github.com/${org}/${repo}.git`;
    }

    return `https://x-access-token:${encodeURIComponent(token)}@github.com/${org}/${repo}.git`;
}

function isLikelyFile(pathValue: string): boolean {
    return /\.[a-zA-Z0-9]+$/.test(pathValue);
}

async function resolvePackageNameFromPath(
    repoRef: GitHubRepoRef,
    thing: string,
    token?: string,
): Promise<string> {
    const normalized = thing.replace(/^\/+/, '').replace(/\\/g, '/');
    const packageRoot = normalized.startsWith('packages/') ? normalized : `packages/${normalized}`;
    const packageJsonPath = `${packageRoot}/package.json`;
    const contents = await fetchGitHubContents(repoRef, packageJsonPath, token);

    if (Array.isArray(contents) || contents.type !== 'file') {
        throw new Error(`Unable to resolve package metadata at ${packageJsonPath}`);
    }

    const content = contents.content
        ? Buffer.from(
            contents.content,
            contents.encoding === 'base64' ? 'base64' : 'utf-8',
        ).toString('utf-8')
        : (await fetchGitHubRawFile(repoRef, packageJsonPath, token)).toString('utf-8');

    const parsed = JSON.parse(content) as { name?: string };
    if (!parsed.name) {
        throw new Error(`Invalid package.json at ${packageJsonPath}: missing name`);
    }

    return parsed.name;
}

async function installPackage(packageName: string): Promise<void> {
    await runCommand('npm', ['install', packageName], process.cwd());
}

async function downloadFile(
    repoRef: GitHubRepoRef,
    sourcePath: string,
    rawUrl: string,
    destinationPath: string,
    token?: string,
): Promise<void> {
    const content = await fetchGitHubRawFile(repoRef, sourcePath, token);
    await ensureDir(path.dirname(destinationPath));
    await fs.writeFile(destinationPath, content);
}

async function copyDirectoryFromRepo(
    cloneUrl: string,
    sourcePath: string,
    destinationRoot: string,
): Promise<void> {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'partukkang-cli-'));
    const repoTmp = path.join(tmpRoot, 'repo');

    try {
        await runCommand('git', [
            'clone',
            '--depth',
            '1',
            '--filter=blob:none',
            '--sparse',
            cloneUrl,
            repoTmp,
        ]);
        await runCommand('git', ['-C', repoTmp, 'sparse-checkout', 'set', sourcePath]);

        const sourceAbsolute = path.join(repoTmp, sourcePath);
        const destinationAbsolute = path.join(destinationRoot, path.basename(sourcePath));

        await ensureDir(destinationRoot);
        await fs.cp(sourceAbsolute, destinationAbsolute, {
            recursive: true,
            force: true,
        });
    } finally {
        await fs.rm(tmpRoot, { recursive: true, force: true });
    }
}

export async function installThing(
    type: InstallType,
    thing: string,
    options: InstallOptions = {},
): Promise<string> {
    const target = resolveInstallTarget(type, thing);
    const org = options.org ?? DEFAULT_ORG;
    const repo = options.repo ?? DEFAULT_REPO;
    const ref = options.ref ?? DEFAULT_REF;
    const dest = path.resolve(options.dest ?? process.cwd());
    const repoRef: GitHubRepoRef = { org, repo, ref };

    const token = await resolveGitHubToken(options);

    if (target.kind === 'package') {
        let packageName = target.id;

        if (target.id.includes('/')) {
            packageName = await resolvePackageNameFromPath(repoRef, target.id, token);
        }

        if (options.dryRun) {
            return `Dry run: npm install ${packageName}`;
        }

        await installPackage(packageName);
        return `Installed package ${packageName}`;
    }

    if (!target.sourcePath) {
        throw new Error('Missing source path for non-package install target');
    }

    const { rawUrl, apiUrl } = buildRepoUrls(org, repo, ref, target.sourcePath);
    const cloneUrl = buildAuthenticatedCloneUrl(org, repo, token);
    const treatAsFile = target.kind === 'file' || isLikelyFile(target.sourcePath);

    if (treatAsFile) {
        const fileName = path.basename(target.sourcePath);
        const destinationPath = path.join(dest, fileName);

        if (options.dryRun) {
            return `Dry run: download ${rawUrl} to ${destinationPath}${token ? ' (using token auth)' : ''}`;
        }

        await downloadFile(repoRef, target.sourcePath, rawUrl, destinationPath, token);
        return `Installed file ${fileName} to ${destinationPath}`;
    }

    if (options.dryRun) {
        return `Dry run: clone https://github.com/${org}/${repo}.git and copy ${target.sourcePath} into ${dest}${token ? ' (using token auth)' : ''}`;
    }

    await copyDirectoryFromRepo(cloneUrl, target.sourcePath, dest);
    return `Installed directory ${target.sourcePath} to ${dest}`;
}
