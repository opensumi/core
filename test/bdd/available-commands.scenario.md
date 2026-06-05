# Scenario: Available Commands - Enabled ACP Chat Group Exposes Command Metadata

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- Default ACP Chat smoke in `acp-chat.scenario.md` passes.

## When

1. `mcp`: `opensumi_enableCapabilityGroup({ group: "acp_chat" })`.
2. Refresh `tools/list`.
3. If `tools/list` contains `acp_chat_getAvailableCommands`, call it directly.
4. If the client cannot refresh tools, call:
   ```js
   opensumi_invokeCapabilityTool({
     tool: 'acp_chat_getAvailableCommands',
     arguments: {},
   });
   ```
5. Record the result as `COMMANDS_RESULT`.

## Then

- Step 1 returns `success: true`, `enabled: true`, and `group: "acp_chat"`.
- Step 2 or Step 4 makes `acp_chat_getAvailableCommands` callable in this MCP session.
- Step 5 returns `success: true`.
- `COMMANDS_RESULT.result.commands` is an array.
- Every command item has a non-empty string `name`.
- Every command item has a string `description`; empty descriptions are allowed.
- Command names are not required to start with `/`.
- The response must not include chat message content, prompts, assistant responses, or tool-call results.

## Pass / Fail Judgment

- **PASS** - command metadata is callable and structurally valid after enabling `acp_chat`.
- **FAIL** - enabling the group fails, the tool cannot be invoked through direct or fallback path, or command items are malformed.
