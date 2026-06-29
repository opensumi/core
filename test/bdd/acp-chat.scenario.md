# Scenario: ACP Chat Default Surface - Open View and Observe Safe State

**Trigger:** `packages/ai-native/src/browser/acp/**` or `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** IDE dev server, fresh MCP session, and Common Preflight. **Workspace mutation:** None. **Automation status:** Automated smoke scenario through Chrome DevTools MCP plus the `opensumi-ide` MCP server.

## Given

- Common preflight in `test/bdd/README.md` passes through Chrome DevTools MCP.
- The MCP `opensumi-ide` server is connected.
- `tools/list` includes:
  - `opensumi_discover_capabilities`
  - `opensumi_enable_capability_group`
  - `opensumi_invoke_capability_tool`
  - `acp_chat_get_session_state`
  - `acp_chat_get_permission_state`
  - `acp_chat_show_chat_view`
- `tools/list` does not include legacy ACP direct tools:
  - `acp_sendMessage`
  - `acp_createSession`
  - `acp_switchSession`
  - `acp_clearSession`
  - `acp_cancelRequest`
  - `acp_handlePermissionDialog`
- `tools/list` does not include older camelCase ACP Chat names:
  - `acp_chat_getSessionState`
  - `acp_chat_getPermissionState`
  - `acp_chat_showChatView`

## When

1. `mcp`: `opensumi_discover_capabilities({ task: "observe acp chat session state", includeDisabled: true })`
2. `mcp`: `acp_chat_show_chat_view({})`
3. `chrome-devtools-mcp-wait`: wait until the ACP chat view is visible.
4. `mcp`: `acp_chat_get_session_state({})` -> record `SESSION_STATE`.
5. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_STATE`.
6. `mcp`: call `acp_chat_getSessionState({})` as a negative compatibility check.
7. `chrome-devtools-mcp-evaluate`: record visible ACP chat text and fatal error text.

## Then

- Step 1 returns a group named `acp_chat` with default exposed tools.
- Step 2 returns `success: true` and `{ shown: true }`.
- Step 3 sees the chat view, for example a visible `AI Assistant` heading or ACP chat input area.
- Step 4 returns `success: true`.
- If `SESSION_STATE.result.active === true`, `SESSION_STATE.result.session` contains metadata only:
  - `sessionId`
  - `rawSessionId`
  - `title`
  - `modelId`
  - `threadStatus`
  - `requestCount`
  - `historyMessageCount`
  - `slicedMessageCount`
  - `hasPendingPermission`
- If no active session exists, Step 4 returns `{ active: false, session: null }`.
- Step 4 may contain bounded session title metadata, but must not contain full prompt/message bodies, assistant response text, or tool-call result content.
- Step 5 returns only permission counts and active session id:
  - `activeDialogCount`
  - `activeSessionId`
  - `pendingCountExcludingActive`
- Step 5 must not expose permission prompt content, affected file content, or any approval/rejection action.
- Step 6 fails with a standard tool-not-found style MCP error.
- Step 7 does not show fatal UI text such as `SERVICE_UNAVAILABLE`, `EXECUTION_ERROR`, or uncaught stack traces.

## Pass / Fail Judgment

- **PASS** - default tools are available, legacy tools are absent, the chat view opens, and state responses are metadata-only.
- **FAIL** - any legacy direct ACP tool is exposed, the chat view cannot open, or state responses leak message/response/tool result content outside allowed title metadata.
