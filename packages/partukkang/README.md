# @bonapasogit-dev/partukkang

Unified CLI for Partukkang internal developer workflows.

## Why this CLI exists

`partukkang` is the single interface to:

- install internal packages (`jwt-manager`, `responder`, etc.)
- pull tools/scripts from `bonatools/tools`
- apply local developer configuration from YAML (`npm`, GitHub metadata)

## Features

- ✅ Intuitive commands: `list`, `install`, `configure init`, `configure apply`, `doctor`
- ✅ Windows-friendly implementation (Node APIs + shell-safe process spawning)
- ✅ YAML-based configuration workflow
- ✅ Clean architecture (commands/services/utils split)
- ✅ Test coverage for critical behavior

## Installation

From monorepo root:

```bash
npm install
npm run build -- --filter=@bonapasogit-dev/partukkang
```

Run locally:

```bash
node packages/partukkang/dist/index.js --help
```

Run from monorepo root (without global install):

```bash
npm run build:partukkang
npm run partukkang -- --help
npm run partukkang -- configure init
```

## Command reference

### Install

```bash
partukkang install <type> <thing> [options]
```

`type`:

- `packages`
- `tools`
- `scripts`

Recommended flow:

```bash
partukkang list tools
partukkang list scripts
partukkang list packages
```

Then install using the exact returned path/name.

Examples:

```bash
partukkang install packages packages/jwt-manager
partukkang install packages @bonapasogit-dev/responder
partukkang install tools tools/script/scpconfig.sh --dest ./.local-tools
partukkang install scripts scpconfig.sh --dest ./.local-tools
partukkang install tools tools/script/clone.bat --dry-run
```

Supported options:

- `--org <org>` (default: `bonapasogit-dev`)
- `--repo <repo>` (default: `bonatools`)
- `--ref <ref>` (default: `main`)
- `--dest <path>` (default: current directory)
- `--token <token>` (optional GitHub token for private repositories)
- `--dry-run`

For private repositories, provide auth via one of:

- `--token <token>`
- `GITHUB_TOKEN` / `GH_TOKEN` environment variable
- `github.token` in `~/.partukkang/config.yaml`

### List

```bash
partukkang list <type> [options]
```

`type`:

- `tools`
- `scripts`
- `packages`

Examples:

```bash
partukkang list tools
partukkang list scripts
partukkang list packages --json
```

### Configure

Create YAML template:

```bash
partukkang configure init
```

Apply configuration:

```bash
partukkang configure apply --file partukkang.config.yaml
```

Dry run validation:

```bash
partukkang configure apply --file partukkang.config.yaml --dry-run
```

### Doctor

Run environment and config diagnostics:

```bash
partukkang doctor
```

Skip network checks:

```bash
partukkang doctor --skip-network
```

Machine-readable output:

```bash
partukkang doctor --json
```

Safe auto-remediation:

```bash
partukkang doctor --fix
```

`--fix` only applies conservative changes:

- ensures `~/.partukkang/config.yaml` exists with non-secret defaults
- ensures npm registry defaults are present in `~/.npmrc`
- never generates or injects GitHub tokens automatically

## YAML schema

```yaml
npm:
    user: your-name
    email: your.email@company.com
    scope: '@bonapasogit-dev'
    registry: 'https://registry.npmjs.org'
    authToken: 'ghp_xxx'

github:
    user: your-github-user
    token: 'ghp_xxx'
    org: bonapasogit-dev
    repo: bonatools
    ref: main
```

## What `configure apply` updates

- Saves merged config into `~/.partukkang/config.yaml`
- Updates `~/.npmrc` with merged keys:
    - `init-author-name`
    - `init-author-email`
    - `registry`
    - scoped registry (`@scope:registry=...`)
    - auth token line (`//host/:_authToken=...`) when provided

## Recommendations

- Prefer `partukkang configure init` + committed team template (without tokens)
- Keep secrets in local-only config files
- Use `--dry-run` before CI or onboarding scripts

## Development

```bash
npm run build -- --filter=@bonapasogit-dev/partukkang
npm run test -- --filter=@bonapasogit-dev/partukkang
```

## Windows compatibility notes

- Path handling uses Node `path` + `os.homedir()` APIs
- Command execution enables shell mode on Windows for consistent behavior
- File writes are UTF-8 and safe for standard Windows user profiles

## License

MIT
