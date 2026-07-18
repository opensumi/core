# Scenario: ACP Chat Interaction Contract - Queue Failures, Input Semantics, Paste, and Tool Disclosure

**Trigger:** `packages/ai-native/src/browser/chat/acp-chat-queued-turns.ts`, `packages/ai-native/src/browser/acp/components/AcpTurnEditor.tsx`, `packages/ai-native/src/browser/components/acp/MentionInput.tsx`, or `packages/ai-native/src/browser/components/ChatToolRender.tsx`

**Layer:** `node-contract` **Required profile:** `interactive` **Fixtures:** A deterministic `AcpTurnPort` with controllable start, completion, cancellation, and failure promises; rich main and queued-editor jsdom harnesses with IME and clipboard events; deterministic image upload success/failure promises; and a tool-call disclosure containing focusable descendants. **Workspace mutation:** None. **Automation status:** Automated by focused Jest suites in `packages/ai-native/__test__/browser/chat/acp-chat-queued-turns.test.ts`, `packages/ai-native/__test__/browser/acp-mention-input-behavior.test.tsx`, `packages/ai-native/__test__/browser/acp-chat-mention-input-ref.test.tsx`, `packages/ai-native/__test__/browser/acp-queued-turn-editor.test.tsx`, and `packages/ai-native/__test__/browser/chat-tool-render.test.tsx`.

**Acceptance coverage:** Contract completion for `C-03`, `C-06`, `C-08`, `C-10` through `C-14`, `D-01`, and `D-02` from `test/bdd/feat-0710-acceptance.md`.

## Given

- One `AcpQueuedTurnModule` owns one Active Session, strict FIFO entries, a single edit lease, an optional Immediate Send reservation, pause state, and a one-shot fast-track latch.
- The test port can delay or reject cancellation, reject delivery before returning a handle, and reject or resolve an acknowledged delivery outcome.
- The default rich input and compact queued editor share draft serialization for text, Mention content, images, commands, paste, selection, and focus.
- The tool-call card keeps its content mounted while collapsed and contains at least one normally focusable descendant.

## When

### Part A - Queue Failure and Ownership Semantics

1. Complete the active delivery while the queue head is being edited, then separately Save, Cancel, and Delete the head.
2. Attempt Immediate Send for a non-head entry while cancellation is pending; repeat the same action before cancellation settles.
3. Reject Immediate Send cancellation.
4. Resolve cancellation but reject the reserved target's start before a handle is returned.
5. Reject an acknowledged active delivery outcome as an Agent error while retained entries remain.
6. Fail manual Stop cancellation, then attempt corrective Immediate Send and separately fail or succeed the second cancellation/start path.
7. Clear the queue while an acknowledged delivery and an Immediate Send reservation are separately in flight.

### Part B - Main and Queued Editor Keyboard Contracts

8. In the main input, dispatch Enter, Shift+Enter, `Cmd/Ctrl+Shift+Enter`, Escape, and the same key events while IME composition is active.
9. Open transient Mention or Slash UI and dispatch expansion Escape and plain Escape in order.
10. Queue one turn, leave the main input empty, and press Enter twice; repeat after a real user input event changes the draft.
11. With the main input empty, press ArrowUp with and without a queued tail.
12. In the queued editor, dispatch Enter, Shift+Enter, `Cmd/Ctrl+Shift+Enter`, and Escape for accepted, empty-rejected, cancellation-failed, and start-failed outcomes.
13. Attempt a second queued edit while one edit lease is active, then Save, Cancel, Delete, or Immediately Send the leased turn.

### Part C - Paste and Asynchronous Editor Lifetime

14. Paste HTML-looking `text/plain` and verify it remains literal text at the current selection.
15. Paste mixed text and images while one upload resolves and one rejects.
16. Move focus and selection to another editor before uploads settle.
17. Unmount the originating editor before a deferred upload settles, then mount a new live editor.

### Part D - Tool-Call Disclosure Accessibility

18. Inspect the collapsed tool header role, tab focusability, `aria-expanded`, and content `inert`/`aria-hidden` state.
19. Focus the header and dispatch Enter, repeated Enter, Space, and repeated Space.
20. Expand, collapse, and re-expand while checking descendant focusability and accessibility exposure.
21. Render one registered MCP tool and one non-MCP tool.

## Then

- An edited head blocks automatic advancement; Save sends the edited head, Cancel sends the original head, and Delete releases the next eligible turn.
- Immediate Send waits for confirmed cancellation, repeated actions do not duplicate cancellation or delivery, and failures restore the same target, ID, draft, FIFO position, and edit lease when applicable.
- Cancellation failure or pre-handle start failure returns the target to the queue head and pauses with the correct normalized reason.
- Agent error does not requeue an already started active turn; retained entries remain paused for explicit recovery.
- Stop/corrective-action races preserve the latest user intent and never let an earlier completion override a later Stop.
- Clear removes queue, edit, pause, reservation, and fast-track state without falsifying an acknowledged active delivery.
- Main-input shortcuts preserve native newline and Immediate Send ordering; IME composition never submits.
- Expansion Escape has priority over transient/plain Escape, transient UI closes before Stop, and one-shot fast track is consumed once and invalidated only by the declared state changes.
- ArrowUp atomically takes back only the tail, restores supported draft fields, focuses the main input, and otherwise delegates to input history.
- Queued-editor shortcuts preserve multiline content, rejected actions retain draft/edit focus, and accepted Save/Cancel/Delete/Immediate Send return focus to the main input.
- HTML-looking plain text remains literal; mixed paste inserts text synchronously at the originating range, retains successful images, reports only failed images, and never applies deferred selection/text changes to another or newly mounted editor.
- The tool header is a focusable disclosure button with accurate `aria-expanded`; Enter and Space toggle without losing focus, Space prevents scrolling, and repeat events do not toggle again.
- Collapsed content remains mounted but is `inert` and `aria-hidden`, so descendants cannot receive focus or enter the accessibility tree; expansion restores both capabilities.
- Registered MCP tools retain the MCP prefix, while non-MCP tools use a neutral prefix.

## Pass / Fail Judgment

- **PASS** - queue ownership and failure recovery, input/editor keyboard behavior, paste lifetime safety, and tool disclosure accessibility satisfy every deterministic contract.
- **BLOCKED** - a required controllable port, jsdom input, clipboard/upload, or disclosure fixture is unavailable.
- **FAIL** - any race duplicates or loses a turn, failure recovery changes identity/order, IME submits, paste corrupts another editor, focus rules drift, or collapsed tool content remains keyboard/accessibility reachable.

## Hardening

- Hardening verdict: `DEFER` for Playwright because this is a `node-contract` scenario.
- Keep deterministic coverage in the existing focused Jest suites; use the runtime Agentic queued-turn, input-send, and keyboard scenarios for visible integration proof.
