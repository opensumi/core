# Scenario: Available Commands - Enabled ACP Chat Group Exposes Command Metadata

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `mcp-contract` **Required profile:** `interactive` or `full` **Fixtures:** Fresh MCP session with `acp_chat` enabled and command metadata available. **Workspace mutation:** None. **Automation status:** Automated MCP contract spec; default-profile runs should skip this scenario instead of marking it partial.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- The IDE is running with `ai.native.webmcp.profile = "interactive"` or `"full"`.
- Default ACP Chat smoke in `acp-chat.scenario.md` passes.

## When

1. `mcp`: `opensumi_enable_capability_group({ group: "acp_chat" })`.
2. Refresh `tools/list`.
3. If `tools/list` contains `acp_chat_get_available_commands`, call it directly.
4. If the client cannot refresh tools, call:
   ```js
   opensumi_invoke_capability_tool({
     tool: 'acp_chat_get_available_commands',
     arguments: {},
   });
   ```
5. Record the result as `COMMANDS_RESULT`.

## Then

- Step 1 returns `success: true`, `enabled: true`, and `group: "acp_chat"`.
- Step 2 or Step 4 makes `acp_chat_get_available_commands` callable in this MCP session.
- Step 5 returns `success: true`.
- `COMMANDS_RESULT.result.commands` is an array.
- Every command item has a non-empty string `name`.
- Every command item has a string `description`; empty descriptions are allowed.
- Command names are not required to start with `/`.
- The response must not include chat message content, prompts, assistant responses, or tool-call results.

## Pass / Fail Judgment

- **PASS** - command metadata is callable and structurally valid after enabling `acp_chat`.
- **BLOCKED** - the scenario is scheduled against default profile instead of interactive/full profile.
- **FAIL** - enabling the group fails in an interactive/full profile, the tool cannot be invoked through direct or fallback path, or command items are malformed.
