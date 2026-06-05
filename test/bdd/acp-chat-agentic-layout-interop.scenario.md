# Scenario: ACP Chat Agentic Layout Interop - Explorer, Resize, Reload, Switch

**Trigger:** `packages/ai-native/src/browser/layout/ai-layout.tsx`, `packages/ai-native/src/browser/layout/panel-layout.service.ts`, `packages/ai-native/src/browser/layout/tabbar.view.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatViewWrapper.tsx`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, workspace contains `editor.js` and `test/test.js`, and read-only workspace/editor tools are exposed. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP; read-only MCP checks run through `opensumi-ide`.

## Given

- Agentic AI Chat is visible as the leftmost major column.
- The Explorer activity item can reveal the file tree.
- Read-only workspace/editor/file tools are available through the active profile.

## When

1. Open Explorer in Agentic layout.
2. Expand `test`, open `test/test.js`, then open `editor.js`.
3. `mcp`: call read-only tools exposed by the active profile, including `workspace_get_info({})`, `editor_get_active({})`, and `workspace_list_open_files({})`.
4. If file tools are exposed, call only read-only file tools such as `file_exists({ path: "editor.js" })` and bounded `file_read({ path: "package.json", maxBytes: 4096 })`.
5. Drag the Agentic AI Chat/workbench splitter smaller and larger, then record AI Chat and workbench geometry after each drag.
6. Drag the Agentic Explorer/workbench splitter smaller and larger, then record Explorer and workbench geometry after each drag.
7. Reload the page without changing the workspace URL and repeat startup visibility, state, input, history, and read-only MCP checks.
8. Switch `Agentic -> Classic -> Agentic` through the user-facing layout selector and repeat visibility, geometry, Explorer/editor, input, history, and read-only MCP checks.

## Then

- Explorer remains interactive while AI Chat is leftmost.
- Opening files updates `editor_get_active` and `workspace_list_open_files`.
- Read-only workspace/editor/file WebMCP calls continue to work before resize, after resize, after reload, and after layout switching.
- Agentic AI Chat/workbench resizing respects `640px <= AI Chat width <= 1440px` and `workbench.width >= 480px`.
- Agentic Explorer/workbench resizing keeps Explorer recoverable and does not collapse the file tree to a permanent `0px` width.
- Reload preserves Agentic mode and restores a usable AI Chat plus workbench layout.
- Switching Agentic to Classic and back restores Agentic leftmost chat layout without losing Explorer/editor interop.

## Pass / Fail Judgment

- **PASS** - Explorer/editor interop, bounded read-only MCP calls, resize, reload, and layout switching remain stable in Agentic layout.
- **BLOCKED** - the run lacks interactive profile, the required workspace files, or read-only workspace/editor tool exposure.
- **FAIL** - Explorer/editor interaction breaks, resize bounds fail, reload loses Agentic layout, or layout switching leaves AI Chat/Explorer unusable.
