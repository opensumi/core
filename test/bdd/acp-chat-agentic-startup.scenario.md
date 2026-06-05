# Scenario: ACP Chat Agentic Startup - Default Layout and Safe Tool Surface

**Trigger:** `packages/ai-native/src/browser/layout/ai-layout.tsx`, `packages/ai-native/src/browser/layout/panel-layout.service.ts`, `packages/ai-native/src/browser/acp/components/AcpChatViewWrapper.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** Fresh browser profile or cleared Agentic layout storage, IDE dev server, Common Preflight, and fresh MCP session. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP plus the `opensumi-ide` MCP server.

## Given

- Common preflight in `test/bdd/README.md` passes through Chrome DevTools MCP.
- The IDE is opened with `ai.native.panelLayout = "agentic"` or no explicit layout preference.
- Layout storage keys `layout.ai.agentic` and `layout.state` are absent or cleared before the run.
- The MCP `opensumi-ide` server is connected with a fresh MCP session.

## When

1. `chrome-devtools-mcp`: Open `http://localhost:8080/?workspaceDir=<absolute workspace path>`.
2. Wait until `#main` is visible, `.loading_indicator` is detached, and the page text includes `EXPLORER`.
3. Record layout label/preference state and bounding boxes for AI Chat, workbench, Explorer/view slot, and status bar.
4. `mcp`: `tools/list` -> record `TOOLS_DEFAULT`.
5. `mcp`: `acp_chat_show_chat_view({})`.
6. Wait until the Agentic AI Chat header/input is visible.
7. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_OPEN`.
8. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_AFTER_OPEN`.
9. Record fatal UI text, retry/timeout text, and uncaught stack text.

## Then

- The page remains on the original workspace URL and the visible layout state is Agentic.
- AI Chat is the leftmost major column and stays within the Agentic default bounds: `640px <= AI Chat width <= 1440px`.
- Workbench width is at least `480px`, Explorer/view slot is visible or restorable, and the status bar remains visible.
- `TOOLS_DEFAULT` exposes lower-snake canonical tool names only and includes only default ACP Chat tools.
- Legacy `_opensumi/...`, older camelCase ACP Chat names, and old direct ACP mutation tools are absent and fail with tool-not-found if called as explicit negative checks.
- `acp_chat_show_chat_view({})` returns `success: true` and `{ shown: true }`.
- Opening Agentic AI Chat may leave no active session, or may expose an empty metadata-only active session.
- Session and permission state responses expose metadata/counts only and do not include prompt text, assistant text, file contents, relay digest bodies, permission prompt content, or tool-call result content.
- No step shows fatal UI text such as `SERVICE_UNAVAILABLE`, `EXECUTION_ERROR`, uncaught stack traces, or an initialization timeout that blocks the chat view.

## Pass / Fail Judgment

- **PASS** - Agentic AI Chat opens as the leftmost chat surface, default ACP Chat tools are safe and canonical, and state responses are metadata-only.
- **BLOCKED** - Common Preflight, the MCP bridge, or the Agentic layout launch profile is unavailable.
- **FAIL** - Agentic layout is not usable, tool names drift, old mutation tools are exposed, or state responses leak content.
