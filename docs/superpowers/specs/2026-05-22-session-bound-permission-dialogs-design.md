# Session-Bound Permission Dialogs — Design Spec

> **Date:** 2026-05-22 **Branch:** `feat/acp-v2` > **Problem:** Multiple ACP threads can run concurrently, each triggering permission requests. The current UI only shows `dialogs[0]`, so permission requests from non-active sessions sit hidden and may time out before the user ever sees them.

---

## Problem Statement

When Thread A and Thread B are running concurrently:

1. Thread A requests permission → dialog shown in UI
2. Thread B requests permission → dialog stored but **invisible** (UI only renders `dialogs[0]`)
3. User resolves Thread A's dialog → Thread B's dialog appears, but may have **already timed out** (60s default)

The root issue: permission dialogs are global, not bound to the session the user is currently viewing.

---

## Design Principles

1. **Session-scoped dialogs**: Only show permission dialogs for the session the user is currently viewing
2. **No auto-timeout**: Dialogs persist until explicitly resolved by the user
3. **Pending queue**: Requests from non-active sessions are queued and shown when the user switches to that session
4. **No layout changes**: The existing single-dialog UI is sufficient since only one session is visible at a time

---

## Architecture

### Current Flow (broken)

```
Node: AcpThread → PermissionRoutingService → AcpPermissionCallerService
  → RPC: $showPermissionDialog(params)
    → Browser: AcpPermissionRpcService → AcpPermissionBridgeService
      → fires onDidRequestPermission event
        → PermissionDialogManager.addDialog()
          → AcpPermissionDialogContainer renders dialogs[0] ❌
```

### New Flow

```
Node: AcpThread → PermissionRoutingService → AcpPermissionCallerService
  → RPC: $showPermissionDialog(params)
    → Browser: AcpPermissionRpcService → AcpPermissionBridgeService
      → extract sessionId from requestId (format: "sessionId:toolCallId")
      → if sessionId === activeSession → show dialog
      → else → queue as pending for that session
        → PermissionDialogManager.getDialogsForSession(activeSession)
          → AcpPermissionDialogContainer renders session-scoped dialogs ✓
```

---

## Changes by File

### 1. `AcpPermissionBridgeService` (permission-bridge.service.ts)

**Add active session tracking:**

```typescript
private activeSessionId: string | undefined;

/**
 * Set the currently active session.
 * Triggers auto-show of pending dialogs for the new session.
 */
setActiveSession(sessionId: string | undefined): void {
  this.activeSessionId = sessionId;
  // Re-evaluate pending decisions: show dialogs for new active session
  // Clear dialogs for previous session (they'll be shown when user switches back)
}

getActiveSession(): string | undefined {
  return this.activeSessionId;
}
```

**Modify `showPermissionDialog`:**

- Extract `sessionId` from `params.requestId` (format: `${sessionId}:${toolCallId}`)
- If `sessionId !== this.activeSessionId`, queue the request as pending and return a promise that resolves when the user eventually switches to that session
- Still fire the event so UI can re-render when session switches

**Remove timeout from `showPermissionDialog`:**

- Remove the `setTimeout` that auto-cancels pending decisions
- Dialogs persist until user resolves them or switches sessions

### 2. `PermissionDialogManager` (permission-dialog-container.tsx)

**Add session-scoped dialog retrieval:**

```typescript
getDialogsForSession(sessionId: string | undefined): DialogState[] {
  if (!sessionId) return [];
  return this.dialogs.filter(d => d.params.sessionId === sessionId);
}
```

**Modify `addDialog`:**

- Store dialogs with their sessionId (already available in `params.sessionId`)

### 3. `AcpPermissionDialogContainer` (permission-dialog-container.tsx)

**Subscribe to active session changes:**

```typescript
// In useEffect:
const unsubscribe = permissionBridgeService.onActiveSessionChange((sessionId) => {
  setCurrentSession(sessionId);
});
```

**Render only active session's dialogs:**

```typescript
// Replace: const dialogs = ... (all dialogs)
// With:
const sessionDialogs = dialogManager.getDialogsForSession(currentSession);

if (sessionDialogs.length === 0) return null;

const currentDialog = sessionDialogs[0]; // Still one at a time
```

### 4. `AcpChatInternalService` (chat.internal.service.acp.ts)

**Notify permission bridge on session switch:**

In `activateSession()` and `createSessionModel()`, after setting the new session model:

```typescript
// After this._sessionModel is set:
const acpSessionId = this._sessionModel.sessionId.replace('acp:', '');
this.permissionBridgeService?.setActiveSession(acpSessionId);
```

Need to inject `AcpPermissionBridgeService` into `AcpChatInternalService`.

### 5. `AcpPermissionRpcService` (acp-permission-rpc.service.ts)

**No changes needed.** The `sessionId` is already passed in `params.sessionId` from the node side.

---

## Key Behavioral Changes

| Behavior | Before | After |
| --- | --- | --- |
| Permission request from non-active session | Stored but invisible, times out after 60s | Queued, shown when user switches to that session |
| Dialog timeout | 60 seconds auto-cancel | No auto-timeout, persists until resolved |
| Session switch | No effect on dialogs | Shows pending dialogs for new session |
| Multiple sessions with pending dialogs | First one only visible | Only active session's dialogs visible |
| Dialog cleanup on timeout/cancel | `removeDialog()` called on timeout | `removeDialog()` only on user decision/close |

---

## Edge Cases

1. **No active session**: If `activeSessionId` is undefined, all permission requests are queued. Nothing shown.
2. **Session disposed while pending**: When a session is disposed/closed, clear all its pending dialogs and resolve them as `cancelled`.
3. **Same session, multiple pending dialogs**: Show one at a time (`dialogs[0]`), queue the rest. User resolves sequentially.
4. **rapid session switching**: Each switch clears the current view and shows pending dialogs for the new session. No dialogs are lost.

---

## Files to Modify

| File                                          | Change                                      |
| --------------------------------------------- | ------------------------------------------- |
| `browser/acp/permission-bridge.service.ts`    | Add active session tracking, remove timeout |
| `browser/acp/permission-dialog-container.tsx` | Session-scoped dialog rendering             |
| `browser/chat/chat.internal.service.acp.ts`   | Notify bridge on session switch             |
| `browser/acp/acp-permission-rpc.service.ts`   | No changes needed                           |

---

## Out of Scope

- Browser-side multi-dialog UI (stacked, merged, wizard) — deferred
- Permission rule persistence improvements — existing implementation is sufficient
- Node-side session active state tracking — handled entirely on browser side
