# OpenSumi Core Agent Guide

This file is the root-level guide for agents working in the OpenSumi core repository. Keep it stable, project-wide, and useful for long-term maintenance. Short-term feature context belongs in the appendix or in task-specific notes.

## Project Overview

- This repository is the `@opensumi/core` TypeScript monorepo for OpenSumi.
- Package management uses Yarn 4.4.1 with `nodeLinker: node-modules`; the required Node version is `>=18.12.0`.
- Workspaces are `packages/*`, `tools/dev-tool`, `tools/playwright`, and `tools/cli-engine`.
- Common entrypoints:
  - `yarn install` installs dependencies.
  - `yarn run init` performs the full clean/build initialization.
  - `yarn start` starts the normal web IDE.
  - `yarn start:e2e` starts the e2e profile.
  - `yarn start:electron` starts the Electron profile.
  - `yarn test` runs Jest with the repository defaults.
  - `yarn test:ui` runs Playwright UI tests.
- Before starting local services, check common ports when relevant:

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN || true
lsof -nP -iTCP:8000 -sTCP:LISTEN || true
```

## Code Navigation

- Use CodeGraph for structural questions: symbol definitions, signatures, callers, callees, dependency impact, and unfamiliar module surveys.
- Use `rg` for literal text: log messages, comments, string constants, file names, and exact code fragments.
- Do not grep first when looking for a symbol by name if CodeGraph is available.
- When changing shared behavior, inspect both implementation and nearby tests before editing.
- For broad areas, prefer `codegraph_context` or `codegraph_explore` over a chain of narrow searches.

## Architecture Boundaries

- Follow the durable agent-facing design rules in `docs/agent-design-guidelines.md` before making high-risk changes to public APIs, runtime boundaries, layout/workbench behavior, persisted state, protocol surfaces, extension-facing behavior, or shared services.
- Respect the `browser`, `node`, and `common` split:
  - `browser` code must not import `node` runtime modules.
  - `node` code must not import `browser` runtime modules.
  - `common` code must not depend on browser-only or node-only runtime modules.
- Preserve package boundaries under `packages/*`. Prefer public package exports and existing local APIs over deep imports unless the surrounding code already does so.
- Follow OpenSumi's contribution and dependency-injection patterns. Prefer existing contribution registries, services, symbols, and lifecycle hooks over ad hoc wiring.
- When changing public types, settings, commands, contribution contracts, or exported package APIs, check downstream references across the monorepo and update tests at the contract boundary.
- Keep UI changes consistent with existing OpenSumi components, layout services, tabbar behavior, and style conventions.

## Development Workflow

- Start with `git status --short`. This repository often has active local changes.
- Never revert or overwrite user changes unless explicitly requested.
- Keep edits narrowly scoped to the requested behavior. Avoid unrelated refactors, formatting churn, and metadata changes.
- Use `apply_patch` for manual tracked-file edits.
- Prefer repository scripts and local helper APIs over introducing new tooling.
- For structured data, use structured parsers or existing helpers instead of ad hoc string manipulation.
- Before finishing code changes, run `git diff --check` when practical.

## Build and Test Matrix

- TypeScript or shared API changes: choose the narrowest affected TypeScript reference or package-level typecheck that covers the files you touched. For cross-package contracts, use the relevant reference under `configs/ts/references/`.

```bash
yarn tsc --build <affected-ts-reference> --pretty false
```

- Package-specific build when touching package build output or package-level contracts: run the build for the workspace package you changed.

```bash
yarn workspace <affected-workspace> build
```

- Focused Jest tests are usually preferred over full-suite runs during iteration:

```bash
yarn test <path-to-test> --runInBand
yarn jest <path-to-test> --runInBand
```

- Use `--selectProjects jsdom` or `--runTestsByPath` for browser/jsdom tests when the Jest project selection matters.
- For layout, startup, browser integration, or real DOM behavior, validate with the running IDE or Playwright/CDP in addition to unit tests.
- For UI test coverage, use:

```bash
yarn test:ui
yarn test:ui-headful
yarn test:ui-report
```

- For BDD scenarios, read `test/bdd/README.md` first and run only the relevant scenario set unless the user asks for the full suite.
- If a full verification is too expensive or blocked, report the focused checks that ran and the remaining risk.

## Review Expectations

- For code reviews, lead with correctness issues, behavioral regressions, contract risks, and missing tests.
- Prefer concrete file/line references and describe the user-visible or integration impact.
- For cross-package changes, check API compatibility, import boundaries, and whether dependent packages need updated tests.
- For UI/layout reviews, check real runtime behavior, not just component snapshots.
- For protocol, MCP, WebMCP, or extension-facing changes, check naming stability, capability gating, backwards compatibility, and log/token safety.

## Agent skills

### Issue tracker

Issues and PRDs are local Markdown files under `.scratch/`; never publish issue content to a remote tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

Local issue status uses the canonical triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a multi-context repository. See `docs/agents/domain.md` and `CONTEXT-MAP.md`.

## Current Focus Appendix

This appendix is for stable guidance that is still too area-specific for the main sections. Do not store short-term feature notes, temporary tool names, sprint priorities, or one-off validation shortcuts in the root `AGENTS.md`. Put those details in a nearby package-level `AGENTS.md`, `test/bdd/README.md`, protocol documentation, or task-specific notes instead.

### Protocol, MCP, and Extension-Facing Work

- Treat protocol types, contribution registries, BDD scenarios, and nearby package documentation as the source of truth for current capability names and behavior.
- Keep externally visible names stable unless the task explicitly changes the public contract. When changing them, update browser exposure, MCP exposure, tests, and documentation together.
- For security-sensitive integration points, verify capability gating, backwards compatibility, and log/token redaction.

### Layout and Runtime Validation

- For layout, startup, browser integration, or real DOM behavior, validate the relevant runtime profile rather than relying only on component snapshots.
- Choose the launch profile that actually enables the feature under test. If profiles differ, document which profile you used and what risk remains.
- For browser checks, wait until the IDE is fully loaded before judging layout or behavior.
