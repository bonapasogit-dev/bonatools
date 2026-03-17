import { InstallOptions } from '../types';
import { readGlobalConfig } from './configService';

export interface GitHubRepoRef {
    org: string;
    repo: string;
    ref: string;
}

export interface GitHubContentEntry {
    type: 'file' | 'dir';
    path: string;
    name: string;
}

interface GitHubContentFileResponse {
    type: 'file';
    name: string;
    path: string;
    content?: string;
    encoding?: string;
}

interface GitHubContentDirEntry {
    type: 'file' | 'dir';
    path: string;
    name: string;
}

type GitHubContentsApiResponse = GitHubContentFileResponse | GitHubContentDirEntry[];

export async function resolveGitHubToken(options: InstallOptions): Promise<string | undefined> {
    if (options.token) {
        return options.token;
    }

    if (process.env.GITHUB_TOKEN) {
        return process.env.GITHUB_TOKEN;
    }

    if (process.env.GH_TOKEN) {
        return process.env.GH_TOKEN;
    }

    const config = await readGlobalConfig();
    return config.github?.token;
}

function buildHeaders(
    token?: string,
    accept: string = 'application/vnd.github+json',
): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: accept,
        'User-Agent': 'partukkang-cli',
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function contentsUrl({ org, repo, ref }: GitHubRepoRef, contentPath: string): string {
    return `https://api.github.com/repos/${org}/${repo}/contents/${contentPath}?ref=${encodeURIComponent(
        ref,
    )}`;
}

export async function fetchGitHubContents(
    repoRef: GitHubRepoRef,
    contentPath: string,
    token?: string,
): Promise<GitHubContentsApiResponse> {
    const response = await fetch(contentsUrl(repoRef, contentPath), {
        headers: buildHeaders(token),
    });

    if (!response.ok) {
        const tokenHint = token
            ? ''
            : ' Add github.token in ~/.partukkang/config.yaml, set GITHUB_TOKEN, or pass --token.';
        throw new Error(
            `Unable to fetch GitHub contents for ${contentPath} (status ${response.status}).${tokenHint}`,
        );
    }

    return (await response.json()) as GitHubContentsApiResponse;
}

export async function fetchGitHubRawFile(
    repoRef: GitHubRepoRef,
    contentPath: string,
    token?: string,
): Promise<Buffer> {
    const response = await fetch(contentsUrl(repoRef, contentPath), {
        headers: buildHeaders(token, 'application/vnd.github.raw+json'),
    });

    if (!response.ok) {
        const tokenHint = token
            ? ''
            : ' Add github.token in ~/.partukkang/config.yaml, set GITHUB_TOKEN, or pass --token.';
        throw new Error(
            `Unable to download ${contentPath} (status ${response.status}).${tokenHint}`,
        );
    }

    return Buffer.from(await response.arrayBuffer());
}

export async function listGitHubFilesRecursive(
    repoRef: GitHubRepoRef,
    rootPath: string,
    token?: string,
): Promise<GitHubContentEntry[]> {
    const queue = [rootPath];
    const files: GitHubContentEntry[] = [];

    while (queue.length > 0) {
        const currentPath = queue.shift();
        if (!currentPath) {
            continue;
        }

        const contents = await fetchGitHubContents(repoRef, currentPath, token);
        const entries = Array.isArray(contents) ? contents : [contents];

        for (const entry of entries) {
            if (entry.type === 'dir') {
                queue.push(entry.path);
                continue;
            }

            files.push({ type: 'file', path: entry.path, name: entry.name });
        }
    }

    return files;
}
