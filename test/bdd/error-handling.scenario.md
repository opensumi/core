# Scenario: ACP Chat Capability Boundaries and Invalid Inputs

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts` or `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`

**Layer:** `mcp-contract` **Required profile:** `full` for complete invalid-input coverage. **Fixtures:** Fresh MCP session and ACP Chat smoke state from `acp-chat.scenario.md`. **Workspace mutation:** None. **Automation status:** Automated MCP contract spec; default-profile boundary checks are covered by `acp-chat.scenario.md`.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- Use a fresh MCP client session for this scenario so enabled capability groups do not leak in from another scenario.
- Default ACP Chat smoke in `acp-chat.scenario.md` passes.

## When

### Part A - Legacy Tool Boundary

1. `mcp`: `tools/list` -> record `TOOLS_DEFAULT`.
2. Assert `TOOLS_DEFAULT` does not include:
   - `acp_sendMessage`
   - `acp_createSession`
   - `acp_switchSession`
   - `acp_clearSession`
   - `acp_cancelRequest`
   - `acp_handlePermissionDialog`
3. `mcp`: call a legacy tool name such as `acp_sendMessage({ message: "hello" })`.

### Part B - Catalog Boundary

4. `mcp`: `opensumi_describe_capability_group({ group: "acp_chat", includeSchemas: true })`.
5. Before enabling `acp_chat`, call:
   ```js
   opensumi_invoke_capability_tool({
     tool: 'acp_chat_set_session_mode',
     arguments: { modeId: 'agent' },
   });
   ```
6. Before enabling `acp_chat`, call:
   ```js
   opensumi_invoke_capability_tool({
     tool: 'acp_chat_read_session_messages',
     arguments: { sessionId: 'acp:missing' },
   });
   ```
7. Enable `acp_chat`.
8. In a separate default/interactive boundary run, verify `acp_chat_set_session_mode`, `acp_chat_post_prepared_relay`, and `acp_chat_read_session_messages` are still not exposed or not callable.

### Part C - Invalid Inputs

9. In full profile after enabling `acp_chat`, call:
   ```js
   acp_chat_set_session_mode({ modeId: '' });
   ```
10. After enabling `acp_chat`, call:

```js
acp_chat_prepare_session_digest({ sourceSessionId: '' });
```

11. In full profile, call:

```js
acp_chat_post_prepared_relay({ digestId: '', targetSessionId: '' });
```

12. In full profile, call:

```js
acp_chat_read_session_messages({ sessionId: '' });
```

## Then

- Step 2 passes: legacy direct ACP tools are absent from the MCP tool surface.
- Step 3 fails with a standard tool-not-found style MCP error.
- Step 4 returns `success: true`, `group: "acp_chat"`, and current tool schemas.
- Steps 5 and 6 fail with `CAPABILITY_NOT_ENABLED` or an equivalent MCP error.
- Step 8 confirms non-full profiles do not expose write tools or the full-profile debug read tool. This boundary run is a prerequisite evidence item for the complete full-profile pass.
- Step 9 returns `success: false` with `error: "INVALID_INPUT"`.
- Step 10 returns `success: false` with `error: "INVALID_INPUT"`.
- Step 11 returns `success: false` with `error: "INVALID_INPUT"`.
- Step 12 returns `success: false` with `error: "INVALID_INPUT"`.
- Error responses must not include chat prompts, assistant responses, permission content, or relay digest body.

## Pass / Fail Judgment

- **PASS** - old direct tools are blocked and invalid inputs fail with structured, non-leaking errors.
- **BLOCKED** - the scenario is scheduled without the required full profile, so full-profile invalid-input tools cannot be exercised.
- **FAIL** - a legacy tool is exposed, a hidden capability is callable without required exposure, or invalid input succeeds.
