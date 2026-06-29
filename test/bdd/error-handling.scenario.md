# Scenario: ACP Chat Capability Boundaries and Invalid Inputs

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts` or `packages/ai-native/src/node/acp/opensumi-mcp-http-server.ts`

**Layer:** `mcp-contract` **Required profile:** `full` for complete invalid-input coverage. **Fixtures:** Fresh MCP session and ACP Chat smoke state from `acp-chat.scenario.md`. **Workspace mutation:** None. **Automation status:** Automated MCP contract spec; default-profile boundary checks are covered by `acp-chat.scenario.md`.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- Use a fresh MCP client session for this scenario so transport-local catalog helper state does not leak in from another scenario.
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
5. In full profile, before any optional catalog helper call, verify `acp_chat_set_session_mode`, `acp_chat_post_prepared_relay`, and `acp_chat_read_session_messages` are exposed or callable through `opensumi_invoke_capability_tool`.
6. In a separate default/interactive boundary run, verify `acp_chat_set_session_mode`, `acp_chat_post_prepared_relay`, and `acp_chat_read_session_messages` are still not exposed or not callable.
7. If `opensumi_enable_capability_group({ group: "acp_chat" })` is called, treat it as a catalog/discovery helper and verify it does not change profile-forbidden exposure.

### Part C - Invalid Inputs

8. In full profile, call:
   ```js
   acp_chat_set_session_mode({ modeId: '' });
   ```
9. In full profile, call:

```js
acp_chat_prepare_session_digest({ sourceSessionId: '' });
```

10. In full profile, call:

```js
acp_chat_post_prepared_relay({ digestId: '', targetSessionId: '' });
```

11. In full profile, call:

```js
acp_chat_read_session_messages({ sessionId: '' });
```

## Then

- Step 2 passes: legacy direct ACP tools are absent from the MCP tool surface.
- Step 3 fails with a standard tool-not-found style MCP error.
- Step 4 returns `success: true`, `group: "acp_chat"`, and current tool schemas.
- Step 5 confirms full-profile tools are available without requiring `opensumi_enable_capability_group`.
- Step 6 confirms non-full profiles do not expose write tools or the full-profile debug read tool. This boundary run is a prerequisite evidence item for the complete full-profile pass.
- Step 7 confirms the catalog helper does not override profile gating.
- Step 8 returns `success: false` with `error: "INVALID_INPUT"`.
- Step 9 returns `success: false` with `error: "INVALID_INPUT"`.
- Step 10 returns `success: false` with `error: "INVALID_INPUT"`.
- Step 11 returns `success: false` with `error: "INVALID_INPUT"`.
- Error responses must not include chat prompts, assistant responses, permission content, or relay digest body.

## Pass / Fail Judgment

- **PASS** - old direct tools are blocked and invalid inputs fail with structured, non-leaking errors.
- **BLOCKED** - the scenario is scheduled without the required full profile, so full-profile invalid-input tools cannot be exercised.
- **FAIL** - a legacy tool is exposed, a profile-forbidden capability is callable, a profile-granted tool incorrectly requires the catalog helper, or invalid input succeeds.
