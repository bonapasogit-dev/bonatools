# Contributing Guide

Thanks for contributing to bonatools.

## 1) Prerequisites

- Node.js >= 18
- npm (workspace-aware)
- Access to npm registry for @bonapasogit-dev

## 2) Setup

Run from repository root:

```bash
cd "$NODEPATH/partukkang/bonatools"
npm install
```

Optional (only needed for maintainers who publish):

```bash
npm login
```

## 3) Day-to-Day Development Workflow

### Step 1: Sync and branch

```bash
git checkout main
git pull origin main
git checkout -b feat/<scope>-<short-description>
```

Examples:

- feat/responder-add-async-handler
- fix/jwt-manager-refresh-race
- docs/contributing-release-policy

### Step 2: Change only what is needed

- Keep each PR focused on one package or one concern.
- Avoid unrelated refactors.
- If you change a public API, document impact in PR description.

### Step 3: Test locally with package filter first

Use package-level commands while iterating:

```bash
npm run build:jwt
npm run test:jwt

npm run build:responder
npm run test:responder

npm run build:partukkang
npm run test:partukkang
```

Before opening PR, run root checks:

```bash
npm run build
npm run test
```

### Step 4: Commit with clear scope

Prefer conventional-style commits:

- feat(responder): add forward response helper
- fix(jwt-manager): handle expired token edge case
- docs: update release workflow

### Step 5: Push and open PR

```bash
git push -u origin <your-branch>
```

PR checklist:

- Summary of change
- Impacted package(s)
- Test evidence (commands + result)
- Breaking change or migration notes (if any)

### Step 6: Review, address feedback, merge

- Re-run relevant tests after each review change.
- Keep branch updated with main if needed.
- Squash or merge according to repository policy.

## 4) Release Model for This Monorepo

This repository is a package monorepo, not a single deployable app.

- Packages should be released independently.
- Root monorepo package should not be published (root is private).
- Do not release all packages together unless there is a deliberate coordinated release.

### What this means in practice

- If only responder changes, release only @bonapasogit-dev/responder.
- If only jwt-manager changes, release only @bonapasogit-dev/jwt-manager.
- If only partukkang changes, release only @bonapasogit-dev/partukkang.

## 5) SemVer Guidance

- patch: bug fixes, internal improvements, no public API break
- minor: backward-compatible new features
- major: breaking API or behavior changes

## 6) Release Steps (Maintainer)

Always release from latest main.

### Who is allowed to release

- Default rule: contributors open PRs; maintainers publish releases.
- A non-maintainer may release only if explicitly authorized and has npm publish access for the package scope.
- If you are unsure about permission, stop at PR and request maintainer release.
- To avoid accidental duplicate publishes, prefer one release owner per package/release window.

### A) Prepare

```bash
git checkout main
git pull origin main
npm install
npm run build
npm run test
```

### B) Release the changed package only

JWT Manager:

```bash
npm run release:jwt:patch
npm run release:jwt:minor
npm run release:jwt:major
```

Responder:

```bash
npm run release:responder:patch
npm run release:responder:minor
npm run release:responder:major
```

Partukkang:

```bash
npm run release:partukkang:patch
npm run release:partukkang:minor
npm run release:partukkang:major
```

### C) Commit version file changes

Release scripts bump package versions with --no-git-tag-version, so you must commit version changes manually:

```bash
git add .
git commit -m "chore(release): publish <package>@<version>"
git push origin main
```

### D) Optional tagging recommendation

Consider adding package-scoped tags for traceability:

- responder-v1.2.3
- jwt-manager-v2.0.0
- partukkang-v0.5.1

## 7) Root Monorepo Release Policy

- No root package release is required when a workspace package is released.
- Root changes (tooling/docs/turbo/eslint) can be merged without npm publish.
- If desired, maintainers may add git tags or GitHub releases for repository-level milestones, but this is optional and separate from npm publishing.

## 8) Notes for Maintainers

- Do not unpublish existing package versions.
- Ensure only one release pipeline publishes each package.
- Keep turbo.json inputs/outputs in sync with package structure.
