# OpenSumi Agent Design Guidelines

This document gives Codex and other coding agents durable design rules for maintaining OpenSumi. It describes patterns already present in the codebase and should not be treated as a future architecture wish list.

Root `AGENTS.md` stays short and points here. `CONTEXT.md` files define product language only. ADRs record hard-to-reverse architectural decisions only.

## How To Use This Document

Before making a small local fix, read the nearby implementation and tests, then follow the rules below. Before making a high-risk change, perform an explicit impact check with CodeGraph or focused code reading.

High-risk changes include public package APIs, exported types, commands, settings, contribution contracts, persisted state, layout/workbench behavior, protocol surfaces, ACP/MCP/WebMCP behavior, extension-facing behavior, and shared services used across packages.

Agents do not need to write a design note before coding unless the user asks for one. The required step is impact checking, not documentation ceremony.

## Rules

### Respect Runtime And Package Boundaries

- Keep `browser`, `node`, and `common` runtime code separated. Browser code must not import node-only runtime modules, node code must not import browser-only runtime modules, and common code must stay runtime-neutral.
- Preserve package boundaries under `packages/*`. Prefer public exports and established package APIs over deep imports unless the surrounding code already uses that pattern.
- Put shared contracts in the appropriate common package or common folder. Do not duplicate protocol or service types in a feature package to avoid dependency work.
- When crossing browser/node boundaries, use existing RPC, service, contribution, or protocol patterns instead of direct runtime coupling.

### Use Existing DI, Contribution, And Registry Patterns

- Prefer OpenSumi dependency injection with tokens, `@Injectable`, `@Autowired`, and provider registration over ad hoc singletons or module-level mutable state.
- Add extensible behavior through existing contribution domains, registries, and lifecycle hooks such as `ClientAppContribution`, `CommandContribution`, `MenuContribution`, `ComponentContribution`, `SlotRendererContribution`, or package-specific registries.
- Register contributions with `@Domain(...)` and consume them through `ContributionProvider` when the feature is additive across modules.
- Avoid wiring feature-specific behavior directly into bootstrap or startup code unless the task is changing core infrastructure itself.
- Keep service responsibilities clear: services own state and orchestration, contributions attach behavior to OpenSumi lifecycle points, and React components render state and forward user intent.

### Preserve Public Contracts And State Ownership

- Treat exported package APIs, commands, settings, extension-facing DTOs, protocol names, and contribution interfaces as compatibility boundaries.
- When changing a public contract, check downstream references across the monorepo and update the narrowest contract-level tests.
- Preserve backwards compatibility for persisted state. New fields should be optional or migrated deliberately, and restoration should tolerate missing, malformed, or stale data.
- Keep authority with the owning layer. For protocol-backed features, render server or protocol state rather than inventing frontend status from message text or timing.
- Keep metadata separate from authoritative state. UI markers such as unread, archived, selected, or filtered should not masquerade as protocol state.

### Compose With The Existing Workbench

- Extend the existing OpenSumi workbench, layout services, slots, views, tab bars, and editor services instead of recreating workbench structure inside a feature.
- Layout changes must preserve IDE layout lifecycle, workspace behavior, file tree behavior, editor state, and existing commands unless the task explicitly changes those contracts.
- Keep feature-specific layout changes local to the owning package when possible. Shared layout packages should change only for shared behavior.
- Model UI state with explicit invariants. For ordered collections, persisted lists, tab state, or task selection, centralize mutations and clamp or validate after every collection change.
- For layout and real DOM behavior, validate the runtime profile that actually enables the feature.

### Follow OpenSumi UI And Theme Conventions

- Reuse existing OpenSumi components, menus, modals, context keys, toolbars, slots, and interaction patterns before introducing new UI primitives.
- Use theme color tokens, CSS variables, and existing Less module conventions. Avoid hard-coded theme colors in feature UI.
- Keep visual changes local and predictable. Do not restyle unrelated workbench regions to support a narrow feature.
- Maintain accessible names, tooltips, focus behavior, keyboard behavior, and context-menu target semantics for controls.
- Preserve design-package overrides and rendering hooks when changing editor tabs, title areas, menu bars, or other customizable surfaces.

### Verify At The Right Boundary

- Start with nearby focused tests for the behavior being changed.
- Add or update tests at the contract boundary when changing exported APIs, persisted state, commands, settings, extension DTOs, or protocol behavior.
- Use the narrowest relevant typecheck or package build for TypeScript or cross-package contract changes.
- Use Playwright, BDD, or a running IDE profile for layout, startup, browser integration, and real DOM behavior.
- Run `git diff --check` before finishing when practical.

## Heuristics

- Keep edits narrowly scoped to the requested behavior and the owning package.
- Prefer a small local helper over a new abstraction until duplication or complexity proves the abstraction is useful.
- Before adding new state, identify the owner, lifecycle, persistence format, reset behavior, and source of truth.
- Prefer adding to an existing registry or contribution point over creating a parallel registry.
- Match test breadth to risk: narrow behavior gets focused tests; shared contracts and layout changes need broader verification.
- If a full verification path is too expensive or blocked, report what ran and what risk remains.

## Anti-Patterns

- Do not cross `browser`, `node`, and `common` runtime boundaries with direct imports.
- Do not bypass DI, contributions, registries, or lifecycle hooks with hard-coded startup wiring for ordinary features.
- Do not change shared layout lifecycle for a feature-local UI need.
- Do not infer ACP, MCP, WebMCP, or extension-facing state that belongs to the protocol or host.
- Do not hard-code theme colors or copy a workbench layout inside a feature component.
- Do not make broad snapshot, mock, or public contract changes just to make a focused test pass.
- Do not overwrite or revert local user changes unless the user explicitly asks.

## Stable Code Anchors

Use these files as orientation points, not as code to copy blindly:

- `packages/core-browser/src/bootstrap/inner-providers.ts` shows core contribution providers and built-in browser services.
- `packages/core-common/src/contribution-provider.ts` defines the `ContributionProvider` pattern.
- `packages/core-browser/src/common/common.define.ts` defines `ClientAppContribution` lifecycle hooks.
- `packages/main-layout/src/common/main-layout.definition.ts` defines main layout contracts.
- `packages/theme/src/common/utils.ts` and `packages/theme/src/common/color-registry.ts` show color token registration and resolution.
- `CONTEXT-MAP.md` points to product-language contexts.
- `docs/adr/` records architectural decisions that should not be rediscovered from code alone.
