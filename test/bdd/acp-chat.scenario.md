# Scenario: ACP Chat Default Surface - Open View and Observe Safe State

**Trigger:** `packages/ai-native/src/browser/acp/**` or `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`

## Given

- Common preflight in `test/bdd/README.md` passes through Chrome DevTools MCP.
- The MCP `opensumi-ide` server is connected.
- `tools/list` includes:
  - `opensumi_discoverCapabilities`
  - `opensumi_enableCapabilityGroup`
  - `opensumi_invokeCapabilityTool`
  - `acp_chat_getSessionState`
  - `acp_chat_getPermissionState`
  - `acp_chat_showChatView`
- `tools/list` does not include legacy ACP direct tools:
  - `acp_sendMessage`
  - `acp_createSession`
  - `acp_switchSession`
  - `acp_clearSession`
  - `acp_cancelRequest`
  - `acp_handlePermissionDialog`

## When

1. `mcp`: `opensumi_discoverCapabilities({ task: "observe acp chat session state", includeDisabled: true })`
2. `mcp`: `acp_chat_showChatView({})`
3. `chrome-devtools-mcp-wait`: wait until the ACP chat view is visible.
4. `mcp`: `acp_chat_getSessionState({})` -> record `SESSION_STATE`.
5. `mcp`: `acp_chat_getPermissionState({})` -> record `PERMISSION_STATE`.
6. `chrome-devtools-mcp-evaluate`: record visible ACP chat text and fatal error text.

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
- Step 4 response must not contain prompt text, assistant response text, or tool-call result content.
- Step 5 returns only permission counts and active session id:
  - `activeDialogCount`
  - `activeSessionId`
  - `pendingCountExcludingActive`
- Step 5 must not expose permission prompt content, affected file content, or any approval/rejection action.
- Step 6 does not show fatal UI text such as `SERVICE_UNAVAILABLE`, `EXECUTION_ERROR`, or uncaught stack traces.

## Pass / Fail Judgment

- **PASS** - default tools are available, legacy tools are absent, the chat view opens, and state responses are metadata-only.
- **FAIL** - any legacy direct ACP tool is exposed, the chat view cannot open, or state responses leak prompt/response/tool result content.
