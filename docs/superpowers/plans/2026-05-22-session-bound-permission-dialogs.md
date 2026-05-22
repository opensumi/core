# Session-Bound Permission Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind ACP permission dialogs to the active chat session so that dialogs from non-active sessions are queued and shown only when the user switches to that session, removing the auto-timeout that causes invisible dialogs to expire.

**Architecture:** Three changes: (1) `AcpPermissionBridgeService` tracks the active sessionId and queues non-active session dialogs, (2) `PermissionDialogManager` filters dialogs by sessionId, (3) `AcpChatInternalService` notifies the bridge on session switch. No layout changes — still shows one dialog at a time for the active session.

**Tech Stack:** TypeScript, React, OpenSumi DI framework, Emitter/Event pattern

---

## Files to modify

| File | Action | Responsibility |
| --- | --- | --- |
| `packages/ai-native/src/browser/acp/permission-bridge.service.ts` | Modify | Add active session tracking, remove timeout, queue non-active dialogs |
| `packages/ai-native/src/browser/acp/permission-dialog-container.tsx` | Modify | Filter dialogs by active session |
| `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts` | Modify | Notify bridge on session switch |
| `packages/ai-native/__test__/browser/acp/permission-bridge.test.ts` | Create | Unit tests for session-bound dialog behavior |

---

### Task 1: Add session tracking to AcpPermissionBridgeService

**Files:**

- Modify: `packages/ai-native/src/browser/acp/permission-bridge.service.ts`

- [ ] **Step 1: Add active session state and event emitter**

Add after line 48 (after `onDidReceivePermissionResult`):

```typescript
// ---------------------------------------------------------------------------
// Active session tracking
// ---------------------------------------------------------------------------

private activeSessionId: string | undefined;

private readonly onActiveSessionChangeEmitter = new Emitter<string | undefined>();
readonly onActiveSessionChange: Event<string | undefined> = this.onActiveSessionChangeEmitter.event;

/**
 * Set the currently active session.
 * Fires event to notify UI to re-render session-scoped dialogs.
 */
setActiveSession(sessionId: string | undefined): void {
  if (this.activeSessionId === sessionId) {
    return;
  }
  this.activeSessionId = sessionId;
  this.onActiveSessionChangeEmitter.fire(sessionId);
}

/**
 * Get the currently active session ID.
 */
getActiveSession(): string | undefined {
  return this.activeSessionId;
}
```

Also add `Emitter` to the import from `@opensumi/ide-core-common` if not already there — it already is (line 2).

- [ ] **Step 2: Remove auto-timeout from showPermissionDialog**

Replace lines 82-85 (the setTimeout block):

```typescript
// Remove these lines:
// const timeout = setTimeout(() => {
//   this.handleDialogClose(requestId);
// }, params.timeout);
```

And replace the pending decision storage (lines 88-92) to not include a timeout:

```typescript
// Wait for decision (no auto-timeout)
return new Promise((resolve) => {
  this.pendingDecisions.set(requestId, {
    resolve,
    timeout: undefined as unknown as NodeJS.Timeout,
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/ai-native/src/browser/acp/permission-bridge.service.ts
git commit -m "feat(ai-native): add active session tracking to AcpPermissionBridgeService"
```

---

### Task 2: Session-scoped dialog retrieval in PermissionDialogManager

**Files:**

- Modify: `packages/ai-native/src/browser/acp/permission-dialog-container.tsx`

- [ ] **Step 1: Add getDialogsForSession method**

Add to the `PermissionDialogManager` class (after line 51, after `getDialogs()`):

```typescript
getDialogsForSession(sessionId: string | undefined): DialogState[] {
  if (!sessionId) return [];
  return this.dialogs.filter((d) => d.params.sessionId === sessionId);
}
```

- [ ] **Step 2: Add clearDialogsForSession method**

Add after `getDialogsForSession`:

```typescript
clearDialogsForSession(sessionId: string | undefined): void {
  if (!sessionId) return;
  this.dialogs = this.dialogs.filter((d) => d.params.sessionId !== sessionId);
  this.notifyListeners();
}
```

- [ ] **Step 3: Verify that DialogState params includes sessionId**

The `ShowPermissionDialogParams` interface already has `sessionId: string` (line 12 of `permission-bridge.service.ts`). The `PermissionDialogManager.addDialog` already stores the full params, so the filter will work.

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/browser/acp/permission-dialog-container.tsx
git commit -m "feat(ai-native): add session-scoped dialog retrieval to PermissionDialogManager"
```

---

### Task 3: Filter dialogs by active session in AcpPermissionDialogContainer

**Files:**

- Modify: `packages/ai-native/src/browser/acp/permission-dialog-container.tsx`

- [ ] **Step 1: Add active session state**

In `AcpPermissionDialogContainer`, add after line 144 (after `const [dialogs, setDialogs] = useState<DialogState[]>([])`):

```typescript
const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
```

- [ ] **Step 2: Subscribe to active session changes**

Add a new useEffect after the existing useEffect at line 153-162 (the one that subscribes to dialogManager):

```typescript
// Subscribe to active session changes
useEffect(() => {
  const unsubscribe = permissionBridgeService.onActiveSessionChange((sessionId) => {
    setActiveSessionId(sessionId);
  });
  // Initialize with current session
  setActiveSessionId(permissionBridgeService.getActiveSession());
  return unsubscribe;
}, []);
```

- [ ] **Step 3: Filter dialogs by active session**

Replace line 268 (the `if (dialogs.length === 0)` check) with session-filtered dialogs:

```typescript
// Filter dialogs for active session only
const sessionDialogs = functionComponentDialogManager.getDialogsForSession(activeSessionId);

// If no dialogs for this session, return null
if (sessionDialogs.length === 0) {
  return null;
}

const currentDialog = sessionDialogs[0];
const params = currentDialog.params;
```

Also update all references in the component that used `dialogs[0]` to use `sessionDialogs[0]`:

- Line 168: `const options = dialogs[0]?.params.options` → `sessionDialogs[0]?.params.options`
- Line 170: `if (dialogs.length === 0)` → `if (sessionDialogs.length === 0)`
- Line 231-235: `dialogs[0].requestId` → `sessionDialogs[0].requestId`, `dialogs[0].params` → `sessionDialogs[0].params`
- Line 257-260: `dialogs[0].requestId` → `sessionDialogs[0].requestId`

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/browser/acp/permission-dialog-container.tsx
git commit -m "feat(ai-native): filter permission dialogs by active session"
```

---

### Task 4: Notify permission bridge on session switch

**Files:**

- Modify: `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

- [ ] **Step 1: Inject AcpPermissionBridgeService**

Add import at the top (after line 5):

```typescript
import { AcpPermissionBridgeService } from '../acp/permission-bridge.service';
```

Add Autowired field after line 16 (after `messageService`):

```typescript
@Autowired(AcpPermissionBridgeService)
private permissionBridgeService: AcpPermissionBridgeService;
```

- [ ] **Step 2: Notify on activateSession**

In `activateSession()` method (around line 126, after `this._sessionModel = updatedSession;`), add:

```typescript
// Notify permission bridge of session change
const rawSessionId = sessionId.startsWith('acp:') ? sessionId.slice(4) : sessionId;
this.permissionBridgeService.setActiveSession(rawSessionId);
```

- [ ] **Step 3: Notify on createSessionModel**

In `createSessionModel()` method (around line 76, after `this._onSessionModelChange.fire(this._sessionModel);`), add:

```typescript
// Notify permission bridge of session change
const rawSessionId = this._sessionModel.sessionId.startsWith('acp:')
  ? this._sessionModel.sessionId.slice(4)
  : this._sessionModel.sessionId;
this.permissionBridgeService.setActiveSession(rawSessionId);
```

- [ ] **Step 4: Commit**

```bash
git add packages/ai-native/src/browser/chat/chat.internal.service.acp.ts
git commit -m "feat(ai-native): notify permission bridge on session switch"
```

---

### Task 5: Add unit tests for session-bound dialogs

**Files:**

- Create: `packages/ai-native/__test__/browser/acp/permission-bridge-session.test.ts`

- [ ] **Step 1: Write tests**

```bash
mkdir -p packages/ai-native/__test__/browser/acp
```

Create `packages/ai-native/__test__/browser/acp/permission-bridge-session.test.ts`:

```typescript
import { AcpPermissionBridgeService } from '../../../src/browser/acp/permission-bridge.service';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { ILogger } from '@opensumi/ide-core-common';

// Minimal mock setup for OpenSumi DI
const mockLogger = {
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const mockLayoutService = {} as IMainLayoutService;

describe('AcpPermissionBridgeService - session binding', () => {
  let bridge: AcpPermissionBridgeService;

  beforeEach(() => {
    // Direct instantiation for unit tests (bypassing DI)
    bridge = new AcpPermissionBridgeService();
    (bridge as any).logger = mockLogger;
    (bridge as any).mainLayoutService = mockLayoutService;
  });

  describe('setActiveSession', () => {
    it('should track the active session', () => {
      bridge.setActiveSession('session-1');
      expect(bridge.getActiveSession()).toBe('session-1');

      bridge.setActiveSession('session-2');
      expect(bridge.getActiveSession()).toBe('session-2');
    });

    it('should fire event when session changes', () => {
      const listener = jest.fn();
      const dispose = bridge.onActiveSessionChange(listener);

      bridge.setActiveSession('session-1');
      expect(listener).toHaveBeenCalledWith('session-1');

      dispose.dispose();
    });

    it('should not fire event when session is the same', () => {
      const listener = jest.fn();
      const dispose = bridge.onActiveSessionChange(listener);

      bridge.setActiveSession('session-1');
      expect(listener).toHaveBeenCalledTimes(1);

      bridge.setActiveSession('session-1');
      expect(listener).toHaveBeenCalledTimes(1); // No additional call

      dispose.dispose();
    });
  });

  describe('showPermissionDialog without timeout', () => {
    it('should not auto-resolve after timeout period', async () => {
      bridge.setActiveSession('session-1');

      const promise = bridge.showPermissionDialog({
        requestId: 'session-1:tool-1',
        sessionId: 'session-1',
        title: 'Test',
        options: [],
        timeout: 100, // 100ms - should NOT auto-resolve
      });

      // Wait longer than the timeout
      await new Promise((r) => setTimeout(r, 200));

      // The promise should still be pending (no resolution yet)
      // We can't directly test "pending" status, but we verify
      // handleDialogClose was NOT auto-called by checking pendingDecisions
      expect((bridge as any).pendingDecisions.has('session-1:tool-1')).toBe(true);

      // Now manually resolve
      bridge.handleDialogClose('session-1:tool-1');
      const result = await promise;
      expect(result.type).toBe('timeout');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx jest packages/ai-native/__test__/browser/acp/permission-bridge-session.test.ts --passWithNoTests 2>&1 | tail -30
```

Expected: 4 tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/ai-native/__test__/browser/acp/permission-bridge-session.test.ts
git commit -m "test(ai-native): add session-bound permission dialog tests"
```

---

### Task 6: Integration verification

**Files:**

- No new files

- [ ] **Step 1: Run full ACP test suite**

```bash
npx jest packages/ai-native/__test__/node/acp/ --passWithNoTests 2>&1 | tail -20
npx jest packages/ai-native/__test__/node/permission-routing.test.ts --passWithNoTests 2>&1 | tail -20
```

Expected: All existing tests still pass

- [ ] **Step 2: TypeScript compilation check**

```bash
npx tsc --noEmit -p packages/ai-native/tsconfig.json 2>&1 | head -30
```

Expected: No new errors

- [ ] **Step 3: Verify git status is clean**

```bash
git status
```

All changes should be committed.

---

## Self-review against spec

1. **Spec coverage:**

   - ✅ Session-scoped dialogs — Tasks 2, 3
   - ✅ No auto-timeout — Task 1
   - ✅ Pending queue for non-active sessions — Tasks 1, 2, 3
   - ✅ Session switch notification — Task 4
   - ✅ Unit tests — Task 5
   - ✅ Integration verification — Task 6

2. **Placeholder scan:** No TBD, TODO, or empty sections.

3. **Type consistency:**

   - `sessionId` is `string` throughout, extracted from `acp:` prefixed format in chat service
   - `PermissionDialogProps` already includes `requestId` and `sessionId` from `ShowPermissionDialogParams`
   - `activeSessionId` is `string | undefined` in both bridge service and dialog container

4. **Scope check:** Focused on session binding only. No layout changes, no multi-dialog UI.
