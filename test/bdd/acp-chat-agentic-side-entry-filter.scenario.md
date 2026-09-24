# Scenario: ACP Chat Agentic Side Entries Remain Available

**Trigger:** `packages/ai-native/src/browser/layout/tabbar.view.tsx`, `packages/main-layout/src/browser/tabbar/bar.view.tsx`, or `packages/ai-native/src/browser/layout/panel-layout.service.ts`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** IDE dev server opened on the default Playwright workspace with Common Preflight. **Workspace mutation:** None; this scenario is read-only. **Automation status:** Automated through Playwright and Chrome DevTools MCP-compatible DOM checks; no ACP agent fixture is required.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The IDE is opened with a workspace that contains `editor.js` and `test/test.js`.
- Agent layout is available from the user-facing `View -> Panel Layout -> Agent` menu or layout selector.
- Classic layout is available for a control check.

## When

1. Open the default workspace.
2. Show ACP Chat with `acp_chat_show_chat_view({})` when `navigator.modelContext` exposes it.
3. Switch to Agentic layout.
4. Inspect visible Activity Bar / side entry IDs in the Agentic left tabbar.
5. Click the Explorer entry and assert the Explorer panel can open.
6. Click the Git/SCM entry and assert the SCM panel can open.
7. Switch back to Classic layout and inspect the visible left Activity Bar entries again.

## Then

- Agentic layout shows the registered standard IDE side entries, including `explorer`, `search`, `scm`, `debug`, and `extension`.
- Explorer and Git/SCM entries remain clickable in Agentic layout.
- Classic layout still shows the standard left Activity Bar entries, including Search, Debug, and Extension Marketplace when those containers are registered.
- Agentic and Classic layouts share the registered standard side-entry availability while retaining their own layout presentation.

## Pass / Fail Judgment

- **PASS** - Agentic and Classic expose the registered standard Activity Bar entries, with Explorer and Git/SCM remaining interactive.
- **FAIL** - Agentic or Classic loses a registered standard side entry, or Explorer/Git cannot be activated.
- **BLOCKED** - Common Preflight fails, Agentic layout cannot be selected, or the standard left tabbar selectors are unavailable.
