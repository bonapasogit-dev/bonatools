# Contributing Guide

Thanks for contributing to `bonatools`.

## 1) Prerequisites

- Node.js `>=18`
- npm (workspace-aware)
- Access to npm registry for `@bonapasogit-dev`

## 2) Setup

```bash
cd "$NODEPATH/partukkang/bonatools"
npm install
```

(Optional) Authenticate with npm registry:

```bash
npm login
```

## 3) Development Workflow

1. Create a branch from `main`.
2. Make focused changes in one package at a time.
3. Run filtered build/test for the target package.
4. Run root checks before opening PR.

### Useful Commands

```bash
npm run build
npm run test
npm run build:jwt
npm run test:jwt
npm run build:responder
npm run test:responder
npm run build:partukkang
npm run test:partukkang
```

## 4) Code Standards

- IMPORTANT: Make sure you guys have gone through [tech-labs](https://github.com/bonapasogit-dev//tech-labs) before creating super power bonatools here.
- Use TypeScript with strict typing.
- Keep public API clear and minimal.
- Preserve backward compatibility unless intentionally changing major behavior.
- Add tests for new behavior and bug fixes.
- Avoid unrelated refactors in feature/fix PRs.

## 5) Commit & PR Conventions

- Prefer conventional-style commits, e.g.:
    - `feat(responder): add forward response helper`
    - `fix(jwt-manager): handle expired token edge case`
    - `docs: update release commands`
- PR should include:
    - Summary of changes
    - Impacted package(s)
    - Test evidence (command + result)
    - Migration notes (if any)

## 6) Release Workflow (Root Only)

Use root scripts to keep release flow consistent.

### JWT Manager

```bash
npm run release:jwt:patch
npm run release:jwt:minor
npm run release:jwt:major
```

### Responder

```bash
npm run release:responder:patch
npm run release:responder:minor
npm run release:responder:major
```

### Partukkang

```bash
npm run release:partukkang:patch
npm run release:partukkang:minor
npm run release:partukkang:major
```

## 7) Notes for Maintainers

- Do not unpublish existing package versions.
- Ensure only one release pipeline publishes each package.
- Keep `turbo.json` inputs/outputs in sync with package structure.
