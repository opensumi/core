# Scenario: Session Mode - Full Profile Switch Return Contract

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts` or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `mcp-contract` **Required profile:** `full` **Fixtures:** Fresh MCP session in a full profile that exposes ACP Chat mode tools and a session whose modes include `agent` and `chat`. **Workspace mutation:** None. **Automation status:** Automated MCP contract spec for the current tool return contract; active-mode observability through `acp_chat_get_session_state` is not required until the state schema exposes `currentModeId`.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- The IDE is running with `ai.native.webmcp.profile = "full"`.
- `acp_chat_set_session_mode` and `acp_chat_get_session_state` are callable directly or through `opensumi_invoke_capability_tool`.

## When

1. `mcp`: `acp_chat_show_chat_view({})`.
2. `chrome-devtools-mcp-wait`: wait until the chat view is visible and an active session exists.
3. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_INITIAL`.
4. `mcp`: `acp_chat_set_session_mode({ modeId: "agent" })` -> record `SET_AGENT`.
5. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AGENT`.
6. `mcp`: `acp_chat_set_session_mode({ modeId: "chat" })` -> record `SET_CHAT`.
7. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_CHAT`.
8. Evaluate the safe session-state shape:
   ```js
   ({
     agentKeys: Object.keys(STATE_AGENT?.result?.session || {}),
     chatKeys: Object.keys(STATE_CHAT?.result?.session || {}),
     hasModeField:
       'currentModeId' in (STATE_AGENT?.result?.session || {}) ||
       'modeId' in (STATE_AGENT?.result?.session || {}) ||
       'sessionMode' in (STATE_AGENT?.result?.session || {}),
   });
   ```

## Then

- Step 3 returns `success: true` with `active: true`.
- Step 4 returns `success: true` and `result.modeId === "agent"`.
- Step 5 returns `success: true`.
- Step 6 returns `success: true` and `result.modeId === "chat"`.
- Step 7 returns `success: true`.
- Step 8 records the returned session summary keys for audit. With the current schema, `hasModeField` may be `false`; that is not a failure for this scenario.
- `acp_chat_get_session_state` remains metadata-only. Bounded session title metadata is allowed, but message bodies, assistant text, tool-call output, and config option secrets are not.

## Pass / Fail Judgment

- **PASS** - full-profile exposure is present, mode-switch calls return the requested `modeId`, and session-state reads remain active and metadata-only.
- **FAIL** - full-profile exposure is missing, `acp_chat_set_session_mode` fails its current return contract, or session state leaks message/config content.
