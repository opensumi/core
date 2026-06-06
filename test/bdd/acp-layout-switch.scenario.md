# Scenario: ACP Layout Switch - Agentic And Classic IDE Interop

**Trigger:** `packages/ai-native/src/browser/layout/panel-layout.service.ts`, `packages/ai-native/src/browser/layout/ai-layout.tsx`, `packages/ai-native/src/browser/layout/tabbar.view.tsx`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** IDE dev server opened on the default Playwright workspace with Common Preflight. **Workspace mutation:** None; this scenario is read-only. **Automation status:** Automated through Chrome DevTools MCP; WebMCP reads run only when exposed by the active profile.

## Given

- Common preflight in `test/bdd/README.md` passes through Chrome DevTools MCP.
- Browser `navigator.modelContext` is available, or the MCP `opensumi-ide` server is connected.
- The IDE is opened with a workspace that contains `editor.js` and `test/test.js`.
- The test is read-only. It must not create, modify, move, or delete files.

## When

1. `chrome-devtools-mcp`: Open `http://localhost:8080/?workspaceDir=<absolute workspace path>`.
2. `chrome-devtools-mcp-wait`: Wait until the Common Preflight browser readiness predicate passes.
3. `webmcp`: Show the ACP chat view with `acp_chat_show_chat_view({})` when that tool is exposed.
4. `chrome-devtools-mcp`: Switch to `classic` with the user-facing menu path `View -> Panel Layout -> Classic`.
5. `chrome-devtools-mcp`: Assert the Explorer/workbench area is positioned before the AI chat slot, and the AI chat slot is visible.
6. `chrome-devtools-mcp`: Drag the Classic AI chat/workbench horizontal splitter in both directions and assert the AI chat width stays within its Classic resize bounds: minimum `280px`, maximum `1080px`.
7. `chrome-devtools-mcp`: Open Explorer, expand `test`, open `test/test.js`, and assert an editor tab is active.
8. `webmcp`: Read current IDE state through read-only tools:
   - `workspace_get_info({})`
   - `editor_get_active({})`
   - `file_exists({ path: "editor.js" })` when exposed by the active profile
   - `file_read({ path: "editor.js" })` when exposed by the active profile
9. `chrome-devtools-mcp`: Switch to `agentic` with the user-facing menu path `View -> Panel Layout -> Agentic`.
10. `chrome-devtools-mcp`: Assert the AI chat slot is positioned before the Explorer/workbench area, and the Explorer remains visible.
11. `chrome-devtools-mcp`: Drag the Agentic AI chat/workbench horizontal splitter in both directions and assert the AI chat width stays within its Agentic resize bounds: minimum `640px`, maximum `1440px`.
12. Repeat steps 7 and 8 after the `agentic` switch.

## Then

- Both layout switches complete without reloading or navigating away from the workspace URL.
- The AI chat slot remains visible after both switches.
- The AI chat splitter enforces the layout-specific resize range:
  - Classic: `280px <= AI Chat <= 1080px`.
  - Agentic: `640px <= AI Chat <= 1440px`.
- Explorer remains visible and can expand folders and open files after both switches.
- WebMCP read-only calls return successful, workspace-scoped responses after both switches.
- Browser and MCP tool catalogs expose canonical underscore tool names only; legacy `_opensumi/...` names are absent.
- If `navigator.modelContext` and the MCP bridge are both unavailable, the failure output includes `navigator.modelContext missing` or `opensumi-ide MCP tools/list unavailable`.

## Pass / Fail Judgment

- **PASS** - layout switching works in both directions, file-tree interaction remains healthy, layout-specific AI chat resize bounds hold, and read-only WebMCP state checks succeed.
- **FAIL** - the layout order is wrong, the AI chat view disappears, Explorer cannot interact with the file tree after switching, a splitter lets AI chat escape its layout-specific resize bounds, WebMCP read-only tools fail when exposed, or legacy `_opensumi/...` tool names appear.
