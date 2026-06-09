# Scenario: Permission Dialog Observability - Observe Without Deciding

**Trigger:** `packages/ai-native/src/browser/acp/permission-bridge.service.ts` or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `full` **Fixtures:** Two ACP sessions from `--fixture=history` when relay setup needs seeded sessions, a prepared relay permission request or the mock ACP agent configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=permission` for a visible permission request, and stable permission dialog selectors. A real LLM-backed ACP agent/prompt combination may be used only when it reliably triggers a visible permission request. **Workspace mutation:** None. **Automation status:** Automated through MCP plus Chrome DevTools MCP; live-agent runs may cover dialog observability only when the prompt/agent reliably triggers permission. Stable Reject/close selectors remain required.

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- `acp_chat_get_permission_state` is available in the default tool list.
- Permission tools are referenced only by canonical `tool.name` values.
- The test environment uses full WebMCP profile for this scenario.
- There are at least two ACP sessions when the relay path is used; direct mock-agent permission observability may run with one active session.

## When

### Part A - Baseline Permission State

1. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_BASELINE`.
2. `chrome-devtools-mcp-evaluate`: record count of visible ACP permission dialog elements.

### Part B - Pending Permission Observability

3. If full-profile relay tools are available, prepare a digest:
   ```js
   acp_chat_prepare_session_digest({ sourceSessionId });
   ```
4. Start, but do not await to completion:
   ```js
   acp_chat_post_prepared_relay({ digestId, targetSessionId });
   ```
5. While the relay call is pending, poll `acp_chat_get_permission_state({})` -> record `PERMISSION_PENDING`.
6. `chrome-devtools-mcp-evaluate`: record whether the permission dialog is visible and whether it shows user-facing permission text.
7. `chrome-devtools-mcp`: click the visible Reject or close control in the permission dialog. Do not use an ACP tool to decide.
8. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_AFTER_DISMISS`.

If relay setup is unavailable but the mock `permission` fixture is configured, trigger the permission request by sending a deterministic prompt through the Agentic input, then execute Steps 5-8 against the visible dialog and permission state.

## Then

- Step 1 returns `success: true`.
- `PERMISSION_BASELINE.result.activeDialogCount` is a number.
- `PERMISSION_BASELINE.result.activeSessionId` is either a string or null/undefined.
- `PERMISSION_BASELINE.result.pendingCountExcludingActive` is a number.
- Step 1 response does not include request content, file contents, or permission options.
- If Part B runs, Step 5 observes `activeDialogCount >= 1` while the dialog is visible.
- If Part B runs, Step 6 confirms the dialog is visible in the browser.
- If Part B runs, Step 8 eventually returns to the baseline active dialog count.
- No step uses or expects `acp_handlePermissionDialog`.
- No operational step invokes a legacy `_opensumi/acp_chat/*` identifier, and the runtime must not accept one as an alias.

## Live Agent Execution

- A real LLM-backed ACP agent may be used to observe a live permission dialog, permission counts/session id, and browser-only dismissal.
- Live-agent mode must not assert permission body text, hidden decision options, model tool arguments/results, or generated assistant content. If a live prompt does not produce a dialog, the pending-permission portion is blocked and should not be marked passed.

## Pass / Fail Judgment

- **PASS** - permission state is observable as counts/session id only, and pending dialogs are visible through both MCP state and Chrome DevTools MCP DOM.
- **BLOCKED** - the run lacks full profile, both relay setup and the mock ACP agent `permission` fallback, or a stable permission dialog selector for the Reject/close control.
- **FAIL** - permission state is unavailable, leaks permission content, or exposes an automated approve/reject ACP tool.
