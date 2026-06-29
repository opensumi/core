# Scenario: ACP Permission Routing - Registered Sessions and Dialog Lifecycle

**Trigger:** `packages/ai-native/src/node/acp/permission-routing.service.ts`, `packages/ai-native/src/node/acp/acp-thread.ts`, or `packages/ai-native/src/browser/acp/permission-bridge.service.ts`

**Layer:** `node-contract` **Required profile:** `full` when validating visible permission dialogs. **Fixtures:** Registered ACP sessions from the mock ACP agent `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=permission`, permission bridge, and stable permission dialog selectors. **Workspace mutation:** None. **Automation status:** Automated contract spec for routing/service behavior; permission-visible full-profile portions are converted in `tools/playwright/src/tests/permission-dialog.test.ts` using the deterministic `permission` fixture and browser UI dismissal.

## Given

- A raw ACP session id exists from the mock `permission` fixture or an equivalent registered ACP session fixture.
- The session is registered through `PermissionRoutingService.registerSession`.
- The browser `AcpPermissionBridgeService` is available.
- The ACP chat view has an active session id.

## When

### Part A - Registered Session Route

1. Agent calls ACP client `requestPermission` for the registered session.
2. Node routes the request through `PermissionRoutingService.routePermissionRequest`.
3. Browser calls `AcpPermissionBridgeService.showPermissionDialog`.
4. Chrome DevTools MCP observes the visible permission dialog.
5. MCP calls `acp_chat_get_permission_state`.
6. User selects an allow option.
7. Repeat with permission options in an unsorted order.

### Part B - Reject And Close

8. Trigger another permission request for the same active session.
9. User selects a reject option.
10. Trigger another permission request and close the dialog.
11. Trigger a duplicate `requestId` while the first request is still pending.

### Part C - Unregistered Session

12. Unregister the raw session id.
13. Route a new permission request for that session id.

### Part D - Session Cleanup

14. Trigger permissions for two different sessions.
15. Make one session active.
16. Call `clearSessionDialogs` for the active session.
17. Call `cancelRequest(requestId)` for a pending request in another session.

### Part E - Skip Permission Mode

18. Set `SKIP_PERMISSION_CHECK=true`.
19. Route a permission request with `allow_once`, `allow_always`, `reject_once`, and `reject_always` options.

## Then

- Part A returns an ACP allow outcome to the agent only after the user decision.
- Permission options render in the stable order `allow_always`, `allow_once`, `reject_always`, `reject_once` regardless of input order.
- `activeDialogCount` increases while the dialog is visible.
- `activeSessionId` reports the raw active ACP session id.
- `pendingCountExcludingActive` excludes the active session and counts other sessions only.
- `hasPendingForSession` accepts both `acp:<id>` and raw `<id>`.
- Reject returns a reject outcome and removes the dialog from pending indexes.
- Close returns `timeout` or cancelled-equivalent outcome and removes pending indexes.
- A duplicate pending `requestId` returns cancelled and does not replace the existing dialog resolver.
- Unregistered sessions return cancelled without showing a browser dialog.
- `clearSessionDialogs(sessionId)` resolves matching pending decisions as cancelled and leaves other sessions' dialogs untouched.
- `cancelRequest(requestId)` closes only the matching request and leaves other pending requests untouched.
- With `SKIP_PERMISSION_CHECK=true`, no browser dialog is shown and the first allow option is selected deterministically.
- Permission observability never exposes full permission content, file contents, or an automated approve/reject MCP tool.

## Pass / Fail Judgment

- **PASS** - permission requests are routed only for registered sessions, browser dialogs are observable, and all decisions clean up per-session pending indexes.
- **FAIL** - unregistered sessions show dialogs, counts become stale, decisions cross sessions, or MCP exposes permission content/decision tools.
