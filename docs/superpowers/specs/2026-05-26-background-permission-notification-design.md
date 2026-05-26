# Design: Background Session Permission Notification

> **Date:** 2026-05-26 **Branch:** `feat/acp-v2` > **Problem:** When an ACP agent in a background session (not the currently visible session) requests permission, the dialog is queued silently and the user has no visual signal that another session is waiting. Users may miss permission requests entirely until they happen to switch sessions.

---

## Problem

ACP supports multiple concurrent threads. Permission dialogs are already session-scoped: only the active session's dialog is rendered, and dialogs from other sessions sit in a queue (`PermissionDialogManager.getDialogsForSession(activeSession)`).

The gap: when a background session triggers a permission request, **the user has no awareness it happened**. The dialog is correctly queued, but:

- The history popover is closed by default, so the existing thread-status icons inside it are invisible.
- No badge, count, or any other surface tells the user "another session needs you."
- `auth_required` thread status is defined in the type union but never set in code today — and even if it were, it would conflict with the agent still being `working`.

The result: permission requests in background sessions can sit unnoticed indefinitely.

---

## Goals

1. Users can tell, **without opening the history popover**, that at least one other session has a pending permission request, and how many.
2. After opening the history popover, users can immediately see **which sessions** have pending permission requests.
3. The current session's workflow is **not interrupted** — no toast, no system notification, no auto-switch.

## Non-Goals

- Toast, system notifications, status-bar indicators.
- Repurposing `ThreadStatus` to encode permission-pending state. Thread status describes the agent's processing lifecycle; permission-pending is an orthogonal dimension.
- Reordering history items based on pending state.
- Auto-switching to a session that has a pending request.

---

## Design Principles

1. **Orthogonal dimensions.** Thread status (`working`, `awaiting_prompt`, …) describes the agent's lifecycle. Pending-permission is a separate boolean per session. The two icons coexist in the history list.
2. **Single source of truth.** `AcpPermissionBridgeService` already holds permission state. Augment it with a session-scoped index instead of introducing a new service.
3. **Badge only counts "other" sessions.** The active session's pending requests are already visible inline in the chat area; repeating them on the badge adds noise.
4. **Event-driven, pull-based reads.** Bridge fires a single `onPendingCountChange` event; subscribers re-read counts themselves. Keeps the event payload trivial and avoids stale snapshots.

---

## Architecture

### Data Flow

```
Node layer (unchanged):
  AcpThread.handlePermissionRequest()
    └─ AcpPermissionCallerService.requestPermission()
       └─ RPC: $showPermissionDialog(params)

Browser layer (this change):
  AcpPermissionBridgeService
    ├─ State (new):
    │   pendingBySessionId: Map<sessionId, Set<requestId>>
    ├─ Event (new):
    │   onPendingCountChange: Event<void>
    │
    ├─ showPermissionDialog():       add requestId to pendingBySessionId[sessionId], fire event
    ├─ handleUserDecision():         remove requestId from pendingBySessionId[sessionId], fire event
    ├─ handleDialogClose():          remove requestId from pendingBySessionId[sessionId], fire event
    ├─ clearSessionDialogs():        drop entry for sessionId, fire event
    │
    ├─ getPendingCountExcludingActive(): number
    └─ hasPendingForSession(sessionId): boolean

UI subscribers:
  DefaultChatViewHeaderACP
    ├─ subscribe onPendingCountChange + onActiveSessionChange
    ├─ re-read getPendingCountExcludingActive() → pendingPermissionBadge state
    └─ on getHistoryList() rebuild, fill item.hasPendingPermission via bridge.hasPendingForSession()

  ChatHistoryACP (and AcpChatHistory.tsx duplicate)
    ├─ History button: render badge from props.pendingPermissionBadge (0 hides it)
    └─ History list item: render permission icon next to status icon
                          when item.hasPendingPermission && item.id !== activeId

  AcpPermissionDialogContainer (unchanged): still renders only active session's dialogs
```

---

## Changes by File

### 1. `AcpPermissionBridgeService` (`browser/acp/permission-bridge.service.ts`)

**New state:**

```typescript
private pendingBySessionId = new Map<string, Set<string>>();

private readonly onPendingCountChangeEmitter = new Emitter<void>();
readonly onPendingCountChange: Event<void> = this.onPendingCountChangeEmitter.event;
```

**Modify `showPermissionDialog()`** — after `this.activeDialogs.set(requestId, dialogProps)`:

```typescript
let set = this.pendingBySessionId.get(params.sessionId);
if (!set) {
  set = new Set();
  this.pendingBySessionId.set(params.sessionId, set);
}
set.add(requestId);
this.onPendingCountChangeEmitter.fire();
```

**Modify `handleUserDecision()` and `handleDialogClose()`** — both already call `this.activeDialogs.delete(requestId)`. Before deleting, read `dialogProps.sessionId` (need to add `sessionId` to `PermissionDialogProps`, or read it from `pendingDecisions`; the bridge already has the original `params` in `activeDialogs` via `dialogProps` — extend that type minimally). After deletion:

```typescript
const sessionSet = this.pendingBySessionId.get(sessionId);
if (sessionSet) {
  sessionSet.delete(requestId);
  if (sessionSet.size === 0) {
    this.pendingBySessionId.delete(sessionId);
  }
  this.onPendingCountChangeEmitter.fire();
}
```

**Modify `clearSessionDialogs(sessionId)`** — at the end:

```typescript
if (this.pendingBySessionId.delete(sessionId)) {
  this.onPendingCountChangeEmitter.fire();
}
```

**New public methods:**

```typescript
getPendingCountExcludingActive(): number {
  let count = 0;
  for (const [sid, set] of this.pendingBySessionId) {
    if (sid !== this.activeSessionId) {
      count += set.size;
    }
  }
  return count;
}

hasPendingForSession(sessionId: string): boolean {
  return (this.pendingBySessionId.get(sessionId)?.size ?? 0) > 0;
}
```

**Implementation note:** `PermissionDialogProps` doesn't currently carry `sessionId`. Either extend it with `sessionId: string`, or keep a parallel `requestIdToSessionId` Map updated by `showPermissionDialog`. The Map is less intrusive — recommend that path.

### 2. `IChatHistoryItem` and `IChatHistoryProps`

**File:** `browser/components/ChatHistory.acp.tsx` **File:** `browser/acp/components/AcpChatHistory.tsx` (duplicate that must be kept in sync)

```typescript
export interface IChatHistoryItem {
  id: string;
  title: string;
  updatedAt: number;
  loading: boolean;
  threadStatus?: ThreadStatus;
  hasPendingPermission?: boolean; // new
}

export interface IChatHistoryProps {
  // ... existing fields
  pendingPermissionBadge?: number; // new — 0 / undefined → hidden
}
```

**Render permission icon in `renderHistoryItem()`** — right after `renderThreadStatusIcon(...)`:

```tsx
{
  item.hasPendingPermission && item.id !== currentId && (
    <Icon
      data-testid={`acp-permission-pending-${item.id}`}
      iconClass={getIcon('key')}
      style={{ fontSize: 14, marginRight: 4, flexShrink: 0, color: 'var(--notification-foreground)' }}
      title={localize('aiNative.acp.permissionPending')}
    />
  );
}
```

The `item.id !== currentId` guard hides the icon on the active session — its dialog is already visible inline.

**Render badge on the history popover trigger button:**

Wrap the existing history icon in a relative container, and conditionally render a badge:

```tsx
<div className={styles.chat_history_button_wrapper}>
  <EnhanceIcon className={cls(styles.chat_history_header_actions_history, 'codicon codicon-history')} />
  {pendingPermissionBadge && pendingPermissionBadge > 0 ? (
    <span data-testid='acp-pending-permission-badge' className={styles.pending_permission_badge}>
      {pendingPermissionBadge > 99 ? '99+' : pendingPermissionBadge}
    </span>
  ) : null}
</div>
```

### 3. `chat-history.module.less`

**File:** `browser/acp/components/chat-history.module.less`

Add styles:

```less
.chat_history_button_wrapper {
  position: relative;
  display: inline-flex;
}

.pending_permission_badge {
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background-color: var(--notificationsErrorIcon-foreground, #e74c3c);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  font-weight: 600;
  pointer-events: none;
}
```

### 4. `DefaultChatViewHeaderACP` (`browser/chat/chat.view.acp.tsx`)

**Inject bridge service:**

```typescript
const permissionBridgeService = useInjectable<AcpPermissionBridgeService>(AcpPermissionBridgeService);
```

**New state:**

```typescript
const [pendingPermissionBadge, setPendingPermissionBadge] = React.useState(0);
```

**Subscribe to bridge events** — add to the existing `useEffect([aiChatService])`:

```typescript
const refreshBadge = () => {
  setPendingPermissionBadge(permissionBridgeService.getPendingCountExcludingActive());
};
toDispose.push(
  permissionBridgeService.onPendingCountChange(() => {
    refreshBadge();
    getHistoryList(); // re-pull hasPendingPermission for every item
  }),
);
toDispose.push(
  permissionBridgeService.onActiveSessionChange(() => {
    refreshBadge();
  }),
);
refreshBadge();
```

**Populate `hasPendingPermission` in `getHistoryList()`** — when building each list item:

```typescript
{
  id: session.sessionId,
  title,
  updatedAt,
  loading: false,
  threadStatus: session.threadStatus,
  hasPendingPermission: permissionBridgeService.hasPendingForSession(session.sessionId),
}
```

**Pass badge into history component:**

```tsx
<ChatHistoryComponent
  // ... existing props
  pendingPermissionBadge={pendingPermissionBadge}
/>
```

### 5. Localization

Add key:

```json
"aiNative.acp.permissionPending": "Permission pending"
```

(and matching zh-CN: `"权限请求等待中"`)

---

## Behavior Matrix

| Scenario | Badge count | Active-session list item | Other-session list item |
| --- | --- | --- | --- |
| Permission requested in active session | unchanged | no key icon (dialog already visible) | unchanged |
| Permission requested in background session | +1 | unchanged | key icon shown |
| User resolves permission in active session | unchanged | — | unchanged |
| User switches to a background session that had pending | −N (those become "active") | dialog auto-pops; no key icon | unchanged |
| User resolves permission in background session via switching | eventually 0 for that session | — | key icon disappears |
| Multiple concurrent permissions in same session | counts each | one key icon (boolean) | one key icon (boolean) |
| Permission timeout / cancel | −1 | — | key icon disappears if last |
| Session deleted (`clearSessionDialogs`) | drops to 0 for that session | — | row also removed |
| No active session at all | counts everything | n/a | key icon shown |
| Count > 99 | rendered as `99+` | — | — |

---

## Out of Scope

- Toast / OS notification / status bar indicator.
- Reordering history items by pending state.
- Auto-switching to a session with pending permission.
- Changing the existing `auth_required` thread status semantics (it remains defined but unused; cleanup is a separate concern).
- Multi-dialog UI within the active session — existing single-dialog rendering stays.

---

## Testing

1. Start two ACP sessions. Trigger a permission request in session B while session A is active.
   - Expect: badge on history button shows `1`; opening popover shows key icon on session B; session A unaffected.
2. Switch to session B.
   - Expect: badge clears (B no longer "other"); B's dialog appears inline; key icon on B's row disappears (B is now active).
3. Resolve the dialog in B.
   - Expect: dialog closes; no badge.
4. Trigger two parallel permission requests in session B (still active = A).
   - Expect: badge `2`; one key icon on B's row.
5. Resolve one of B's pending while A active.
   - Expect: badge drops to `1`; B's row still shows key icon (still has one pending).
6. Delete session B via the history list while pending.
   - Expect: badge drops by the pending count; row removed.
7. Trigger ≥100 pending across many sessions.
   - Expect: badge renders `99+`.
