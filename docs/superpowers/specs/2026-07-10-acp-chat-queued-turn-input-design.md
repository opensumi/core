# ACP Chat Queued Turn and Input Behavior Design

## Summary

OpenSumi ACP Chat will deepen its Queued Turn handling into one non-React module that owns queue state and external ACP Agent delivery orchestration. The work aligns the default rich Chat Input with the useful parts of Zed's interaction model while retaining OpenSumi's registered-input architecture and external-agent constraints.

The delivery is limited to two phases:

1. Queued Turn processing, Immediate Send, inline queue editing, and queue controls.
2. Keyboard shortcuts, focus, paste, and input expansion behavior.

Steer is not included. OpenSumi connects to external ACP Agents, and precise Steer behavior requires an Agent-side ACP extension that is outside this work.

## Motivation

The current queue helper is shallow. It exposes several pure state mutation functions, while the behavior most likely to fail remains distributed through `chat.view.acp.tsx`:

- React state mirrored into refs;
- loading state mirrored into refs;
- cancel-event suppression;
- a mutable queued-send callback;
- reset behavior during Active Session changes;
- reply-completion hooks in multiple paths;
- ordering between cancel, completion, and Immediate Send.

Deleting the helper would only move small object mutations back into the view. It would not remove any of the difficult behavior. A deep Queued Turn module instead concentrates these rules behind one interface, giving callers leverage and improving locality for state-machine changes and tests.

## Terminology

This design uses the ACP Chat terms in `CONTEXT.md`:

- **Active Session**: the ACP chat session currently shown and eligible to receive turns.
- **Queued Turn**: a user-authored turn waiting while the Active Session generates.
- **Immediate Send**: an explicit action that cancels the current generation when necessary and sends a selected Queued Turn or current draft before the remaining FIFO queue.

Avoid `Queued Message`, `Pending Prompt`, and `Steer` for these concepts.

## Goals

- Make Queued Turn behavior session-local and deterministic.
- Preserve FIFO during normal automatic processing.
- Pause safely after manual stop, Agent error, cancellation failure, or delivery start failure.
- Make Immediate Send wait for confirmed cancellation and prevent double dispatch.
- Support inline editing without changing a Queued Turn's FIFO position.
- Support text, serialized Mention content, images, commands, and paste in the default rich input.
- Align default keyboard, focus, paste, and expansion behavior with the useful parts of Zed.
- Keep Mode, Model, and Agent configuration as Active Session state evaluated at delivery time.
- Preserve the Chat Input registry and allow basic or third-party inputs to adopt capabilities progressively.
- Make the deep module interface the primary test surface.

## Non-goals

- Native or external-Agent Steer support.
- Persistence of Queued Turns across Active Session changes, reloads, or application restarts.
- A priority queue or configurable queue policy.
- Versioned arbitrary input payloads or optimistic edit revisions.
- Multiple simultaneous inline queue editors.
- Copying Zed's GPUI focus implementation, queue-to-main paste migration, or exact expanded layout.
- Replacing the Chat Input registry.
- Requiring every third-party input to implement rich editing in this delivery.

## Chosen Architecture

### AcpQueuedTurnModule

`AcpQueuedTurnModule` is a non-React deep module. It owns:

- the Active Session identity and session epoch;
- the FIFO Queued Turn collection;
- the current processing mode;
- the active delivery handle;
- the Immediate Send reservation;
- the single editing-turn lease;
- automatic scheduling;
- failure normalization and pause reasons;
- stale completion and duplicate-action protection.

The external interface uses explicit task-oriented methods. Internally, the implementation may serialize them through a private command/state machine. The private command union is not exposed merely to reduce the apparent method count.

An illustrative interface is:

```ts
type ActiveSessionId = string;
type QueuedTurnId = string;

interface AcpTurnDraft {
  message: string;
  images?: readonly string[];
  agentId?: string;
  command?: string;
}

interface QueuedTurn extends AcpTurnDraft {
  id: QueuedTurnId;
}

type TurnActionResult =
  | {
      accepted: true;
      outcome: 'started' | 'queued' | 'updated' | 'removed' | 'resumed' | 'stopped';
    }
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

type QueuePauseReason = 'manual-stop' | 'agent-error' | 'start-failed' | 'cancel-failed';

interface AcpQueuedTurnSnapshot {
  activeSessionId?: ActiveSessionId;
  phase: 'idle' | 'generating' | 'paused' | 'cancelling-for-immediate';
  entries: readonly QueuedTurn[];
  editingTurnId?: QueuedTurnId;
  pauseReason?: QueuePauseReason;
  canResume: boolean;
  canFastTrack: boolean;
}

interface AcpQueuedTurnModule {
  readonly snapshot: AcpQueuedTurnSnapshot;
  readonly onDidChange: Event<AcpQueuedTurnSnapshot>;

  activate(sessionId: ActiveSessionId | undefined): void;
  submit(draft: AcpTurnDraft, intent?: 'normal' | 'immediate'): Promise<TurnActionResult>;
  sendImmediately(id: QueuedTurnId): Promise<TurnActionResult>;

  beginEdit(id: QueuedTurnId): TurnActionResult;
  commitEdit(id: QueuedTurnId, draft: AcpTurnDraft, intent?: 'save' | 'immediate'): Promise<TurnActionResult>;
  cancelEdit(id: QueuedTurnId): TurnActionResult;

  takeBackLast(): QueuedTurn | undefined;
  remove(id: QueuedTurnId): TurnActionResult;
  clear(): void;
  resume(): Promise<TurnActionResult>;
  stop(): Promise<TurnActionResult>;
  dispose(): void;
}
```

Implementation errors that violate module invariants may reject or throw, but expected user and external-Agent outcomes use `TurnActionResult`. Callers do not inspect internal mutable state to determine recovery.

`AcpTurnDraft` deliberately omits Mode, Model, configuration, and the current unused queued `option`. The production delivery adapter reads session-level values immediately before starting a delivery.

Mention content continues to use the stable serialized message representation already produced by the rich input. These phases do not introduce a second structured Mention schema.

### AcpTurnPort

The external ACP Agent is a true external dependency. It sits behind a small port with production and test adapters:

```ts
interface AcpTurnPort {
  getStatus(sessionId: ActiveSessionId): 'idle' | 'generating';
  start(sessionId: ActiveSessionId, draft: AcpTurnDraft): Promise<AcpTurnHandle>;
  cancelCurrent(sessionId: ActiveSessionId): Promise<void>;
}

interface AcpTurnHandle {
  id: string;
  completion: Promise<'completed' | 'manual-stop' | 'agent-error'>;
}
```

`start()` returning a handle is the acknowledgement that delivery started. `cancelCurrent()` resolves only when the external Agent has confirmed that the current generation stopped. These semantics are required to decide whether a turn is safe to put back into the queue.

The production adapter wraps the current ACP session creation, request start, cancellation, and completion paths. The test adapter uses controllable promises so tests can reproduce races without reaching through the module interface.

### Chat Input seam

The Chat Input registry remains the selection mechanism. `IChatInputProps` gains optional behavior hooks so existing registrations remain source compatible:

```ts
interface ChatInputTurnActions {
  submit(draft: AcpTurnDraft, intent: 'normal' | 'immediate'): Promise<TurnActionResult>;
  stop(): Promise<TurnActionResult>;
  takeBackLastQueuedTurn(): QueuedTurn | undefined;
}

interface ChatInputHandle {
  restoreDraft?(draft: AcpTurnDraft): void;
  focus?(): void;
  setExpanded?(expanded: boolean): void;
  closeTransientUi?(): boolean;
}
```

The default rich Mention input implements the full handle. The basic input and third-party inputs may retain the existing `onSend` behavior and progressively adopt the optional hooks. Unsupported capabilities are hidden rather than emulated incorrectly.

The queue implementation is never copied into registered input implementations. Inputs submit user intent; `AcpQueuedTurnModule` decides whether to start, queue, pause, cancel, or advance.

### AcpTurnEditor

The reusable draft-editing behavior is extracted behind an `AcpTurnEditor` module:

- the main rich Chat Input uses the full layout;
- an inline Queued Turn editor uses a compact layout;
- both use the same Mention serialization, image handling, paste behavior, and draft shape;
- session-level Mode, Model, and configuration controls remain outside the Queued Turn editor.

The default rich input receives complete phase-one and phase-two behavior. Inputs that do not support rich draft restoration expose only their supported actions.

### View responsibility

`chat.view.acp.tsx` becomes a composition module. It:

- activates the Queued Turn module for the Active Session;
- subscribes to the read-only snapshot;
- renders messages, queue state, and the selected Chat Input;
- forwards user intents;
- shows normalized errors.

It no longer owns queue refs, loading mirrors used only for queue decisions, cancellation suppression flags, queued-send callback refs, or reply-completion queue dispatch.

## State Model

The implementation follows the useful part of Zed's queue model with three internal processing modes:

- `AutoProcess`: normal FIFO automatic processing.
- `Paused`: retain the queue but do not automatically advance.
- `AbsorbingCancel`: Immediate Send initiated cancellation; absorb the resulting stop event before returning to automatic processing.

The public snapshot derives a simpler phase from this processing mode and the active delivery.

### Invariants

- A Queued Turn belongs only to the current Active Session.
- Active Session changes atomically clear entries, edit state, the Immediate Send reservation, and the fast-track latch.
- Queued Turn IDs are unique within one module lifetime.
- Normal automatic delivery is strict FIFO.
- At most one delivery and one Immediate Send reservation exist at a time.
- At most one Queued Turn may be edited at a time.
- Editing replaces content in place and does not change ID or FIFO position.
- Only the turn at the head can block automatic processing because it is being edited.
- Mode, Model, and configuration are never restored from a Queued Turn.
- Every asynchronous action is checked against the session epoch and delivery ID before changing state.

## Normal Submission and FIFO

When the Active Session is idle, normal submission attempts to start immediately.

When it is generating, normal submission appends a Queued Turn to the tail, clears the main draft, keeps focus in the main input, enables the one-shot fast-track latch, and moves processing to `AutoProcess` if it was paused.

On normal completion:

1. If the queue is empty, the module becomes idle.
2. If the head is being edited, the module remains idle until editing ends.
3. Otherwise, the head is removed into an internal delivery reservation and started.
4. If start fails, it is returned to the head and processing becomes paused.

If a user submits a new normal draft while a retained queue is paused and no generation remains, the new draft starts first. Its normal completion resumes the existing queue in its original FIFO order. This matches Zed and current OpenSumi behavior and treats the new draft as explicit corrective engagement.

`Resume Queue` starts the existing head directly when the queue is paused and the head is not being edited.

## Manual Stop and Agent Error

Manual stop immediately marks queue processing as paused, then requests cancellation through the port. Remaining Queued Turns stay in place. The active turn is not requeued after it has started.

An Agent error after delivery started also pauses remaining Queued Turns without requeuing the failed active turn.

Editing, deleting, clearing, and Immediate Send remain available while paused.

## Immediate Send

Immediate Send accepts either the current main draft or any Queued Turn.

When a generation is active:

1. The selected target moves into an internal reservation. A queued target is removed without disturbing the order of remaining entries.
2. Processing enters `AbsorbingCancel`.
3. The module requests cancellation and waits for confirmed completion.
4. The stop event caused by this cancellation is absorbed and cannot trigger normal FIFO advancement.
5. The reserved target starts.
6. After normal completion, the remaining queue continues in its original FIFO order.

When no generation is active, Immediate Send starts the selected target without cancellation.

If cancellation fails or delivery cannot start, the target returns to the head and the queue pauses. The module never starts an Immediate Send target merely because a cancellation request was issued.

### One-shot fast track

Immediately after the main input queues a turn, pressing `Enter` again while the main input is empty performs Immediate Send on the queue head. The latch is one-shot and is cleared by:

- consuming the fast track;
- changing the main draft;
- changing Active Session;
- clearing the queue;
- another explicit queue action that changes the relevant head.

## Inline Queue Editing

Only one Queued Turn can be edited at a time.

- `beginEdit` records `editingTurnId`; draft content stays in a UI-local editable copy.
- `Enter` commits the edited draft in place.
- `Shift+Enter` inserts a newline.
- `Cmd/Ctrl+Shift+Enter` commits and performs Immediate Send.
- `Escape` discards the editable copy and retains the stored Queued Turn.
- Delete removes the turn.

Clicking Edit on another turn while unsaved edits exist keeps the current editor open and focuses it. OpenSumi does not add a confirmation modal, auto-save the edits, or silently discard them.

If the current generation completes while the head is being edited, automatic delivery waits. Saving sends the updated head, cancelling edit permits the original head to send, and deleting the head permits the next eligible turn to send. Editing a later turn does not block earlier FIFO entries.

The queue cannot be collapsed while an inline editor contains unsaved changes.

## Queue Presentation

- The first Queued Turn in an Active Session automatically expands the queue.
- After the user manually collapses it, that preference remains sticky for the Active Session.
- The header shows the Queued Turn count and a paused indicator when applicable.
- `Resume Queue` is visible while paused.
- `Clear All` remains available.
- Each entry exposes Edit, Delete, and Immediate Send.
- Queue expansion, collapse, enqueue, and automatic delivery do not steal main-input focus.

## Main Input Keyboard Behavior

- `Enter`: send immediately when idle; enqueue when generating.
- `Shift+Enter`: insert a newline.
- `Cmd/Ctrl+Shift+Enter`: Immediate Send the current draft.
- `Escape`: close Mention, Slash, or other transient input UI first; if none is open, stop generation and pause the queue.
- `Shift+Alt/Option+Escape`: toggle input expansion through one shared command used by both shortcut and button.
- Empty-input `ArrowUp`: take back the most recently added Queued Turn; if the queue is empty, use existing input-history navigation.
- Empty `Enter` immediately after queueing: consume the one-shot fast track described above.

IME composition must prevent submission shortcuts from firing while text composition is active.

Taking back a Queued Turn removes it from the queue, restores its supported draft fields in the main input, places the cursor at the end, and focuses the input. Unsupported restoration capabilities remain hidden for that registered input.

The module owns removal from the tail and updates the fast-track latch atomically. The view must not obtain the last entry from a snapshot and remove it in a separate operation.

## Focus Behavior

- Queueing, automatic delivery, queue expansion, and queue collapse preserve main-input focus.
- Beginning inline edit focuses the queue editor.
- Save, cancel, delete, take-back, or Immediate Send returns focus to the main input.
- Input expansion preserves draft content, serialized Mention state, images, selection/cursor, and focus.
- Active Session changes exit input expansion and clear queue-edit focus state.
- Automatic queue scheduling never moves focus to a newly sent Queued Turn.

## Paste Behavior

The main rich input and inline queue editor share one paste implementation.

- Plain and rich text stay in the editor where the paste occurred.
- Images are uploaded and attached to that same draft.
- Serialized Mention content follows the same normalization used by the main input.
- Mixed text and image paste retains successful parts.
- An image upload failure reports only the failed item and preserves text plus successfully uploaded images.

OpenSumi deliberately does not copy Zed's behavior of moving queue-editor paste or attempted edits back into the main input.

## Input Expansion

Input expansion remains OpenSumi's existing layout treatment. This design does not copy Zed's GPUI layout.

The expansion button and `Shift+Alt/Option+Escape` execute one command. The command operates through the active input handle and does not reconstruct the input. Draft content, Mention state, images, cursor, selection, and focus survive the transition.

## Error Handling and Recovery

The central distinction is whether delivery started:

| Failure | Queued Turn outcome | Processing outcome |
| --- | --- | --- |
| Delivery start failed before a handle was returned | Target returns to the head | Paused |
| Agent failed after delivery started | Active turn is not requeued; remaining entries stay | Paused |
| User manually stopped | Remaining entries stay | Paused |
| Immediate Send cancellation failed | Target returns to the head; external generation keeps its true status | Paused |
| Cancellation succeeded but Immediate Send start failed | Target returns to the head | Paused |
| Some pasted images failed to upload | Text and successful images remain in the draft | Editing continues |
| Old Active Session completion arrived | Completion is ignored | Current session unchanged |
| Registered input lacks a capability | Unsupported action is hidden | Supported sending remains available |

The module does not automatically retry external delivery. Automatic retry could duplicate external Agent operations. Recovery is explicit through Resume Queue, editing, deletion, a new normal submission, or Immediate Send.

The queue header shows the normalized pause reason and uses the existing Chat error presentation. No blocking modal is added.

## Compatibility and Migration

- The default `AcpChatMentionInput` remains the highest-priority input and receives full behavior.
- `AcpChatInput` retains its existing send behavior and gains only the hooks it can support safely.
- New `IChatInputProps` behavior hooks are optional.
- Existing third-party registrations continue to compile and run without implementing rich restoration.
- Capability checks control inline editing, draft restoration, images, Mention content, paste, focus, and expansion.
- The current queued `option` field is removed because it stores Model information that is not used at delivery time and conflicts with the session-level configuration rule.
- No queue implementation is embedded in registered inputs.

## Zed Alignment

Reference implementations:

- `crates/agent_ui/src/conversation_view/message_queue.rs`
- `crates/agent_ui/src/conversation_view/thread_view.rs`
- `crates/agent_ui/src/conversation_view.rs`

OpenSumi adopts:

- one queue state machine;
- automatic, paused, and cancellation-absorbing processing;
- pausing after user stop;
- re-engagement after pause;
- one-shot empty-input fast track;
- complete send, stop, edit, and expansion keyboard actions;
- protection against sending a queue head while it is being edited.

OpenSumi does not adopt:

- native-Agent Steer;
- GPUI-specific focus code;
- migration of queue edits or paste into the main editor;
- Zed's exact expanded layout;
- versioned arbitrary queue payloads or configurable queue policies.

## Main Implementation Areas

- `packages/ai-native/src/browser/chat/acp-chat-queued-messages.ts`
  - replace the shallow pure-operation surface with the deep Queued Turn implementation, or supersede it with a domain-named module and migrate callers.
- `packages/ai-native/src/browser/chat/chat.view.acp.tsx`
  - remove queue orchestration refs and subscribe to the deep module snapshot.
- `packages/ai-native/src/browser/chat/AcpQueuedMessages.tsx`
  - render paused status, Resume Queue, inline editing, and capability-gated actions.
- `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`
  - adopt turn-action hooks and the complete input handle.
- `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`
  - preserve the basic-input path and adopt supported hooks.
- `packages/ai-native/src/browser/components/acp/MentionInput.tsx`
  - share keyboard, paste, focus, and editor behavior through the reusable draft editor.
- `packages/ai-native/src/browser/chat/chat.input.registry.ts`
  - add optional behavior hooks and capability declaration without breaking existing registrations.
- `packages/ai-native/src/browser/ai-core.contribution.ts`
  - keep current priority and selection behavior while wiring the default adapters.

## Test Strategy

### Deep module tests

Replace the shallow pure-function tests in `acp-chat-queued-messages.test.ts` with tests through the new module interface and controllable `AcpTurnPort` test adapter.

Cover:

- multiple submissions during generation and strict FIFO;
- normal automatic advancement;
- manual stop and Agent-error pause;
- new corrective draft while paused, followed by the original FIFO;
- Resume Queue;
- start failure returning the target to the head;
- Immediate Send waiting for confirmed cancellation;
- absorbing the cancellation stop event without double send;
- cancellation failure and Immediate Send start failure;
- head editing blocking automatic advancement;
- non-head editing not blocking earlier entries;
- save, cancel, and delete releasing the head;
- Active Session switching, clearing, and stale completion rejection;
- repeated clicks, duplicate completion events, and stale delivery IDs;
- current Mode, Model, and configuration being read by the production adapter at delivery time.

Tests assert observable snapshots, port calls, and returned results. They do not reach into entries, reservations, epochs, or other implementation state.

### Input and UI tests

The default rich input receives jsdom coverage for:

- main and inline-editor keyboard mappings;
- IME composition protection;
- Escape transient-UI precedence;
- empty-input ArrowUp and one-shot fast track;
- focus return rules;
- text, Mention, image, and mixed paste;
- expansion preserving content, images, cursor, and focus;
- single-editor enforcement and in-place FIFO editing;
- capability hiding for basic and third-party inputs.

The basic input receives regression coverage for existing sending. The Chat Input registry receives compatibility coverage proving that registrations without new optional hooks remain valid.

### Runtime behavior scenarios

Add `test/bdd/acp-chat-agentic-queued-turns.scenario.md` with:

- `Layer`: `runtime-ui`
- `Required profile`: `interactive`
- `Fixtures`: deterministic `long-stream`, `stream-rich`, `history`, and a new `start-failure` pass
- `Workspace mutation`: `none`
- `Automation status`: `proposed`

The scenario covers:

1. Queueing two turns during generation, visible count, FIFO, and automatic advancement.
2. Manual stop retaining the queue, visible paused state, and Resume Queue recovery.
3. Immediate Send waiting for cancellation, sending the selected turn, and retaining the remaining order.
4. Editing the head blocking advancement until save or cancel.
5. A new deterministic `start-failure` fixture rejecting delivery before a handle is returned, with the target returning to the head without duplicate send.
6. A deterministic `history` fixture switching Active Sessions, clearing the queue, and rejecting stale completion effects.

Run fixture-dependent subcases as separate passes and record the fixture used for each pass. Do not claim a combined pass unless every declared fixture assertion ran.

Extend existing behavior scenarios rather than creating duplicate phase-two files:

- `acp-chat-agentic-keyboard-a11y.scenario.md`: submission, newline, Immediate Send, Escape, ArrowUp, and expansion shortcuts.
- `acp-chat-agentic-input-send.scenario.md`: focus, paste, images, Mention content, and expansion-state preservation.

Use stable user-facing locators and deterministic fixtures. Do not assert assistant text, token timing, or model-selected content. Stable deterministic cases may receive a hardening verdict of `CONVERT` and become existing-infrastructure Playwright tests. Live-Agent output and unstable clipboard cases remain `DEFER` until deterministic.

## Verification

Verification proceeds from the narrowest deterministic surface outward:

1. Focused Jest tests for the deep module and adapters.
2. jsdom interaction tests for the default rich input and queue rendering.
3. The affected TypeScript reference build.
4. `git diff --check`.
5. `/bdd-run` for the queued-turn runtime scenario and affected keyboard/input scenarios.
6. Playwright or a running IDE for real focus, clipboard, expansion, and cancellation timing.

If a runtime fixture or stable selector is unavailable, report the scenario as blocked or deferred rather than replacing real UI validation with shallow DOM assertions.

## Delivery Phases

### Phase 1: Queued Turn processing and editing

- Introduce `AcpQueuedTurnModule` and `AcpTurnPort` adapters.
- Route ACP Chat sends, completion, stop, and Immediate Send through the module.
- Add paused status, Resume Queue, Immediate Send, deletion, clearing, and inline editing.
- Preserve Active Session isolation and session-time configuration.
- Replace shallow queue tests with interface-level tests.

### Phase 2: Chat Input behavior

- Add optional Chat Input behavior hooks and capability checks.
- Share draft editing between the main rich input and inline queue editor.
- Add keyboard, focus, paste, ArrowUp, fast-track, and expansion behavior.
- Add input interaction tests and runtime behavior scenarios.

The phases may share preparatory refactoring, but Phase 1 must not copy queue logic into input implementations, and Phase 2 must not reopen the queue state-machine design.

## Acceptance Criteria

- Queued Turns are isolated to the Active Session and cleared on session change, new session, or clear.
- Normal completion advances eligible turns in strict FIFO order.
- Manual stop, Agent error, cancellation failure, and delivery start failure retain recoverable work and pause processing.
- Immediate Send waits for cancellation confirmation and cannot double-send.
- A failed pre-start delivery returns the target to the queue head.
- Inline editing preserves ID and FIFO position and blocks only when the edited turn reaches the head.
- The default rich input supports text, Mention content, images, paste, keyboard, focus, and expansion behavior.
- Mode, Model, and configuration are read from the Active Session at actual delivery time.
- Basic and third-party inputs remain compatible through optional hooks and capability gating.
- The large ACP view no longer owns queue delivery ordering or cancellation suppression.
- Interface-level, input interaction, and runtime behavior tests cover the approved scenarios.
- No Steer or Agent-side ACP protocol extension is introduced.
