# Scenario: Available Commands - Profile-Granted ACP Chat Exposes Command Metadata

**Trigger:** `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `mcp-contract` **Required profile:** `interactive` or `full` **Fixtures:** Fresh MCP session in a profile that exposes `acp_chat_get_available_commands` and command metadata from the mock ACP agent configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich`; the active real ACP agent may supply live evidence only when its command catalog is stable for the run. **Workspace mutation:** None. **Automation status:** Automated MCP contract spec; default-profile runs should skip this scenario instead of marking it partial. Playwright conversion requires the stable mock command catalog or an equivalent deterministic provider.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- The IDE is running with `ai.native.webmcp.profile = "interactive"` or `"full"`.
- Default ACP Chat smoke in `acp-chat.scenario.md` passes.

## When

1. `mcp`: `tools/list` -> record `TOOLS_PROFILE`.
2. If `tools/list` contains `acp_chat_get_available_commands`, call it directly.
3. If the client cannot call the tool directly, call:
   ```js
   opensumi_invoke_capability_tool({
     tool: 'acp_chat_get_available_commands',
     arguments: {},
   });
   ```
4. Optionally call `opensumi_enable_capability_group({ group: "acp_chat" })` as a catalog helper and verify it is not required for the command metadata call.
5. Record the command metadata result as `COMMANDS_RESULT`.

## Then

- Step 1 includes `acp_chat_get_available_commands` in interactive/full profiles.
- Step 2 or Step 3 makes `acp_chat_get_available_commands` callable in this MCP session.
- Step 4, when run, returns `success: true`, `enabled: true`, and `group: "acp_chat"`, but does not change the profile boundary.
- Step 5 returns `success: true`.
- `COMMANDS_RESULT.result.commands` is an array.
- Every command item has a non-empty string `name`.
- Every command item has a string `description`; empty descriptions are allowed.
- Command names are not required to start with `/`.
- The response must not include chat message content, prompts, assistant responses, or tool-call results.

## Live Agent Execution

- A real LLM-backed ACP agent may provide command metadata for live MCP contract evidence when the interactive/full profile exposes `acp_chat_get_available_commands`.
- Live-agent mode must not assert exact command counts, ordering, generated command effects, or assistant content unless the command catalog is stable for the configured provider. CI hardening requires deterministic command metadata.

## Pass / Fail Judgment

- **PASS** - command metadata is callable and structurally valid in interactive/full profiles without requiring a catalog helper call.
- **BLOCKED** - the scenario is scheduled against default profile instead of interactive/full profile.
- **FAIL** - the tool cannot be invoked through direct or fallback path in an interactive/full profile, the catalog helper is incorrectly required, or command items are malformed.
