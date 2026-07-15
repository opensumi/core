# ACP Chat Queued Turn and Input Behavior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shallow ACP Chat queue helper with a session-local Queued Turn module, then align the default rich Chat Input with the approved Immediate Send, inline editing, keyboard, focus, paste, and expansion behavior.

**Architecture:** A non-React `AcpQueuedTurnModule` owns FIFO state, pause/resume, Immediate Send cancellation absorption, edit leases, and stale-event protection. `chat.view.acp.tsx` supplies the production ACP delivery adapter and renders a read-only snapshot. The registered-input seam gains optional turn actions, capabilities, and an input handle; the default Mention implementation moves behind a reusable `AcpTurnEditor` while basic and third-party inputs remain compatible.

**Tech Stack:** TypeScript, React, OpenSumi `Emitter`/`Disposable`, Jest + jsdom, Yarn 4.4.1, TypeScript project references, OpenSumi runtime BDD, and existing Playwright infrastructure.

## Global Constraints

- Use Node `>=18.12.0` and Yarn `4.4.1`; do not add dependencies.
- Preserve the `browser`, `node`, and `common` import split.
- Use `Active Session`, `Queued Turn`, and `Immediate Send` in new code, tests, labels, and comments.
- Do not implement Steer or an Agent-side ACP extension.
- Clear Queued Turns on Active Session switch, new session, and clear; do not persist them across reloads.
- Read Mode, Model, and ACP configuration at delivery time; never store them in a Queued Turn.
- Give `AcpChatMentionInput` full behavior while keeping `AcpChatInput` and third-party registrations source compatible.
- Keep queue ordering, cancel absorption, completion dispatch, and failure recovery out of React refs and registered inputs.
- Follow TDD and observe every focused test fail before implementation.
- Preserve unrelated untracked files and user changes.

---

## File Structure

### Create

- `packages/ai-native/src/browser/chat/acp-chat-queued-turns.ts` — domain types, port, snapshot, and deep module.
- `packages/ai-native/src/browser/acp/components/AcpTurnEditor.tsx` — reusable rich editor with `main` and `queued` variants.
- `packages/ai-native/src/browser/acp/components/AcpQueuedTurnEditor.tsx` — compact inline-edit adapter.
- `packages/ai-native/src/browser/chat/acp-chat-input.commands.ts` — shared input expansion command identifier.
- `packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts` — interface-level state-machine tests.
- `packages/ai-native/__test__/browser/chat/chat-input-registry.test.ts` — legacy and capability registration tests.
- `packages/ai-native/__test__/browser/acp-queued-turns.test.tsx` — queue rendering and inline-edit tests.
- `packages/ai-native/__test__/browser/acp-mention-input-behavior.test.tsx` — keyboard, IME, ArrowUp, Escape, paste, and focus tests.
- `packages/ai-native/__test__/browser/acp-chat-input-handle.test.tsx` — basic-input legacy send and safe handle regression tests.
- `test/bdd/acp-chat-agentic-queued-turns.scenario.md` — runtime behavior contract.

### Rename or replace

- `packages/ai-native/src/browser/chat/AcpQueuedMessages.tsx` → `packages/ai-native/src/browser/chat/AcpQueuedTurns.tsx`.
- Replace `packages/ai-native/__test__/browser/chat/acp-chat-queued-messages.test.ts` with the new interface-level test.
- Delete `packages/ai-native/src/browser/chat/acp-chat-queued-messages.ts` after all callers migrate.

### Modify

- `packages/ai-native/src/browser/chat/chat.view.acp.tsx`
- `packages/ai-native/src/browser/chat/chat.input.registry.ts`
- `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`
- `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`
- `packages/ai-native/src/browser/components/acp/MentionInput.tsx`
- `packages/ai-native/src/browser/components/mention-input/types.ts`
- `packages/ai-native/src/browser/ai-core.contribution.ts`
- `packages/ai-native/src/browser/chat/chat.module.less`
- `packages/ai-native/src/browser/components/components.module.less`
- `packages/ai-native/src/browser/acp/acp-bdd-runtime-fixtures.ts`
- `packages/ai-native/__test__/browser/acp-bdd-runtime-fixtures.test.ts`
- `packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx`
- `packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx`
- `packages/ai-native/__test__/browser/acp-mention-input-context-cleanup.test.tsx`
- `packages/i18n/src/common/en-US.lang.ts`
- `packages/i18n/src/common/zh-CN.lang.ts`
- `test/bdd/README.md`
- `test/bdd/acp-chat-agentic-keyboard-a11y.scenario.md`
- `test/bdd/acp-chat-agentic-input-send.scenario.md`

---

### Task 1: Establish the Queued Turn interface and basic FIFO lifecycle

**Files:**

- Create: `packages/ai-native/src/browser/chat/acp-chat-queued-turns.ts`
- Create: `packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts`

**Interfaces:**

- Consumes: `Emitter`, `Event`, and `IDisposable` from `@opensumi/ide-core-common`.
- Produces: `AcpTurnDraft`, `QueuedTurn`, `AcpQueuedTurnSnapshot`, `AcpQueuedTurnPort`, `AcpTurnHandle`, `TurnActionResult`, and `AcpQueuedTurnModule`.

- [ ] **Step 1: Write the controllable test port and failing FIFO tests**

```ts
import { Deferred } from '@opensumi/ide-core-common';

import {
  AcpQueuedTurnModule,
  AcpQueuedTurnPort,
  AcpTurnDraft,
  AcpTurnHandle,
  AcpTurnOutcome,
} from '../../../src/browser/chat/acp-chat-queued-turns';

class ControlledTurnPort implements AcpQueuedTurnPort {
  readonly starts: Array<{ sessionId?: string; draft: AcpTurnDraft; completion: Deferred<AcpTurnOutcome> }> = [];
  status: 'idle' | 'generating' = 'idle';

  getStatus() {
    return this.status;
  }

  async start(sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle> {
    const completion = new Deferred<AcpTurnOutcome>();
    this.status = 'generating';
    const id = `delivery-${this.starts.length + 1}`;
    this.starts.push({ sessionId, draft, completion });
    return { id, sessionId: sessionId || 'acp:created-session', outcome: completion.promise };
  }

  async ensureCurrentCancelled(): Promise<void> {
    this.status = 'idle';
  }

  complete(index: number, outcome: AcpTurnOutcome = 'completed') {
    this.status = 'idle';
    this.starts[index].completion.resolve(outcome);
  }
}

describe('AcpQueuedTurnModule', () => {
  it('starts an idle draft and queues later drafts in FIFO order', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');

    await turns.submit({ message: 'first' });
    await turns.submit({ message: 'second' });
    await turns.submit({ message: 'third' });

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['first']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['second', 'third']);

    port.complete(0);
    await turns.whenSettled();

    expect(port.starts.map(({ draft }) => draft.message)).toEqual(['first', 'second']);
    expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['third']);
  });

  it('clears queued work and ignores an old completion after Active Session changes', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate('acp:session-1');
    await turns.submit({ message: 'running' });
    await turns.submit({ message: 'old queued' });

    turns.activate('acp:session-2');
    port.complete(0);
    await turns.whenSettled();

    expect(turns.snapshot.activeSessionId).toBe('acp:session-2');
    expect(turns.snapshot.entries).toEqual([]);
    expect(port.starts).toHaveLength(1);
  });

  it('adopts the session id returned by the first draft send without treating it as a switch', async () => {
    const port = new ControlledTurnPort();
    const turns = new AcpQueuedTurnModule(port);
    turns.activate(undefined);
    await turns.submit({ message: 'create the session' });
    expect(turns.snapshot.activeSessionId).toBe('acp:created-session');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run:

```bash
yarn test packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts --runInBand
```

Expected: FAIL because `acp-chat-queued-turns.ts` and `AcpQueuedTurnModule` do not exist.

- [ ] **Step 3: Add the domain types and basic module**

Use these public types exactly:

```ts
export interface AcpTurnDraft {
  message: string;
  images?: readonly string[];
  agentId?: string;
  command?: string;
}

export interface QueuedTurn extends AcpTurnDraft {
  id: string;
}

export type AcpTurnOutcome = 'completed' | 'manual-stop' | 'agent-error';

export interface AcpTurnHandle {
  id: string;
  sessionId: string;
  outcome: Promise<AcpTurnOutcome>;
}

export interface AcpQueuedTurnPort {
  getStatus(sessionId: string | undefined): 'idle' | 'generating';
  start(sessionId: string | undefined, draft: AcpTurnDraft): Promise<AcpTurnHandle>;
  ensureCurrentCancelled(sessionId: string | undefined): Promise<void>;
}

export type QueuePauseReason = 'manual-stop' | 'agent-error' | 'start-failed' | 'cancel-failed';

export interface AcpQueuedTurnSnapshot {
  activeSessionId?: string;
  phase: 'idle' | 'generating' | 'paused' | 'cancelling-for-immediate';
  entries: readonly QueuedTurn[];
  editingTurnId?: string;
  pauseReason?: QueuePauseReason;
  canResume: boolean;
  canFastTrack: boolean;
}

export type TurnActionResult =
  | { accepted: true; outcome: 'started' | 'queued' | 'updated' | 'removed' | 'resumed' | 'stopped' }
  | {
      accepted: false;
      reason:
        | 'empty-content'
        | 'turn-not-found'
        | 'another-turn-is-editing'
        | 'stale-session'
        | 'unsupported-capability'
        | 'start-failed'
        | 'cancel-failed';
    };
```

Add a serialized operation tail and expose `whenSettled()` only for deterministic tests:

```ts
private operationTail = Promise.resolve();

private serialize<T>(operation: () => Promise<T> | T): Promise<T> {
  const result = this.operationTail.then(operation, operation);
  this.operationTail = result.then(() => undefined, () => undefined);
  return result;
}

whenSettled(): Promise<void> {
  return this.operationTail;
}
```

`activate()` is a no-op for the current ID, increments a session epoch for a real switch, and clears entries/edit/reservation state. The first draft send may adopt `AcpTurnHandle.sessionId` without clearing state. If an external activation arrives while that first start is pending, hold it in `pendingActivationId`; treat it as draft promotion only when it matches the returned handle ID, otherwise perform a real switch and reject the stale start.

`submit()` validates with `hasAcpChatSendPayload`, starts immediately while idle, and appends to the tail while generating. Attach each outcome to the serialized transition path and compare epoch plus delivery ID before processing it.

- [ ] **Step 4: Run the focused test and confirm FIFO/session isolation pass**

```bash
yarn test packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the basic deep module**

```bash
git add packages/ai-native/src/browser/chat/acp-chat-queued-turns.ts packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts
git commit -m "feat(ai-native): add ACP queued turn module"
```

---

### Task 2: Complete pause, Immediate Send, editing, take-back, and failure transitions

**Files:**

- Modify: `packages/ai-native/src/browser/chat/acp-chat-queued-turns.ts`
- Modify: `packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts`

**Interfaces:**

- Consumes: Task 1's module and controlled port.
- Produces: `stop`, `resume`, `sendImmediately`, `fastTrack`, `invalidateFastTrack`, `beginEdit`, `commitEdit`, `cancelEdit`, `takeBackLast`, `remove`, and `clear`.

- [ ] **Step 1: Add failing transition tests**

```ts
it.each(['manual-stop', 'agent-error'] as const)('pauses remaining FIFO after %s', async (outcome) => {
  const port = new ControlledTurnPort();
  const turns = new AcpQueuedTurnModule(port);
  turns.activate('acp:session-1');
  await turns.submit({ message: 'running' });
  await turns.submit({ message: 'keep queued' });

  port.complete(0, outcome);
  await turns.whenSettled();

  expect(turns.snapshot.phase).toBe('paused');
  expect(turns.snapshot.pauseReason).toBe(outcome);
  expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['keep queued']);
});

it('waits for cancellation before Immediate Send and preserves the remaining order', async () => {
  const cancel = new Deferred<void>();
  const port = new ControlledTurnPort();
  port.ensureCurrentCancelled = jest.fn(() => cancel.promise);
  const turns = new AcpQueuedTurnModule(port);
  turns.activate('acp:session-1');
  await turns.submit({ message: 'running' });
  await turns.submit({ message: 'first queued' });
  await turns.submit({ message: 'selected' });
  await turns.submit({ message: 'last queued' });

  const immediate = turns.sendImmediately(turns.snapshot.entries[1].id);
  expect(turns.snapshot.phase).toBe('cancelling-for-immediate');
  expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running']);

  cancel.resolve();
  await immediate;

  expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'selected']);
  expect(turns.snapshot.entries.map(({ message }) => message)).toEqual(['first queued', 'last queued']);
});

it('blocks an edited head until save', async () => {
  const port = new ControlledTurnPort();
  const turns = new AcpQueuedTurnModule(port);
  turns.activate('acp:session-1');
  await turns.submit({ message: 'running' });
  await turns.submit({ message: 'head' });

  turns.beginEdit(turns.snapshot.entries[0].id);
  port.complete(0);
  await turns.whenSettled();
  expect(port.starts).toHaveLength(1);

  await turns.commitEdit(turns.snapshot.entries[0].id, { message: 'edited head' });
  expect(port.starts.map(({ draft }) => draft.message)).toEqual(['running', 'edited head']);
});
```

Also add explicit tests for cancel failure, Resume Queue, a corrective new draft while paused, rejecting a second `beginEdit` with `another-turn-is-editing`, editing a non-head turn without blocking earlier FIFO work, commit-and-Immediate-Send, cancel edit, delete edited head, take-back tail, one-shot fast track, clear, duplicate completion, repeated Immediate Send, and pre-start failure returning the target to the head.

The one-shot test must call `invalidateFastTrack()` after simulating a user draft change and assert that the following empty Enter cannot dispatch the head.

- [ ] **Step 2: Run the test and confirm the new transitions fail**

```bash
yarn test packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts --runInBand
```

Expected: FAIL on missing methods and transition semantics.

- [ ] **Step 3: Implement the full private state machine**

Use private state, not public `pendingDispatch`:

```ts
private processing: 'auto' | 'paused' | 'absorbing-cancel' = 'auto';
private entries: QueuedTurn[] = [];
private activeDelivery?: { id: string; epoch: number };
private immediateReservation?: QueuedTurn;
private editingTurnId?: string;
private canFastTrack = false;
private pauseReason?: QueuePauseReason;
private nextId = 0;
private sessionEpoch = 0;
private pendingActivationId?: string;
```

Centralize starts:

```ts
private async startReservedTurn(turn: QueuedTurn, returnToHeadOnFailure: boolean): Promise<TurnActionResult> {
  const epoch = this.sessionEpoch;
  try {
    const handle = await this.port.start(this.activeSessionId, turn);
    if (epoch !== this.sessionEpoch) return { accepted: false, reason: 'stale-session' };
    this.activeSessionId = handle.sessionId;
    this.activeDelivery = { id: handle.id, epoch };
    this.publish();
    void handle.outcome.then((outcome) => this.serialize(() => this.finishDelivery(handle.id, epoch, outcome)));
    return { accepted: true, outcome: 'started' };
  } catch {
    if (epoch === this.sessionEpoch && returnToHeadOnFailure) {
      this.entries.unshift(turn);
      this.processing = 'paused';
      this.pauseReason = 'start-failed';
      this.publish();
    }
    return { accepted: false, reason: 'start-failed' };
  }
}
```

`sendImmediately()` reserves before cancelling, enters `absorbing-cancel`, waits for confirmed cancellation, ignores the cancelled delivery's later completion by ID, and starts the reservation. `stop()` enters paused before cancellation. `finishDelivery()` advances only on `completed + auto` and waits when the head is being edited.

Do not schedule automatic retries after `start-failed`, `cancel-failed`, or `agent-error`. Recovery occurs only through `resume()`, editing/removal, a new user submission, or Immediate Send.

- [ ] **Step 4: Run tests and typecheck**

```bash
yarn test packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts --runInBand
yarn tsc --build configs/ts/references/tsconfig.ai-native.json --pretty false
```

Expected: PASS and exit `0`.

- [ ] **Step 5: Commit the completed state machine**

```bash
git add packages/ai-native/src/browser/chat/acp-chat-queued-turns.ts packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts
git commit -m "feat(ai-native): complete ACP queued turn transitions"
```

---

### Task 3: Add backwards-compatible Chat Input behavior contracts

**Files:**

- Modify: `packages/ai-native/src/browser/chat/chat.input.registry.ts`
- Create: `packages/ai-native/__test__/browser/chat/chat-input-registry.test.ts`
- Modify: `packages/ai-native/src/browser/ai-core.contribution.ts`

**Interfaces:**

- Consumes: `AcpTurnDraft`, `QueuedTurn`, and `TurnActionResult` from Task 1.
- Produces: `ChatInputCapability`, `ChatInputHandle`, `ChatInputTurnActions`, optional handle registration, and optional queued-editor registration.

- [ ] **Step 1: Add failing registry compatibility tests**

```ts
import * as React from 'react';

import { ChatInputRegistry } from '../../../src/browser/chat/chat.input.registry';

describe('ChatInputRegistry ACP turn capabilities', () => {
  it('keeps a legacy input valid without new fields', () => {
    const registry = new ChatInputRegistry();
    const LegacyInput = () => React.createElement('div');
    registry.registerChatInput({ id: 'legacy', component: LegacyInput, priority: 10 });
    expect(registry.getActiveChatInput()).toMatchObject({ id: 'legacy', capabilities: [] });
  });

  it('returns declared capabilities and a queued editor', () => {
    const registry = new ChatInputRegistry();
    const Input = () => React.createElement('div');
    const QueuedEditor = () => React.createElement('div');
    registry.registerChatInput({
      id: 'rich',
      component: Input,
      queuedTurnEditor: QueuedEditor,
      capabilities: ['restore-draft', 'focus', 'expand', 'rich-queued-edit'],
      priority: 20,
    });
    expect(registry.getActiveChatInput()).toMatchObject({
      id: 'rich',
      queuedTurnEditor: QueuedEditor,
      capabilities: ['restore-draft', 'focus', 'expand', 'rich-queued-edit'],
    });
  });

  it('routes commands only to the currently mounted input handle', () => {
    const registry = new ChatInputRegistry();
    const handle = { toggleExpanded: jest.fn() };
    registry.setActiveInputHandle(handle);
    expect(registry.getActiveInputHandle()).toBe(handle);
    registry.setActiveInputHandle(null);
    expect(registry.getActiveInputHandle()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the registry test and confirm missing properties fail**

```bash
yarn test packages/ai-native/__test__/browser/chat/chat-input-registry.test.ts --runInBand
```

Expected: FAIL because contributions do not normalize capabilities or carry a queued editor.

- [ ] **Step 3: Extend the input interface with optional behavior hooks**

Add these types to `chat.input.registry.ts`:

```ts
export type ChatInputCapability =
  | 'restore-draft'
  | 'focus'
  | 'expand'
  | 'images'
  | 'mentions'
  | 'paste'
  | 'rich-queued-edit';

export interface ChatInputHandle {
  restoreDraft?(draft: AcpTurnDraft): void;
  focus?(): void;
  setExpanded?(expanded: boolean): void;
  toggleExpanded?(): void;
  closeTransientUi?(): boolean;
}

export interface ChatInputTurnActions {
  submit(draft: AcpTurnDraft, intent: 'normal' | 'immediate'): Promise<TurnActionResult>;
  stop(): Promise<TurnActionResult>;
  fastTrack(): Promise<TurnActionResult>;
  invalidateFastTrack(): void;
  takeBackLastQueuedTurn(): QueuedTurn | undefined;
}

export interface QueuedTurnEditorProps {
  turn: QueuedTurn;
  onSave(draft: AcpTurnDraft): Promise<void> | void;
  onCancel(): void;
  onImmediateSend(draft: AcpTurnDraft): Promise<void> | void;
  onReady?(handle: ChatInputHandle | null): void;
}
```

Add optional fields to `IChatInputProps`:

```ts
turnActions?: ChatInputTurnActions;
onInputHandleReady?: (handle: ChatInputHandle | null) => void;
```

Add optional fields to `ChatInputContribution`:

```ts
capabilities?: ChatInputCapability[];
queuedTurnEditor?: React.ComponentType<QueuedTurnEditorProps>;
```

Normalize with `capabilities: [...(contribution.capabilities || [])]`. Keep `onSend` and every new field optional so legacy inputs compile unchanged.

Add active-handle routing to `IChatInputRegistry`/`ChatInputRegistry`:

```ts
setActiveInputHandle(handle: ChatInputHandle | null): void;
getActiveInputHandle(): ChatInputHandle | null;
```

The view sets this handle from `onInputHandleReady`; the registry clears it when the active input unmounts. This is command routing only and must not own draft or queue state.

- [ ] **Step 4: Declare built-in capabilities without wiring behavior yet**

In `registerDefaultInputs()` declare full capabilities for `acp-mention-input`:

```ts
capabilities: ['restore-draft', 'focus', 'expand', 'images', 'mentions', 'paste', 'rich-queued-edit'],
```

Declare only safe capabilities for `acp-chat-input`:

```ts
capabilities: ['restore-draft', 'focus', 'expand'],
```

Add `queuedTurnEditor` only in Task 6 after it exists.

- [ ] **Step 5: Run tests and TypeScript reference**

```bash
yarn test packages/ai-native/__test__/browser/chat/chat-input-registry.test.ts --runInBand
yarn tsc --build configs/ts/references/tsconfig.ai-native.json --pretty false
```

Expected: PASS; existing registered inputs compile because all additions are optional.

- [ ] **Step 6: Commit the input seam**

```bash
git add packages/ai-native/src/browser/chat/chat.input.registry.ts packages/ai-native/src/browser/ai-core.contribution.ts packages/ai-native/__test__/browser/chat/chat-input-registry.test.ts
git commit -m "refactor(ai-native): add chat input turn capabilities"
```

---

### Task 4: Integrate the deep module with the ACP view and request lifecycle

**Files:**

- Modify: `packages/ai-native/src/browser/chat/chat.view.acp.tsx`
- Modify: `packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx`
- Delete after migration: `packages/ai-native/src/browser/chat/acp-chat-queued-messages.ts`
- Delete after migration: `packages/ai-native/__test__/browser/chat/acp-chat-queued-messages.test.ts`

**Interfaces:**

- Consumes: Tasks 1–3.
- Produces: a production `AcpQueuedTurnPort` adapter and `ChatInputTurnActions` passed to the active input.

- [ ] **Step 1: Upgrade the view tests to model response completion**

Add a reusable response mock:

```ts
function createRequestResponse() {
  const listeners = new Set<() => void>();
  const response = {
    isComplete: false,
    isCanceled: false,
    errorDetails: undefined as { message: string } | undefined,
    onDidChange(listener: () => void) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    finish(outcome: 'completed' | 'manual-stop' | 'agent-error') {
      response.isComplete = true;
      response.isCanceled = outcome === 'manual-stop';
      response.errorDetails = outcome === 'agent-error' ? { message: 'agent failed' } : undefined;
      listeners.forEach((listener) => listener());
    },
  };
  return response;
}
```

Rewrite the existing queue test to finish this response rather than call `ChatReply.onDone`. Add tests that:

- stop manually, observe Paused, click Resume Queue, and start only the original head;
- click Immediate Send and prove no second request starts until cancellation completion;
- switch the mocked Active Session, finish the old response, and prove no old queued turn starts.
- queue a draft while one Model/config snapshot is visible, change the mocked Active Session Model/config before completion, and prove the second `createRequest`/send path uses current session state rather than a stored `option`.

- [ ] **Step 2: Run the focused view test and confirm it fails**

```bash
yarn test packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx --runInBand
```

Expected: FAIL because the view still uses queue state refs and completion callbacks.

- [ ] **Step 3: Refactor the existing send path to return a started handle**

Introduce:

```ts
interface StartedAcpTurn {
  sessionId: string;
  requestId: string;
  response: ChatRequestModel['response'];
}
```

After `sendRequest(request)` and reply rendering are installed, return the session/request/response. Convert response state to an outcome:

```ts
function toTurnOutcome(response: ChatRequestModel['response']): Promise<AcpTurnOutcome> {
  return new Promise((resolve) => {
    const finish = () => {
      if (!response.isComplete) return;
      disposable.dispose();
      resolve(response.isCanceled ? 'manual-stop' : response.errorDetails ? 'agent-error' : 'completed');
    };
    const disposable = response.onDidChange(finish);
    finish();
  });
}
```

Create one stable module instance with a delegating port whose callbacks point at the latest render closures. It is acceptable to keep a port-callback ref; do not keep queue state, loading decisions, cancellation suppression, or pending dispatch in refs.

The production `start()` expands current Mention tokens, starts the existing request/render path, and returns:

```ts
{
  id: started.requestId,
  sessionId: started.sessionId,
  outcome: toTurnOutcome(started.response),
}
```

`ensureCurrentCancelled()` normalizes an already-idle/already-stopped host response to success; otherwise it calls `aiChatService.cancelRequest()` and waits for the matching response to become complete/cancelled.

- [ ] **Step 4: Subscribe to snapshots and expose input actions**

Use `useSyncExternalStore` or a small `useState + onDidChange` adapter. Call `queuedTurns.activate(aiChatService.sessionModel?.sessionId)` from the session-model effect.

```ts
const turnActions = React.useMemo<ChatInputTurnActions>(
  () => ({
    submit: (draft, intent) => queuedTurns.submit(draft, intent),
    stop: () => queuedTurns.stop(),
    fastTrack: () => queuedTurns.fastTrack(),
    invalidateFastTrack: () => queuedTurns.invalidateFastTrack(),
    takeBackLastQueuedTurn: () => queuedTurns.takeBackLast(),
  }),
  [queuedTurns],
);
```

Keep legacy `onSend` as an adapter to `submit(..., 'normal')`. Remove:

- `queuedMessagesStateRef`;
- `sendQueuedMessageRef`;
- `suppressNextCancelQueuePauseRef`;
- queue advancement from `finishCurrentTurn`;
- queue decisions based on `loadingRef`;
- imports from `acp-chat-queued-messages.ts`.

The legacy `option` argument may remain in the registered-input callback for source compatibility, but do not copy it into `AcpTurnDraft` or use it for queued delivery. Resume Queue and automatic advancement must call the same production port start path that reads the current Active Session Mode, Model, and configuration.

The display `loading` state may remain, but it cannot decide queue transitions.

- [ ] **Step 5: Run focused tests and delete the old helper with apply_patch**

```bash
yarn test packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx --runInBand
```

Expected: PASS with response outcomes driving the queue. Delete `acp-chat-queued-messages.ts` and its obsolete pure-function test only after no imports remain; the new interface-level suite is the replacement test surface.

- [ ] **Step 6: Commit the view integration**

```bash
git add packages/ai-native/src/browser/chat/chat.view.acp.tsx packages/ai-native/src/browser/chat/acp-chat-queued-turns.ts packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx packages/ai-native/src/browser/chat/acp-chat-queued-messages.ts packages/ai-native/__test__/browser/chat/acp-chat-queued-messages.test.ts
git commit -m "refactor(ai-native): route ACP sends through queued turns"
```

---

### Task 5: Extract the reusable rich AcpTurnEditor and full input handle

**Files:**

- Rename: `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx` → `packages/ai-native/src/browser/acp/components/AcpTurnEditor.tsx`
- Create: `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`
- Modify: `packages/ai-native/src/browser/components/acp/MentionInput.tsx`
- Modify: `packages/ai-native/src/browser/components/mention-input/types.ts`
- Modify: `packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx`

**Interfaces:**

- Consumes: `AcpTurnDraft`, `ChatInputHandle`, and `ChatInputTurnActions`.
- Produces: `MentionInputHandle`, `AcpTurnEditorHandle`, and a thin registered adapter.

- [ ] **Step 1: Add failing full-handle tests**

Extend the ref test to call `restoreDraft`, `focus`, `setExpanded`, and `closeTransientUi`, and assert `onInputHandleReady` receives the same handle. Update the mocked `MentionInput` to expose spies through a forwarded ref.

```ts
const ref = React.createRef<ChatInputHandle>();
renderInput({ ref, onInputHandleReady });
act(() => {
  ref.current!.restoreDraft?.({
    message: '{{@file:/workspace/editor.js}} follow up',
    images: ['data:image/png;base64,queued'],
    agentId: 'default-agent',
    command: '/review',
  });
  ref.current!.focus?.();
  ref.current!.setExpanded?.(true);
});
expect(mockMentionInputRestore).toHaveBeenCalled();
expect(mockMentionInputFocus).toHaveBeenCalled();
expect(onInputHandleReady).toHaveBeenCalledWith(ref.current);
```

Add a second test using a mock `MentionInput` that renders one persistent contenteditable node:

```ts
const editorBefore = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
editorBefore.textContent = 'preserve cursor';
editorBefore.focus();
const range = document.createRange();
range.setStart(editorBefore.firstChild!, 8);
range.collapse(true);
window.getSelection()!.removeAllRanges();
window.getSelection()!.addRange(range);

act(() => ref.current?.toggleExpanded?.());

const editorAfter = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
expect(editorAfter).toBe(editorBefore);
expect(document.activeElement).toBe(editorBefore);
expect(window.getSelection()!.getRangeAt(0).startOffset).toBe(8);
```

- [ ] **Step 2: Run the ref test and confirm missing methods fail**

```bash
yarn test packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx --runInBand
```

Expected: FAIL because only `setInputValue` exists.

- [ ] **Step 3: Rename the implementation and add editor handles**

Use `apply_patch` to add `AcpTurnEditor.tsx` from the existing implementation, then reduce `AcpChatMentionInput.tsx` to the thin wrapper in Step 4. Export `AcpTurnEditor` and add:

```ts
export type AcpTurnEditorVariant = 'main' | 'queued';

export interface AcpTurnEditorHandle extends ChatInputHandle {
  getDraft(): AcpTurnDraft;
}

export interface AcpTurnEditorProps extends IChatMentionInputProps {
  variant?: AcpTurnEditorVariant;
  initialDraft?: AcpTurnDraft;
  onCancelEdit?: () => void;
  onImmediateSend?: (draft: AcpTurnDraft) => void | Promise<void>;
}
```

Convert `MentionInput` to `React.forwardRef<MentionInputHandle, MentionInputProps>`:

```ts
export interface MentionInputHandle {
  getSerializedContent(): string;
  restoreSerializedContent(content: string): void;
  focus(): void;
  closeTransientUi(): boolean;
}
```

Restore serialized Mention tokens by creating DOM nodes with `textContent` and `dataset`; do not use `dangerouslySetInnerHTML`. Preserve `{{@file:...}}`, `{{@folder:...}}`, `{{@code:...}}`, and `{{@rule:...}}` as the only serialized schema.

Implement the outer handle:

```ts
React.useImperativeHandle(
  ref,
  () => ({
    getDraft: () => ({
      message: mentionInputRef.current?.getSerializedContent() || value,
      images: images.map((image) => image.toString()),
      agentId: props.agentId,
      command: props.command,
    }),
    restoreDraft: (draft) => {
      mentionInputRef.current?.restoreSerializedContent(draft.message);
      setImages([...(draft.images || [])]);
      props.setAgentId(draft.agentId || '');
      props.setCommand(draft.command || '');
    },
    focus: () => mentionInputRef.current?.focus(),
    setExpanded: (expanded) => setIsExpanded(expanded),
    toggleExpanded: () => setIsExpanded((expanded) => !expanded),
    closeTransientUi: () => mentionInputRef.current?.closeTransientUi() || false,
  }),
  [images, props.agentId, props.command],
);
```

Register/unregister this handle through `onInputHandleReady`.

- [ ] **Step 4: Recreate AcpChatMentionInput as a thin adapter**

```tsx
export const AcpChatMentionInput = React.forwardRef<AcpTurnEditorHandle, IChatMentionInputProps>((props, ref) => (
  <AcpTurnEditor {...props} ref={ref} variant='main' />
));
```

Re-export existing prop and handle types so current imports remain valid.

- [ ] **Step 5: Run Mention/context/ref tests and typecheck**

```bash
yarn test packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx packages/ai-native/__test__/browser/acp-mention-input-context-cleanup.test.tsx --runInBand
yarn tsc --build configs/ts/references/tsconfig.ai-native.json --pretty false
```

Expected: PASS with no function-ref warning and no context cleanup regression.

- [ ] **Step 6: Commit the editor extraction**

```bash
git add packages/ai-native/src/browser/acp/components/AcpTurnEditor.tsx packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx packages/ai-native/src/browser/components/acp/MentionInput.tsx packages/ai-native/src/browser/components/mention-input/types.ts packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx
git commit -m "refactor(ai-native): extract reusable ACP turn editor"
```

---

### Task 6: Add Queued Turn rendering, paused controls, and rich inline editing

**Files:**

- Rename: `packages/ai-native/src/browser/chat/AcpQueuedMessages.tsx` → `packages/ai-native/src/browser/chat/AcpQueuedTurns.tsx`
- Create: `packages/ai-native/src/browser/acp/components/AcpQueuedTurnEditor.tsx`
- Create: `packages/ai-native/__test__/browser/acp-queued-turns.test.tsx`
- Modify: `packages/ai-native/src/browser/chat/chat.view.acp.tsx`
- Modify: `packages/ai-native/src/browser/ai-core.contribution.ts`
- Modify: `packages/ai-native/src/browser/chat/chat.module.less`
- Modify: `packages/i18n/src/common/en-US.lang.ts`
- Modify: `packages/i18n/src/common/zh-CN.lang.ts`

**Interfaces:**

- Consumes: snapshot/edit methods, queued-editor registration, and `AcpTurnEditor`.
- Produces: visible paused state, Resume Queue, one inline editor, capability-gated actions, and stable runtime locators.

- [ ] **Step 1: Write failing queue rendering/editing tests**

```tsx
import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { AcpQueuedTurns } from '../../src/browser/chat/AcpQueuedTurns';
import { AcpQueuedTurnSnapshot } from '../../src/browser/chat/acp-chat-queued-turns';
import { ChatInputCapability, QueuedTurnEditorProps } from '../../src/browser/chat/chat.input.registry';

let container: HTMLDivElement;
let root: Root;
const onResume = jest.fn();

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

const baseSnapshot: AcpQueuedTurnSnapshot = {
  activeSessionId: 'acp:session-1',
  phase: 'generating',
  entries: [{ id: 'turn-1', message: 'first' }],
  canResume: false,
  canFastTrack: false,
};

const query = (selector: string) => container.querySelector(selector);
const click = (selector: string) =>
  act(() => (query(selector) as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true })));

const QueuedEditor = ({ turn, onSave, onCancel, onImmediateSend }: QueuedTurnEditorProps) => (
  <div data-testid='queued-editor'>
    <button onClick={() => onSave({ ...turn, message: 'edited' })}>save</button>
    <button onClick={onCancel}>cancel</button>
    <button onClick={() => onImmediateSend({ ...turn, message: 'edited immediate' })}>immediate</button>
  </div>
);

function renderQueue(
  overrides: Partial<AcpQueuedTurnSnapshot> & {
    capabilities?: ChatInputCapability[];
    QueuedEditor?: React.ComponentType<QueuedTurnEditorProps>;
    onCommitEdit?: jest.Mock;
  } = {},
) {
  const snapshot = { ...baseSnapshot, ...overrides };
  const Editor = Object.prototype.hasOwnProperty.call(overrides, 'QueuedEditor')
    ? overrides.QueuedEditor
    : QueuedEditor;
  act(() => {
    root.render(
      <AcpQueuedTurns
        snapshot={snapshot}
        expanded
        capabilities={overrides.capabilities || ['rich-queued-edit']}
        QueuedEditor={Editor}
        onToggleExpanded={jest.fn()}
        onResume={onResume}
        onClear={jest.fn()}
        onBeginEdit={jest.fn()}
        onCommitEdit={overrides.onCommitEdit || jest.fn()}
        onCancelEdit={jest.fn()}
        onDelete={jest.fn()}
        onImmediateSend={jest.fn()}
        onEditorReady={jest.fn()}
      />,
    );
  });
}

it('renders paused state and resumes', () => {
  renderQueue({ phase: 'paused', pauseReason: 'manual-stop', canResume: true });
  expect(query('[data-testid="acp-queued-turn-status"]')?.textContent).toContain('Paused');
  click('[data-testid="acp-queued-turn-resume"]');
  expect(onResume).toHaveBeenCalledTimes(1);
});

it('keeps one inline editor and disables collapse while editing', () => {
  renderQueue({ editingTurnId: 'turn-1', QueuedEditor });
  expect(query('[data-testid="queued-editor"]')).not.toBeNull();
  expect((query('[data-testid="acp-queued-turns-summary"]') as HTMLButtonElement).disabled).toBe(true);
});

it('hides rich edit when the active input does not declare it', () => {
  renderQueue({ capabilities: ['focus'], QueuedEditor: undefined });
  expect(query('[aria-label="Edit queued turn"]')).toBeNull();
});

it('commits serialized Mention content and images without changing the turn id', () => {
  const onCommitEdit = jest.fn();
  const MentionEditor = ({ onSave }: QueuedTurnEditorProps) => (
    <button
      data-testid='save-mention-edit'
      onClick={() =>
        onSave({
          message: '{{@file:/workspace/editor.js}} review this',
          images: ['data:image/png;base64,queued'],
        })
      }
    >
      save mention
    </button>
  );
  renderQueue({ QueuedEditor: MentionEditor, editingTurnId: 'turn-1', onCommitEdit });
  click('[data-testid="save-mention-edit"]');
  expect(onCommitEdit).toHaveBeenCalledWith(
    'turn-1',
    {
      message: '{{@file:/workspace/editor.js}} review this',
      images: ['data:image/png;base64,queued'],
    },
    false,
  );
});
```

Use the repository's `createRoot`/`act` style; do not add a testing-library dependency.

- [ ] **Step 2: Run the UI test and confirm missing behavior fails**

```bash
yarn test packages/ai-native/__test__/browser/acp-queued-turns.test.tsx --runInBand
```

Expected: FAIL because the new renderer and inline editor do not exist.

- [ ] **Step 3: Add the compact queued editor adapter**

`AcpQueuedTurnEditor` owns queue-edit-local agent, command, and theme state and renders. It obtains `AppConfig` for `agentCwd`, but it does not share the main input's mutable `LLMContextService`: queued Mention chips serialize into the approved `{{@type:contextId}}` message representation, and the production delivery path resolves those tokens. This prevents editing one queued turn from cleaning or replacing the main draft's context.

```tsx
<AcpTurnEditor
  variant='queued'
  initialDraft={turn}
  agentId={agentId}
  setAgentId={setAgentId}
  command={command}
  setCommand={setCommand}
  theme={theme}
  setTheme={setTheme}
  agentCwd={appConfig.workspaceDir}
  onSend={(message, images, nextAgentId, nextCommand) =>
    onSave({ message, images, agentId: nextAgentId, command: nextCommand })
  }
  onCancelEdit={onCancel}
  onImmediateSend={onImmediateSend}
  onInputHandleReady={onReady}
/>
```

The queued variant hides Mode, Model, configuration, MCP, Rules, and expansion controls while retaining Mention selection, image preview/upload, paste, and the compact editor body.

- [ ] **Step 4: Rename and deepen the queue renderer**

Use this prop surface:

```ts
export interface AcpQueuedTurnsProps {
  snapshot: AcpQueuedTurnSnapshot;
  expanded: boolean;
  capabilities: readonly ChatInputCapability[];
  QueuedEditor?: React.ComponentType<QueuedTurnEditorProps>;
  onToggleExpanded(): void;
  onResume(): void;
  onClear(): void;
  onBeginEdit(id: string): void;
  onCommitEdit(id: string, draft: AcpTurnDraft, immediate: boolean): void;
  onCancelEdit(id: string): void;
  onDelete(id: string): void;
  onImmediateSend(id: string): void;
  onEditorReady(handle: ChatInputHandle | null): void;
}
```

Disable collapse while `editingTurnId` is set. Add ARIA labels and stable IDs:

- `acp-queued-turns-summary`
- `acp-queued-turn-status`
- `acp-queued-turn-resume`
- `acp-queued-turn`
- `acp-queued-turn-preview`
- `acp-queued-turn-edit`
- `acp-queued-turn-delete`
- `acp-queued-turn-immediate`
- `acp-queued-turn-editor`

- [ ] **Step 5: Wire queue intents and focus restoration in the view**

Keep one main-input handle and one queued-editor handle registered through callbacks. After save, cancel, delete, take-back, or Immediate Send:

```ts
mainInputHandleRef.current?.focus?.();
```

Do not focus after enqueue, collapse, expansion, or automatic advancement. Call module `beginEdit`, `commitEdit`, `cancelEdit`, `remove`, `clear`, `resume`, and `sendImmediately` directly.

When Edit is requested for another turn while one edit lease exists:

```ts
const result = queuedTurns.beginEdit(id);
if (!result.accepted && result.reason === 'another-turn-is-editing') {
  queuedEditorHandleRef.current?.focus?.();
}
```

Do not open a modal, save automatically, or discard the current edit.

Refactor the current `ChatInputWrapperRender` memo to retain the full active `ChatInputContribution`, not only its React type. Read `component`, `capabilities`, and `queuedTurnEditor` from that same selected contribution so a lower-priority or third-party input cannot accidentally inherit the default rich editor's capabilities.

Auto-expand the first entry only if the user has not manually collapsed during the Active Session. Reset that preference on session activation.

- [ ] **Step 6: Register the editor and add strings/styles**

Add `queuedTurnEditor: AcpQueuedTurnEditor` only to `acp-mention-input`. Add English and Chinese strings for count, Paused, pause reasons, Resume Queue, Clear All, Edit, Delete, Immediate Send, finish-edit-before-collapse, partial upload failure, and ARIA labels.

Style the compact editor and focus state with existing design tokens. Keep the existing max-height scrolling behavior.

- [ ] **Step 7: Run queue UI, view, and type tests**

```bash
yarn test packages/ai-native/__test__/browser/acp-queued-turns.test.tsx packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx --runInBand
yarn tsc --build configs/ts/references/tsconfig.ai-native.json --pretty false
```

Expected: PASS.

- [ ] **Step 8: Commit Phase 1 UI**

```bash
git add packages/ai-native/src/browser/chat/AcpQueuedTurns.tsx packages/ai-native/src/browser/acp/components/AcpQueuedTurnEditor.tsx packages/ai-native/src/browser/chat/chat.view.acp.tsx packages/ai-native/src/browser/ai-core.contribution.ts packages/ai-native/src/browser/chat/chat.module.less packages/i18n/src/common/en-US.lang.ts packages/i18n/src/common/zh-CN.lang.ts packages/ai-native/__test__/browser/acp-queued-turns.test.tsx packages/ai-native/src/browser/chat/AcpQueuedMessages.tsx
git commit -m "feat(ai-native): add queued turn editing controls"
```

---

### Task 7: Implement default rich-input shortcuts, focus, paste, take-back, and expansion

**Files:**

- Modify: `packages/ai-native/src/browser/components/acp/MentionInput.tsx`
- Modify: `packages/ai-native/src/browser/components/mention-input/types.ts`
- Modify: `packages/ai-native/src/browser/acp/components/AcpTurnEditor.tsx`
- Modify: `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`
- Modify: `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`
- Create: `packages/ai-native/src/browser/chat/acp-chat-input.commands.ts`
- Modify: `packages/ai-native/src/browser/ai-core.contribution.ts`
- Create: `packages/ai-native/__test__/browser/acp-mention-input-behavior.test.tsx`
- Create: `packages/ai-native/__test__/browser/acp-chat-input-handle.test.tsx`
- Modify: `packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx`
- Modify: `packages/ai-native/__test__/browser/acp-mention-input-context-cleanup.test.tsx`
- Modify: `packages/ai-native/src/browser/components/components.module.less`

**Interfaces:**

- Consumes: `ChatInputTurnActions`, `ChatInputHandle`, `fastTrack`, and `takeBackLast`.
- Produces: complete default-input behavior and limited safe handles for the basic input.

- [ ] **Step 1: Add failing keyboard and paste tests**

```ts
import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { MentionInput } from '../../src/browser/components/acp/MentionInput';
import { MentionInputProps } from '../../src/browser/components/mention-input/types';

let container: HTMLDivElement;
let root: Root;

function renderMentionInput(props: Partial<MentionInputProps> = {}): HTMLDivElement {
  act(() => {
    root.render(
      <MentionInput
        footerConfig={{ buttons: [], showModelSelector: false }}
        mentionItems={[]}
        slashCommands={[]}
        {...props}
      />,
    );
  });
  return container.querySelector('[contenteditable="true"]') as HTMLDivElement;
}

function keydown(editor: HTMLElement, init: KeyboardEventInit) {
  act(() => editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init })));
}

async function paste(
  editor: HTMLElement,
  data: { items: Array<{ kind: string; type: string; getAsFile(): File | null }>; text: string },
) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { items: data.items, getData: (type: string) => (type === 'text/plain' ? data.text : '') },
  });
  await act(async () => editor.dispatchEvent(event));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

it('maps Immediate Send without firing during IME composition', () => {
  const onSend = jest.fn();
  const onSendImmediately = jest.fn();
  const editor = renderMentionInput({ onSend, onSendImmediately });
  editor.textContent = 'draft';
  keydown(editor, { key: 'Enter', metaKey: true, shiftKey: true });
  expect(onSendImmediately).toHaveBeenCalledTimes(1);

  editor.textContent = 'normal';
  keydown(editor, { key: 'Enter' });
  expect(onSend).toHaveBeenCalledTimes(1);

  editor.textContent = 'line break';
  keydown(editor, { key: 'Enter', shiftKey: true });
  expect(onSend).toHaveBeenCalledTimes(1);

  editor.textContent = 'composing';
  keydown(editor, { key: 'Enter', isComposing: true });
  expect(onSend).toHaveBeenCalledTimes(1);
});

it('closes transient UI before delegating Escape', () => {
  const onEscape = jest.fn();
  const editor = renderMentionInput({ onEscape });
  keydown(editor, { key: '@' });
  keydown(editor, { key: 'Escape' });
  expect(onEscape).not.toHaveBeenCalled();
  keydown(editor, { key: 'Escape' });
  expect(onEscape).toHaveBeenCalledTimes(1);
});

it('uses empty ArrowUp take-back before history', () => {
  const onEmptyArrowUp = jest.fn(() => true);
  const editor = renderMentionInput({ onEmptyArrowUp });
  keydown(editor, { key: 'ArrowUp' });
  expect(onEmptyArrowUp).toHaveBeenCalledTimes(1);
});

it('falls back to existing history when no Queued Turn is available', () => {
  const onEmptyArrowUp = jest.fn(() => false);
  const editor = renderMentionInput({ onEmptyArrowUp, onSend: jest.fn() });
  editor.textContent = 'history value';
  keydown(editor, { key: 'Enter' });
  keydown(editor, { key: 'ArrowUp' });
  expect(onEmptyArrowUp).toHaveBeenCalledTimes(1);
  expect(editor.textContent).toContain('history value');
});

it('uses empty Enter for the one-shot fast track', () => {
  const onEmptySubmit = jest.fn();
  const editor = renderMentionInput({ onEmptySubmit });
  keydown(editor, { key: 'Enter' });
  expect(onEmptySubmit).toHaveBeenCalledTimes(1);
});

it('routes the expansion shortcut through the shared command callback', () => {
  const onToggleExpanded = jest.fn();
  const editor = renderMentionInput({ onToggleExpanded });
  keydown(editor, { key: 'Escape', shiftKey: true, altKey: true });
  expect(onToggleExpanded).toHaveBeenCalledTimes(1);
});

it('uploads pasted images and still inserts text', async () => {
  const onImageUpload = jest.fn(async () => undefined);
  const editor = renderMentionInput({ onImageUpload });
  const image = new File(['png'], 'queued.png', { type: 'image/png' });
  await paste(editor, {
    items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
    text: 'pasted text',
  });
  expect(onImageUpload).toHaveBeenCalledWith([image]);
  expect(editor.textContent).toContain('pasted text');
});
```

Extend `acp-chat-mention-input-ref.test.tsx` so its mocked `MentionInput` exposes `onImageUpload`, then test partial upload:

```ts
const upload = jest
  .fn()
  .mockResolvedValueOnce('data:image/png;base64,ok')
  .mockRejectedValueOnce(new Error('bad image'));
mockService.getImageUploadProvider.mockReturnValue({ imageUpload: upload });
renderInput();
await act(async () => capturedOnImageUpload!([okFile, badFile]));
expect(container.querySelectorAll('img')).toHaveLength(1);
expect(mockService.error).toHaveBeenCalledWith(expect.stringContaining('1'));
```

Create `KeyboardEvent`/`ClipboardEvent` test helpers and override `isComposing`/`clipboardData` with `Object.defineProperty`.

- [ ] **Step 2: Run behavior tests and confirm missing hooks fail**

```bash
yarn test packages/ai-native/__test__/browser/acp-mention-input-behavior.test.tsx --runInBand
```

Expected: FAIL for Immediate Send, delegated Escape, take-back precedence, and mixed paste.

- [ ] **Step 3: Add lower-level editor intent hooks**

Extend `MentionInputProps`:

```ts
onSendImmediately?: (content: string, config?: { model: string; [key: string]: any }) => void;
onEscape?: () => void;
onEmptyArrowUp?: () => boolean;
onEmptySubmit?: () => void;
onToggleExpanded?: () => void;
onUserInput?: () => void;
```

Order key handling as follows:

1. Ignore submit keys during IME composition.
2. `Shift+Alt/Option+Escape` calls `onToggleExpanded` and does not fall through to regular Escape.
3. Regular Escape closes Mention/Slash state before `onEscape`.
4. Empty ArrowUp calls `onEmptyArrowUp`; history runs only when it returns false.
5. `Cmd/Ctrl+Shift+Enter` calls `onSendImmediately`.
6. Empty Enter calls `onEmptySubmit`.
7. Normal Enter calls `onSend`.
8. Shift+Enter remains a native newline.

Call `onUserInput` from the real contenteditable `input` event after internal Mention bookkeeping. Do not call it when `handleSend()` clears the DOM programmatically, so the just-created fast-track latch survives until the user actually edits again.

Change paste so image upload does not return before text insertion.

- [ ] **Step 4: Map intents to main and queued behavior**

For `variant='main'`:

```ts
onSend={(message, option) => submitDraft(message, option, 'normal')}
onSendImmediately={(message, option) => submitDraft(message, option, 'immediate')}
onEscape={() => loading && (props.turnActions ? props.turnActions.stop() : aiChatService.cancelRequest())}
onEmptySubmit={() => void props.turnActions?.fastTrack()}
onUserInput={() => props.turnActions?.invalidateFastTrack()}
onEmptyArrowUp={() => {
  const turn = props.turnActions?.takeBackLastQueuedTurn();
  if (!turn) return false;
  editorHandle.restoreDraft?.(turn);
  return true;
}}
onToggleExpanded={() => commandService.executeCommand(AI_CHAT_INPUT_TOGGLE_EXPANDED.id)}
```

For `variant='queued'`, normal Enter saves, Immediate Send saves and bypasses, and Escape cancels. Do not expose expansion in compact queued mode.

Button and shortcut expansion must call the same `toggleExpanded` callback. `setExpanded()` changes state without reconstructing the editor, preserving DOM selection and focus.

Create the command:

```ts
export const AI_CHAT_INPUT_TOGGLE_EXPANDED = {
  id: 'ai.chat.input.toggleExpanded',
  label: 'Toggle Chat Input Expansion',
};
```

Register it in `AINativeCoreContribution.registerCommands()`:

```ts
commands.registerCommand(AI_CHAT_INPUT_TOGGLE_EXPANDED, {
  execute: () => this.chatInputRegistry.getActiveInputHandle()?.toggleExpanded?.(),
});
```

Both the expand button and `Shift+Alt/Option+Escape` execute this command through `CommandService`; neither calls `setIsExpanded` directly. Do not register a global keybinding without an input-focus context; the contenteditable key handler owns the shortcut scope.

In the existing Active Session effect, call `mainInputHandleRef.current?.setExpanded?.(false)` after activating the new session. Do not clear the main draft or move focus as part of this collapse.

- [ ] **Step 5: Make image upload partially successful**

```ts
const settled = await Promise.allSettled(files.map((file) => imageUploadProvider.imageUpload(file)));
const uploaded = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
const failedCount = settled.length - uploaded.length;
setImages((current) => [...current, ...uploaded]);
if (failedCount > 0) {
  messageService.error(localize('aiNative.chat.imageUpload.partialFailure', '{0} image(s) failed', failedCount));
}
```

Keep pasted text and successful images after partial failure.

- [ ] **Step 6: Add safe basic-input handle support**

`AcpChatInput` may expose `restoreDraft`, `focus`, and `setExpanded` through `onInputHandleReady`; it must not claim images, Mention, paste, or rich queued editing. Keep legacy `onSend` unchanged when `turnActions` is absent.

In `acp-chat-input-handle.test.tsx`, mock `InteractiveInput` with a forwarded textarea handle and a submit button, then add:

```ts
it('keeps legacy send and exposes only safe handle methods', () => {
  const onSend = jest.fn();
  const onInputHandleReady = jest.fn();
  renderBasicInput({ onSend, onInputHandleReady, agentId: 'agent', command: '/review' });

  act(() => click('[data-testid="mock-interactive-send"]'));
  expect(onSend).toHaveBeenCalledWith('basic draft', [], 'agent', '/review');

  const handle = onInputHandleReady.mock.calls.find(([value]) => value)?.[0] as ChatInputHandle;
  expect(handle.restoreDraft).toEqual(expect.any(Function));
  expect(handle.focus).toEqual(expect.any(Function));
  expect(handle.setExpanded).toEqual(expect.any(Function));
  expect((handle as { richQueuedEditor?: unknown }).richQueuedEditor).toBeUndefined();
});
```

`renderBasicInput` supplies the existing injectable mocks already required by `AcpChatInput`, sets the mocked textarea value to `basic draft`, and leaves `turnActions` undefined.

- [ ] **Step 7: Run all input and queue interaction tests**

```bash
yarn test packages/ai-native/__test__/browser/acp-mention-input-behavior.test.tsx packages/ai-native/__test__/browser/acp-chat-input-handle.test.tsx packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx packages/ai-native/__test__/browser/acp-mention-input-context-cleanup.test.tsx packages/ai-native/__test__/browser/acp-queued-turns.test.tsx packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit Phase 2 input behavior**

```bash
git add packages/ai-native/src/browser/components/acp/MentionInput.tsx packages/ai-native/src/browser/components/mention-input/types.ts packages/ai-native/src/browser/acp/components/AcpTurnEditor.tsx packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx packages/ai-native/src/browser/acp/components/AcpChatInput.tsx packages/ai-native/src/browser/chat/acp-chat-input.commands.ts packages/ai-native/src/browser/ai-core.contribution.ts packages/ai-native/src/browser/components/components.module.less packages/ai-native/__test__/browser/acp-mention-input-behavior.test.tsx packages/ai-native/__test__/browser/acp-chat-input-handle.test.tsx packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx packages/ai-native/__test__/browser/acp-mention-input-context-cleanup.test.tsx
git commit -m "feat(ai-native): align ACP chat input behavior"
```

---

### Task 8: Add deterministic BDD behavior coverage

**Files:**

- Modify: `packages/ai-native/src/browser/acp/acp-bdd-runtime-fixtures.ts`
- Modify: `packages/ai-native/__test__/browser/acp-bdd-runtime-fixtures.test.ts`
- Create: `test/bdd/acp-chat-agentic-queued-turns.scenario.md`
- Modify: `test/bdd/acp-chat-agentic-keyboard-a11y.scenario.md`
- Modify: `test/bdd/acp-chat-agentic-input-send.scenario.md`
- Modify: `test/bdd/README.md`

**Interfaces:**

- Consumes: stable queue ARIA/test contracts and finished behavior.
- Produces: a loopback-only, one-shot start-failure fixture and runtime scenarios.

- [ ] **Step 1: Add failing runtime-fixture tests**

```ts
it('enables queued-turn start failure once on local aiNative runs', () => {
  const search = '?aiNative=true&acpBddQueuedTurnStartFailure=reject-once';
  const shouldFail = createAcpQueuedTurnStartFailureFixture(search, 'localhost');
  expect(shouldFail()).toBe(true);
  expect(shouldFail()).toBe(false);
  expect(createAcpQueuedTurnStartFailureFixture(search, 'example.com')()).toBe(false);
  expect(createAcpQueuedTurnStartFailureFixture('?acpBddQueuedTurnStartFailure=reject-once', 'localhost')()).toBe(
    false,
  );
});
```

- [ ] **Step 2: Run the fixture test and confirm the helper is missing**

```bash
yarn test packages/ai-native/__test__/browser/acp-bdd-runtime-fixtures.test.ts --runInBand
```

Expected: FAIL.

- [ ] **Step 3: Implement and consume the loopback-only fixture**

```ts
export const ACP_BDD_QUEUED_TURN_START_FAILURE_QUERY_PARAM = 'acpBddQueuedTurnStartFailure';
export const ACP_BDD_QUEUED_TURN_START_FAILURE_QUERY_VALUE = 'reject-once';

export function createAcpQueuedTurnStartFailureFixture(
  search: string | undefined = getBrowserLocation()?.search,
  hostname: string | undefined = getBrowserLocation()?.hostname,
): () => boolean {
  const enabled = shouldEnableFixture(
    search,
    hostname,
    ACP_BDD_QUEUED_TURN_START_FAILURE_QUERY_PARAM,
    ACP_BDD_QUEUED_TURN_START_FAILURE_QUERY_VALUE,
  );
  let consumed = false;
  return () => {
    if (!enabled || consumed) return false;
    consumed = true;
    return true;
  };
}
```

Refactor the existing readiness fixture to share `shouldEnableFixture()`. In the production port, consume the one-shot immediately before start and reject before returning a handle.

- [ ] **Step 4: Author the queued-turn runtime scenario**

The new scenario must declare:

```md
**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** separate deterministic `long-stream`, `stream-rich`, `history`, and loopback `acpBddQueuedTurnStartFailure=reject-once` passes. **Workspace mutation:** None. **Automation status:** Runtime BDD first; convert stable deterministic subcases only after a `CONVERT` verdict.
```

Its steps must cover FIFO, editing the second item without reordering, manual stop + Resume Queue, Immediate Send after confirmed cancellation, one-shot start failure returning to the head, Active Session switch clearing the queue, and focus preservation. Do not assert assistant text.

- [ ] **Step 5: Extend existing keyboard/input scenarios and README**

Add normal/newline/Immediate shortcuts, Escape precedence, ArrowUp take-back, and expansion shortcut to keyboard-a11y. Add main/queued focus, mixed paste, Mention/image preservation, and expansion-state preservation to input-send. Register the new scenario in README and document:

```text
http://localhost:8080/?workspaceDir=<absolute>&aiNative=true&acpBddQueuedTurnStartFailure=reject-once
```

- [ ] **Step 6: Run deterministic tests and metadata checks**

```bash
yarn test packages/ai-native/__test__/browser/acp-bdd-runtime-fixtures.test.ts --runInBand
rg -n "Layer:|Required profile:|Fixtures:|Workspace mutation:|Automation status:" test/bdd/acp-chat-agentic-queued-turns.scenario.md
```

Expected: PASS and all required metadata present.

- [ ] **Step 7: Commit BDD coverage**

```bash
git add packages/ai-native/src/browser/acp/acp-bdd-runtime-fixtures.ts packages/ai-native/__test__/browser/acp-bdd-runtime-fixtures.test.ts packages/ai-native/src/browser/chat/chat.view.acp.tsx test/bdd/acp-chat-agentic-queued-turns.scenario.md test/bdd/acp-chat-agentic-keyboard-a11y.scenario.md test/bdd/acp-chat-agentic-input-send.scenario.md test/bdd/README.md
git commit -m "test(ai-native): add queued turn behavior scenarios"
```

---

### Task 9: Run complete verification and harden stable runtime cases

**Files:**

- Verify all files changed in Tasks 1–8.
- Potential generated file: `tools/playwright/src/tests/acp-chat-agentic-queued-turns.test.ts` only after a `CONVERT` verdict.

**Interfaces:**

- Consumes: completed implementation and BDD scenarios.
- Produces: verified focused/unit/type behavior, runtime evidence, and optional Playwright hardening.

- [ ] **Step 1: Run the complete focused Jest set**

```bash
yarn test \
  packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts \
  packages/ai-native/__test__/browser/chat/chat-input-registry.test.ts \
  packages/ai-native/__test__/browser/acp-queued-turns.test.tsx \
  packages/ai-native/__test__/browser/acp-mention-input-behavior.test.tsx \
  packages/ai-native/__test__/browser/acp-chat-input-handle.test.tsx \
  packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx \
  packages/ai-native/__test__/browser/acp-mention-input-context-cleanup.test.tsx \
  packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx \
  packages/ai-native/__test__/browser/acp-bdd-runtime-fixtures.test.ts \
  --runInBand
```

Expected: all suites PASS with no feature-related open-handle or React ref warnings.

- [ ] **Step 2: Run the affected TypeScript build and whitespace validation**

```bash
yarn tsc --build configs/ts/references/tsconfig.ai-native.json --pretty false
git diff --check
```

Expected: exit `0`.

- [ ] **Step 3: Run the new runtime scenario with the bdd-run skill**

Read `test/bdd/README.md` and `test/bdd/bdd-runtime-preflight.scenario.md`, then run:

```text
/bdd-run test/bdd/acp-chat-agentic-queued-turns.scenario.md
```

Run each fixture as a separate pass and save only redacted evidence. Expected: explicit scenario and hardening verdicts for FIFO, pause/resume, Immediate Send, editing, start failure, and session isolation.

- [ ] **Step 4: Re-run affected phase-two behavior scenarios**

```text
/bdd-run test/bdd/acp-chat-agentic-keyboard-a11y.scenario.md
/bdd-run test/bdd/acp-chat-agentic-input-send.scenario.md
```

Expected: stable checks PASS; fixture or clipboard limitations are `BLOCKED`/`DEFER`, not replaced by shallow assertions.

- [ ] **Step 5: Generate Playwright only after a CONVERT verdict**

```text
/bdd-run --codegen test/bdd/acp-chat-agentic-queued-turns.scenario.md
```

Expected path:

```text
tools/playwright/src/tests/acp-chat-agentic-queued-turns.test.ts
```

The file starts with:

```ts
// Source: test/bdd/acp-chat-agentic-queued-turns.scenario.md
```

Use role/label locators and deterministic fixture assertions. If the verdict is `DEFER`, do not generate a file.

- [ ] **Step 6: Inspect final scope and removed shallow logic**

```bash
git status --short
git diff --stat
git diff -- packages/ai-native/src/browser/chat/chat.view.acp.tsx
rg -n "queuedMessagesStateRef|sendQueuedMessageRef|suppressNextCancelQueuePauseRef|requestAcpQueuedMessageSendNow|completeAcpQueuedTurn" packages/ai-native/src/browser || true
```

Expected: no old queue orchestration symbols remain and unrelated files are untouched.

- [ ] **Step 7: Commit only real hardening changes**

If Playwright or follow-up fixes were created:

```bash
git add tools/playwright/src/tests/acp-chat-agentic-queued-turns.test.ts packages/ai-native test/bdd packages/i18n
git commit -m "test(ai-native): harden ACP queued turn behavior"
```

Do not create an empty verification commit.

---

## Completion Checklist

- Phase 1 module, external port, inline editing, Immediate Send, Resume Queue, and queue UI are complete.
- Phase 2 shortcuts, focus, paste, ArrowUp, fast track, and expansion are complete for the default rich input.
- Active Session switch/new/clear removes Queued Turns and rejects stale completion effects.
- Manual stop and Agent error pause remaining work; pre-start failure returns the target to the head.
- Immediate Send waits for cancellation confirmation and cannot double-send.
- Mode, Model, and configuration are read only at delivery time.
- Basic and third-party inputs remain compatible.
- Old shallow queue helpers and React orchestration refs are removed.
- Focused Jest, AI Native TypeScript reference, and `git diff --check` pass.
- Runtime BDD returns explicit scenario/hardening verdicts; Playwright generation follows only `CONVERT`.
