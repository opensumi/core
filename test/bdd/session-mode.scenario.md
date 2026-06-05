# Scenario: Session Mode - Full Profile Switch and Observable Mode

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts` or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `mcp-contract` **Required profile:** `full` **Fixtures:** Fresh MCP session with `acp_chat` enabled and a session whose modes include `agent` and `chat`. **Workspace mutation:** None. **Automation status:** Automated MCP contract spec with runtime observability through session state.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- The IDE is running with `ai.native.webmcp.profile = "full"`.
- `opensumi_enable_capability_group({ group: "acp_chat" })` has succeeded.
- `acp_chat_set_session_mode` and `acp_chat_get_session_state` are callable directly or through `opensumi_invoke_capability_tool`.

## When

1. `mcp`: `acp_chat_show_chat_view({})`.
2. `chrome-devtools-mcp-wait`: wait until the chat view is visible and an active session exists.
3. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_INITIAL`.
4. `mcp`: `acp_chat_set_session_mode({ modeId: "agent" })` -> record `SET_AGENT`.
5. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AGENT`.
6. `mcp`: `acp_chat_set_session_mode({ modeId: "chat" })` -> record `SET_CHAT`.
7. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_CHAT`.
8. Evaluate mode observability:
   ```js
   const readMode = (state) =>
     state?.result?.session?.modeId ?? state?.result?.session?.mode ?? state?.result?.session?.sessionMode ?? null;
   ({
     agentMode: readMode(STATE_AGENT),
     chatMode: readMode(STATE_CHAT),
     agentKeys: Object.keys(STATE_AGENT?.result?.session || {}),
     chatKeys: Object.keys(STATE_CHAT?.result?.session || {}),
   });
   ```

## Then

- Step 3 returns `success: true` with `active: true`.
- Step 4 returns `success: true` and `result.modeId === "agent"`.
- Step 5 returns `success: true`.
- Step 6 returns `success: true` and `result.modeId === "chat"`.
- Step 7 returns `success: true`.
- Step 8 returns `agentMode === "agent"` and `chatMode === "chat"`.
- If either observed mode is null, the failure output must include `agentKeys` and `chatKeys`.

## Pass / Fail Judgment

- **PASS** - mode switching succeeds and the active mode is observable through `acp_chat_get_session_state`.
- **FAIL** - full-profile exposure is missing, `acp_chat_set_session_mode` fails, or session state does not expose the active mode after a successful switch.
