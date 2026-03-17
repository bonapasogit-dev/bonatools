# Internal Tools Monorepo

Welcome to: Internal Tools. not just about internal tools, i called it Super power internal tools. which has gone through a solid foundation, why is it solid? Because it comes from our [tech-labs](https://github.com/bonapasogit-dev//tech-labs).

Why [Monorepo](https://monorepo.tools/#why-a-monorepo) ? We have a mission to centralize code management, improve collaboration, and ensure consistency at massive scale. Single source of truth ? Let's goo!

Why [TypeScript](https://www.typescriptlang.org/docs/)? it introduces static typing, which acts as a safety net for massive, complex codebase.

Why [turbo](https://turborepo.dev/docs) ? We need to define and orchestrate our project's tasks, enabling significant speed improvements through intelligent caching and parallel execution

## Packages

| Package                             | Description                                                         | Status  |
| ----------------------------------- | ------------------------------------------------------------------- | ------- |
| `@bonapasogit-dev/jwt-manager`      | JWT lifecycle management with JTI validation and revocation support | Active  |
| `@bonapasogit-dev/responder`        | Standardized API response builder/handler utilities                 | Active  |
| `@bonapasogit-dev/http-client`      | Placeholder workspace                                               | Planned |
| `@bonapasogit-dev/partukkang`       | Internal CLI for tool/package management and installation           | Active  |

## Tech Stack

- Node.js `>=18`
- npm workspaces
- Turbo (`turbo.json`) for task orchestration + cache
- TypeScript
- Vitest

## Repository Structure

```text
packages/
  jwt-manager/
  responder/
  http-client/
tools/
  cli/
  script/
turbo.json
package.json
```

### Explanation

- Pacakage -> Containing internal package, it's use in many internal project inside partukkang
- tools -> All's about tool, either cli, script, .etc. you guys make sure to follow the security standard, never expose any sensitif data there.

## Quick Start

```bash
cd "<$WORKPATH>/partukkang/bonatools"
npm install
npm run build
npm run test
```

## Common Commands (Root)

```bash
npm run build
npm run test
npm run dev
npm run clean
```

### Filtered Package Commands

```bash
npm run build:jwt
npm run test:jwt
npm run build:responder
npm run test:responder
npm run build:partukkang
npm run test:partukkang
```

## Partukkang CLI (monorepo local)

`partukkang` is a workspace CLI binary, so it is not globally available by default.

Use it from root with npm scripts:

```bash
npm run build:partukkang
npm run partukkang -- --version
npm run partukkang -- configure init
npm run partukkang -- doctor --fix
```

Optional global setup helpers:

```bash
npm run partukkang:link
npm run partukkang:install:global
npm run partukkang:unlink
```

- `partukkang:link`: best for local CLI development (symlinked workspace)
- `partukkang:install:global`: installs built package globally as a fixed snapshot
- `partukkang:unlink`: removes the global linked/installed `partukkang` binary

## Release Commands (npm)

> Registry: `https://registry.npmjs.org`

### `@bonapasogit-dev/jwt-manager`

```bash
npm run release:jwt:patch
npm run release:jwt:minor
npm run release:jwt:major
```

### `@bonapasogit-dev/responder`

```bash
npm run release:responder:patch
npm run release:responder:minor
npm run release:responder:major
```

### `@bonapasogit-dev/partukkang`

```bash
npm run release:partukkang:patch
npm run release:partukkang:minor
npm run release:partukkang:major
```

## Turbo Notes

- `build` caches `dist/**`
- `test` depends on local + upstream build
- Remote cache is currently disabled

## Publishing Authentication

Authenticate with the public npm registry:

```bash
npm login
```

Then publish via root release scripts. All packages are published with `--access public`.

## Standards

- Keep package source in `src/`
- Output build artifacts to `dist/`
- Add or update tests in `tests/`
- Use strict TypeScript settings

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for branch, commit, test, and release workflow details.
