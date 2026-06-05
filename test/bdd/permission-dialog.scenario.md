# Scenario: Permission Dialog Observability - Observe Without Deciding

**Trigger:** `packages/ai-native/src/browser/acp/permission-bridge.service.ts` or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

## Given

- Common preflight in `test/bdd/README.md` passes.
- The MCP `opensumi-ide` server is connected.
- `acp_chat_getPermissionState` is available in the default tool list.
- Permission tools are referenced only by canonical `tool.name` values.
- The test environment uses full WebMCP profile only if it executes the relay step.
- There are at least two ACP sessions if the relay step is used.

## When

### Part A - Baseline Permission State

1. `mcp`: `acp_chat_getPermissionState({})` -> record `PERMISSION_BASELINE`.
2. `chrome-devtools-mcp-evaluate`: record count of visible ACP permission dialog elements.

### Part B - Pending Permission Observability

3. If full-profile relay tools are available, prepare a digest:
   ```js
   acp_chat_prepareSessionDigest({ sourceSessionId });
   ```
4. Start, but do not await to completion:
   ```js
   acp_chat_postPreparedRelay({ digestId, targetSessionId });
   ```
5. While the relay call is pending, poll `acp_chat_getPermissionState({})` -> record `PERMISSION_PENDING`.
6. `chrome-devtools-mcp-evaluate`: record whether the permission dialog is visible and whether it shows user-facing permission text.
7. Manually dismiss the dialog through the UI with Reject or close. Do not use an ACP tool to decide.
8. `mcp`: `acp_chat_getPermissionState({})` -> record `PERMISSION_AFTER_DISMISS`.

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

## Pass / Fail Judgment

- **PASS** - permission state is observable as counts/session id only, and pending dialogs are visible through both MCP state and Chrome DevTools MCP DOM.
- **PARTIAL** - baseline observability passes, but no full-profile relay setup exists to create a pending permission during this run.
- **FAIL** - permission state is unavailable, leaks permission content, or exposes an automated approve/reject ACP tool.
