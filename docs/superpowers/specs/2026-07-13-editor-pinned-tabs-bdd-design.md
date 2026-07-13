# Editor Pinned Tabs BDD Scenario Design

## Goal

Add one comprehensive runtime BDD scenario for the OpenSumi editor Pinned Tabs feature. The scenario documents the user-visible contract already covered by focused Jest and Playwright tests, without creating a duplicate E2E implementation.

## Scenario Placement

- Scenario: `test/bdd/editor-pinned-tabs.scenario.md`
- Index update: `test/bdd/README.md`
- Layer: `runtime-ui`
- Required profile: `default`
- Execution surface: Common Preflight followed by Chrome DevTools MCP against the real IDE runtime
- Hardened CI coverage: existing Pinned Tabs tests in `tools/playwright/src/tests/editor.test.ts`

The scenario belongs in the existing BDD suite because it verifies a stable editor UI contract in the real browser. It does not require ACP, WebMCP, or a live agent.

## Fixtures and Mutation

Use the disposable default E2E workspace containing `editor.js`, `editor2.js`, and `editor3.js`.

The scenario may:

- open and close those editors;
- temporarily edit a file to create a Dirty state;
- temporarily change `editor.wrapTab`;
- pin and unpin tabs;
- reload the IDE to verify persistence.

All file, preference, tab, and pin-state mutations must be restored or discarded before the scenario ends. An interrupted run must report the remaining mutation in its evidence instead of silently claiming cleanup.

## Coverage

### Part A: Core Pinned-Tab Behavior

Verify that an inactive editor can be pinned without becoming current. A pinned tab exposes `data-pinned='true'`, displays an Unpin control, does not display a Close control, and ignores middle-click close. A clean pinned tab hides the Dirty indicator; after editing, Dirty and Pin remain simultaneously visible.

Verify routine and explicit close semantics:

- Close All closes ordinary tabs but preserves pinned tabs.
- An explicit Close action closes a pinned tab.
- Reopening that resource from editor history creates an ordinary, unpinned tab.

### Part B: Sticky Layout, Wrap Mode, and Keyboard Access

Verify the non-wrap sticky region with multiple pinned tabs and a narrow viewport:

- an active ordinary tab remains visible beside the sticky pinned prefix;
- when the pinned prefix is wider than the viewport, it forms a usable nested horizontal viewport and the active last pinned tab remains reachable;
- after switching from wrap mode to non-wrap mode, later pin/current changes recompute the sticky cap and scrolling.

Verify keyboard access by focusing the native Unpin button and activating it with Enter and Space. The previously current ordinary tab must remain current.

In wrap mode, tabs remain one flat naturally wrapping sequence with the pinned tabs as a leading prefix. The scenario must not expect a separate pinned row or compact pinned titles.

### Part C: Persistence

Pin a tab, allow editor state persistence to settle, reload the IDE, and verify the tab restores with `data-pinned='true'`. Use `Cmd/Ctrl+K, Shift+Enter` to unpin it and confirm the ordinary Close control returns.

## Assertions and Evidence

Prefer user-facing text, roles, accessible labels, and stable `data-pinned`/`data-uri` attributes. CSS-module substring selectors are acceptable only for established tab-strip containers or controls that do not expose a stable semantic locator.

For a runtime BDD execution, evidence should record only the critical points needed for review:

- pinned and current state before and after Pin/Unpin;
- visible control and Dirty-state assertions;
- bounding boxes or bounded geometry for sticky reachability;
- wrap-mode tab sequence and pinned prefix state;
- state before reload and after restoration;
- cleanup result and relevant redacted console diagnostics.

Evidence belongs under `test/bdd/evidence/<date>/editor-pinned-tabs/` and must not be committed.

## Verdicts and Hardening

- PASS: all three parts meet the declared UI contract and cleanup completes.
- BLOCKED: the default workspace, browser surface, stable tab/menu selectors, or runtime profile is unavailable.
- FAIL: the prerequisites are present but any required pinned behavior, close protection, layout reachability, keyboard activation, or persistence assertion fails.

Hardening verdict: `CONVERT`, already satisfied by the existing five Pinned Tabs Playwright tests in `tools/playwright/src/tests/editor.test.ts`. The BDD addition must reference that coverage rather than generate a duplicate spec.

## Non-Goals

- Do not add another Playwright test file.
- Do not test the internal pinned-prefix algorithm directly; Jest owns model invariants.
- Do not require ACP, WebMCP, MCP transport, or a live LLM agent.
- Do not assert implementation-specific React state or service internals.
- Do not expand the feature with Pin All, Unpin All, compact tabs, or a separate pinned row.
