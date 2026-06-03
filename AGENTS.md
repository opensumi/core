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

- TypeScript or shared API changes:

```bash
yarn tsc --build configs/ts/references/tsconfig.ai-native.json --pretty false
```

- Package-specific build when touching package build output or package-level contracts:

```bash
yarn workspace @opensumi/ide-ai-native build
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

## Current Focus Appendix

This appendix captures current high-activity areas. Treat it as helpful context, not as a permanent project-wide priority list.

### ACP, AI Native, and WebMCP

- Current high-activity areas include:
  - `packages/ai-native`
  - `packages/core-common/src/types/ai-native`
  - `packages/main-layout`
  - `packages/core-browser`
  - `test/bdd`
- For ACP/WebMCP work, treat `test/bdd/README.md` as the current runtime contract.
- Canonical WebMCP tool names are external capability identifiers. They should be registered once in the browser `WebMcpGroupRegistry` and match browser and MCP exposure.
- Do not reintroduce legacy `_opensumi/{group}/{action}` identifiers except in explicit negative tests.
- Current ACP Chat tool names include `acp_chat_getSessionState`, `acp_chat_getPermissionState`, `acp_chat_showChatView`, `acp_chat_listSessions`, `acp_chat_getAvailableCommands`, `acp_chat_prepareSessionDigest`, `acp_chat_postPreparedRelay`, `acp_chat_readSessionMessages`, and `acp_chat_setSessionMode`.
- Do not expose old direct ACP Chat tools such as `acp_sendMessage`, `acp_createSession`, `acp_switchSession`, `acp_clearSession`, `acp_cancelRequest`, or `acp_handlePermissionDialog`.
- Permission scenarios may observe pending permission state and DOM, but must not approve or reject permissions through an ACP tool.
- Session mode tests must verify that a mode switch is observable through session state; a successful setter response alone is not enough.
- Startup logs for the built-in `opensumi-ide` MCP server must not print the full bridge URL or token. Redact token paths as `/mcp/<redacted>`.

### Agentic and Classic Layout

- The normal web sample enables `AILayout`; `start:e2e` intentionally disables the AI/design layout.
- Do not use `start:e2e` to validate Agentic layout, Classic layout, or the AI layout selector.
- For Agentic/Classic layout changes, validate the live IDE through a real browser or CDP in addition to focused layout tests.
- The IDE is ready for browser checks when the document is complete, `#main` exists, loading indicators are gone, and the page text includes `EXPLORER`.
