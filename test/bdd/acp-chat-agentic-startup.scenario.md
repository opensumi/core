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
2. Wait until the Common Preflight browser readiness predicate passes.
3. Before revealing an editor target, record layout label/preference state and bounding boxes for AI Chat, workbench, Explorer/view slot, and status bar.
4. `mcp`: `tools/list` -> record `TOOLS_DEFAULT`.
5. `mcp`: `acp_chat_show_chat_view({})`.
6. Wait until the Agentic AI Chat header/input is visible.
7. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_OPEN`.
8. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_AFTER_OPEN`.
9. Use the Agentic header restore action, or open a foreground editor target, then record the restored workbench and Explorer geometry.
10. Record fatal UI text, retry/timeout text, and uncaught stack text.

## Then

- The page remains on the original workspace URL and the visible layout state is Agentic.
- With fresh Agentic layout state, AI Chat is the only rendered main split child and fills the available main body; the editor/workbench and Explorer are initially hidden.
- The status bar remains visible while the workbench is hidden.
- The Agentic restore action or a successfully opened foreground editor target reveals the editor/workbench and Explorer without changing the workspace URL or active ACP session.
- After restoration, AI Chat is the leftmost major column within `640px <= AI Chat width <= 1440px`, and the workbench width is at least `480px`.
- `TOOLS_DEFAULT` exposes lower-snake canonical tool names only and includes only default ACP Chat tools.
- Legacy `_opensumi/...`, older camelCase ACP Chat names, and old direct ACP mutation tools are absent and fail with tool-not-found if called as explicit negative checks.
- `acp_chat_show_chat_view({})` returns `success: true` and `{ shown: true }`.
- Opening Agentic AI Chat may leave no active session, or may expose an empty metadata-only active session.
- Session and permission state responses expose metadata/counts only. Bounded session titles are allowed, but full prompt/message bodies, assistant text, file contents, relay digest bodies, permission prompt content, and tool-call result content are not.
- No step shows fatal UI text such as `SERVICE_UNAVAILABLE`, `EXECUTION_ERROR`, uncaught stack traces, or an initialization timeout that blocks the chat view.

## Pass / Fail Judgment

- **PASS** - Agentic AI Chat starts as the only main surface, the workbench remains explicitly restorable, default ACP Chat tools are safe and canonical, and state responses are metadata-only.
- **BLOCKED** - Common Preflight, the MCP bridge, or the Agentic layout launch profile is unavailable.
- **FAIL** - fresh Agentic layout incorrectly forces the workbench visible, the hidden workbench cannot be restored, Agentic layout is unusable, tool names drift, old mutation tools are exposed, or state responses leak content.
