# Scenario: ACP Chat Agentic Queued Turns - FIFO, Recovery, and Focus

**Trigger:** `packages/ai-native/src/browser/chat/acp-chat-queued-turns.ts`, `packages/ai-native/src/browser/chat/AcpQueuedTurns.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/acp/components/AcpQueuedTurnEditor.tsx`, or `packages/ai-native/src/browser/acp/acp-bdd-runtime-fixtures.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** separate deterministic `long-stream`, `stream-rich`, bounded slow `history` (`--fixture=history --delay-ms=2000`), and loopback `acpBddQueuedTurnStartFailure=reject-once` passes. **Workspace mutation:** None. **Automation status:** Runtime BDD first; convert stable deterministic subcases only after a `CONVERT` verdict.

## Given

- Agentic AI Chat is visible with the main input focused.
- The active input contribution exposes the queued-turn editor and stable `Queued turns`, `Toggle queued turns`, `Edit queued turn`, `Delete queued turn`, `Send queued turn immediately`, `Clear queued turns`, and `Resume queued turns` contracts.
- Each fixture class runs as a separate pass. Do not combine results from omitted fixture passes into one PASS.
- Assertions may use deterministic user-draft labels, queue previews, row counts, focus, loading controls, and metadata-only state. They must not assert assistant text.

## When - FIFO and Editing

1. In a deterministic pass with an active request, submit three labeled drafts in order: `fifo-1`, `fifo-2`, and `fifo-3`.
2. Record the queue summary count, the ordered `acp-queued-turn` rows, their one-based indexes, and `acp-queued-turn-preview` values.
3. Edit the second queued row, confirm the queued editor receives focus, replace only its label with `fifo-2-edited`, and confirm with the queued editor's `Send` control or Enter.
4. Record the ordered queue rows again and confirm the first and third rows did not move.
5. Let the deterministic active turn and subsequent queued turns reach terminal completion one at a time, recording the next user-row label and remaining queue order after each advancement.

## Then - FIFO and Editing

- Queue rows remain `fifo-1`, `fifo-2-edited`, `fifo-3`; editing the second item preserves its visible index and FIFO position.
- Automatic advancement starts only the queue head and removes exactly that head from the visible queue.
- Each deterministic user draft is delivered once in FIFO order, with no duplicate user row or duplicate queue row.
- Confirming the queued edit with `Send` or Enter returns focus to the main input after the action is accepted; automatic advancement does not steal focus.

## When - Manual Stop and Resume Queue

1. Run the mock ACP agent with `--fixture=long-stream`, start one active turn, and enqueue `resume-head` followed by `resume-tail`.
2. Use the visible Stop control and record the queued-turn status before cancellation settles and again after the active loading control disappears.
3. Confirm the queue is `Paused` with reason `Stopped`, both queued rows remain in the original order, and no queued user row has started.
4. Activate `Resume Queue` once.

## Then - Manual Stop and Resume Queue

- Manual Stop does not auto-advance the queue before or after cancellation settles.
- `Resume Queue` starts `resume-head` exactly once and leaves `resume-tail` as the next queue head.
- The paused status and resume action clear only after the resumed head is accepted.

## When - Immediate Send After Confirmed Cancellation

1. With `--fixture=long-stream`, start one active turn and enqueue `immediate-first`, `immediate-selected`, and `immediate-last`.
2. Activate `Immediate Send` on `immediate-selected`.
3. While cancellation is settling, record that retained Immediate Send actions are disabled, the old active loading state still owns the request, and no user row for `immediate-selected` has started.
4. Wait for the matching active turn to reach confirmed cancellation, then record the next user row, loading state, focus, and remaining queue order.

## Then - Immediate Send After Confirmed Cancellation

- Immediate Send cancels only the matching Active Session request and does not start the selected turn before cancellation confirmation.
- After confirmation, `immediate-selected` starts exactly once; the remaining queue order is `immediate-first`, `immediate-last`.
- Main-input focus is restored only after Immediate Send settles, not while cancellation is pending.

## When - One-Shot Start Failure

1. Open the loopback runtime with `aiNative=true&acpBddQueuedTurnStartFailure=reject-once` and a deterministic `stream-rich` agent.
2. Submit `start-failure-head` from a fresh draft and record the visible queue rows, user-row count, loading state, and Stop availability after the injected start failure settles.
3. Record the paused status, pause reason, queue index, preview, and `Resume Queue` action.
4. Activate `Resume Queue` and wait for the same queued draft to start on the second attempt.

## Then - One-Shot Start Failure

- The first attempted start creates no user row or active loading/Stop state, and the visible queue restores `start-failure-head` at the head.
- `start-failure-head` returns to queue index 1 with status `Paused` and reason `Could not start`.
- The query fixture is consumed once: Resume retries the same head successfully without a reload, duplicate row, or reordered queue entry.

## When - Active Session Switch and Focus

1. Run `--fixture=history --delay-ms=2000` with two deterministic sessions, select Session A, and submit one turn.
2. Wait until Session A visibly owns an active loading state and its Stop control is enabled. Only then enqueue two labeled drafts.
3. Begin editing one queued draft, confirm focus is inside the queued editor, and immediately before switching confirm the loading state and enabled Stop control are still visible. If either disappeared, restart this pass rather than counting it toward PASS.
4. Switch the Active Session to Session B through the visible Task/History surface.
5. Record the queue region, main draft, expanded state, active element, and metadata-only active session id.
6. Switch back to Session A and record the queue region again.

## Then - Active Session Switch and Focus

- Session B does not display Session A's queued rows, edit state, or active loading state after the Active Session switch.
- Stale completion from Session A does not start an old queued turn and does not move focus into Session B.
- The main draft is not cleared by the session switch; the main input collapses without an unexpected focus move.
- Switching back does not resurrect the cleared queue.

## Pass / Fail Judgment

- **PASS** - all separate deterministic passes preserve FIFO and focus, gate Immediate Send on confirmed cancellation, recover manual stop and one-shot start failure, and clear queue state on Active Session change.
- **BLOCKED** - the run lacks the interactive profile, a declared fixture pass, stable queue/focus selectors, two history sessions, or the loopback query fixture URL.
- **FAIL** - queue order changes, an edited second item moves, Stop auto-advances, Immediate Send starts before cancellation confirmation, a failed start loses or duplicates the head, session switching retains stale queue state, or focus moves to the wrong editor/session.
