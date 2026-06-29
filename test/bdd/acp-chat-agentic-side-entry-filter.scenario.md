# Scenario: ACP Chat Agentic Side Entry Filter - Explorer And Git Only

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

- Agentic layout shows only the `explorer` and `scm` side entries from the standard IDE container set.
- Agentic layout does not show `search`, `debug`, or `extension` side entries.
- Explorer and Git/SCM entries remain clickable in Agentic layout.
- Classic layout still shows the standard left Activity Bar entries, including Search, Debug, and Extension Marketplace when those containers are registered.
- Debug and Extension Marketplace services are not disabled by this scenario; only the Agentic side entry UI is filtered.

## Pass / Fail Judgment

- **PASS** - Agentic side entries are limited to Explorer and Git/SCM, both remaining interactive, while Classic still exposes the broader standard Activity Bar set.
- **FAIL** - Agentic shows Search, Debug, Extension Marketplace, or hides Explorer/Git; Explorer/Git cannot be activated; or Classic loses the standard side entries.
- **BLOCKED** - Common Preflight fails, Agentic layout cannot be selected, or the standard left tabbar selectors are unavailable.
