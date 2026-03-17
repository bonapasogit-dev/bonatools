import { InstallOptions, InstallType } from '../types';
import {
    fetchGitHubContents,
    listGitHubFilesRecursive,
    GitHubRepoRef,
    resolveGitHubToken,
} from './githubService';

const DEFAULT_ORG = 'bonapasogit-dev';
const DEFAULT_REPO = 'bonatools';
const DEFAULT_REF = 'main';

function normalizePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/');
}

interface PackageListItem {
    path: string;
    packageName: string;
}

async function listPackages(repoRef: GitHubRepoRef, token?: string): Promise<PackageListItem[]> {
    const rootContents = await fetchGitHubContents(repoRef, 'packages', token);
    const entries = Array.isArray(rootContents) ? rootContents : [rootContents];
    const packagePaths = entries.filter((entry) => entry.type === 'dir').map((entry) => entry.path);

    const result: PackageListItem[] = [];

    for (const packagePath of packagePaths) {
        const packageJsonPath = `${packagePath}/package.json`;
        const packageJson = await fetchGitHubContents(repoRef, packageJsonPath, token);
        if (Array.isArray(packageJson) || packageJson.type !== 'file') {
            continue;
        }

        if (!packageJson.content) {
            continue;
        }

        const raw = Buffer.from(
            packageJson.content,
            packageJson.encoding === 'base64' ? 'base64' : 'utf-8',
        ).toString('utf-8');

        const parsed = JSON.parse(raw) as { name?: string };
        if (!parsed.name) {
            continue;
        }

        result.push({
            path: normalizePath(packagePath),
            packageName: parsed.name,
        });
    }

    return result.sort((a, b) => a.path.localeCompare(b.path));
}

async function listPaths(
    type: InstallType,
    repoRef: GitHubRepoRef,
    token?: string,
): Promise<string[]> {
    if (type === 'tools') {
        const files = await listGitHubFilesRecursive(repoRef, 'tools', token);
        return files.map((entry) => normalizePath(entry.path)).sort((a, b) => a.localeCompare(b));
    }

    if (type === 'scripts') {
        const files = await listGitHubFilesRecursive(repoRef, 'tools/script', token);
        return files.map((entry) => normalizePath(entry.path)).sort((a, b) => a.localeCompare(b));
    }

    const packages = await listPackages(repoRef, token);
    return packages.map((entry) => `${entry.path} -> ${entry.packageName}`);
}

export async function listThings(
    type: InstallType,
    options: InstallOptions = {},
): Promise<string[]> {
    const org = options.org ?? DEFAULT_ORG;
    const repo = options.repo ?? DEFAULT_REPO;
    const ref = options.ref ?? DEFAULT_REF;
    const token = await resolveGitHubToken(options);
    const repoRef: GitHubRepoRef = { org, repo, ref };

    return listPaths(type, repoRef, token);
}
