# Scenario: ACP Permission Routing - Registered Sessions and Dialog Lifecycle

**Trigger:** `packages/ai-native/src/node/acp/permission-routing.service.ts`, `packages/ai-native/src/node/acp/acp-thread.ts`, or `packages/ai-native/src/browser/acp/permission-bridge.service.ts`

## Given

- A raw ACP session id exists.
- The session is registered through `PermissionRoutingService.registerSession`.
- The browser `AcpPermissionBridgeService` is available.
- The ACP chat view has an active session id.

## When

### Part A - Registered Session Route

1. Agent calls ACP client `requestPermission` for the registered session.
2. Node routes the request through `PermissionRoutingService.routePermissionRequest`.
3. Browser calls `AcpPermissionBridgeService.showPermissionDialog`.
4. Chrome DevTools MCP observes the visible permission dialog.
5. MCP calls `acp_chat_getPermissionState`.
6. User selects an allow option.

### Part B - Reject And Close

7. Trigger another permission request for the same active session.
8. User selects a reject option.
9. Trigger another permission request and close the dialog.

### Part C - Unregistered Session

10. Unregister the raw session id.
11. Route a new permission request for that session id.

### Part D - Session Cleanup

12. Trigger permissions for two different sessions.
13. Make one session active.
14. Call `clearSessionDialogs` for the active session.

## Then

- Part A returns an ACP allow outcome to the agent only after the user decision.
- `activeDialogCount` increases while the dialog is visible.
- `activeSessionId` reports the raw active ACP session id.
- `pendingCountExcludingActive` excludes the active session and counts other sessions only.
- `hasPendingForSession` accepts both `acp:<id>` and raw `<id>`.
- Reject returns a reject outcome and removes the dialog from pending indexes.
- Close returns `timeout` or cancelled-equivalent outcome and removes pending indexes.
- Unregistered sessions return cancelled without showing a browser dialog.
- `clearSessionDialogs(sessionId)` resolves matching pending decisions as cancelled and leaves other sessions' dialogs untouched.
- Permission observability never exposes full permission content, file contents, or an automated approve/reject MCP tool.

## Pass / Fail Judgment

- **PASS** - permission requests are routed only for registered sessions, browser dialogs are observable, and all decisions clean up per-session pending indexes.
- **FAIL** - unregistered sessions show dialogs, counts become stale, decisions cross sessions, or MCP exposes permission content/decision tools.
