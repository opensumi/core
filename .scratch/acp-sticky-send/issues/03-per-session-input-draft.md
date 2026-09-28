# Per-session input draft (currently one global draft shared by all sessions)

Status: done (B implemented 2026-09-28) Type: decision

## Context

User inquiry 2026-09-24: "当前在 session1,输入框输入了「1」,还没发送,切换到 session2, 这时候输入框是空的吗?切回 session1,原来的输入框内容还在吗?"

Verified behavior (evidence, pre-fix):

- `inputDraft` is a single field on `AcpChatInternalService` (`chat.internal.service.acp.ts:226`), synced globally on every keystroke via `onDraftChange → updateInputDraft`. Not a per-session map.
- The input area does not remount on session switch: `ChatInputWrapperRender` has no `key={activeServiceSessionId}` (only the message list does), and `activateSession`/`applyActivatedSession` never read or write `inputDraft`.
- `initialDraft` is restored only once per input mount (`AcpTurnEditor.tsx:334-339`, `initialDraftRestoredRef`).

So: session1 type "1" → switch to session2 → input still shows "1" (not empty) → switch back → still "1". The draft never left; both sessions share one input.

## Decision

User picked **B (per-session drafts)** on 2026-09-28.

## Implemented design (2026-09-28)

Slot model — the draft store is keyed by the "current slot", `_sessionModel?.sessionId ?? ACP_INPUT_DRAFT_SLOT` (a dedicated key for the agentic task-draft phase, before any session binds):

- `chat.internal.service.acp.ts`
  - `inputDrafts: Map<string, AcpTurnDraft>` replaces the single `inputDraft` field.
  - `getInputDraft()` = current slot's draft (existing callers keep working: queued-turn resume, close-view preserve, `initialDraft` prop).
  - `getInputDraftFor(sessionId | undefined)` reads an arbitrary slot (undefined = draft phase) — consumed by the view's switch-restore effect.
  - `updateInputDraft(draft)` writes the CURRENT slot (live keystroke sync).
  - Migration on draft-bound bind (`doStartSessionModel`, where `acquiredDraftBoundSession` lands): the draft-phase slot is carried over to the bound session id and the draft slot cleared, guarded by `hasAcpChatSendPayload` so image/command-only drafts survive too (ocr finding, fixed).
  - `releaseDraftBoundSession` deletes the released session's slot (unaccepted draft-bound session closed → its unsent input dies with it); `dispose()` clears the map (ocr finding, fixed).
  - `enterDraftSession` clears the draft slot → a new task draft starts clean.
- `chat.view.acp.tsx`
  - New effect keyed on `activeServiceSessionId` (next to the `queuedTurns.activate` effect): on slot change it restores the incoming slot via the input handle (`restoreDraft(incoming ?? empty)`).
  - Skip guards (two subtle correctness points):
    1. First run skipped — the editor's `initialDraft` mount restore already covers it.
    2. Restores that would be no-ops are skipped (incoming equals live editor, or both empty) because `restoreDraft` bumps the editor's `draftGenerationRef`, which would break `submitDraft`'s initial-session promotion guard (`draftGenerationRef.current === submissionGeneration + 1`) during the sticky send flow — the sent draft would not clear.
- Regression test `tools/playwright/src/tests/acp-chat-agentic-per-session-input-draft.test.ts`: bind A → send turn → bind B → unsent BBB in B → switch A (no BBB, clean) → switch B (BBB restored) → switch A again (no BBB). RED verified by temporarily disabling the restore effect (BBB leaked into A); GREEN after.

## Non-goal / discovered guardrail (recorded for issue 01)

A session bound from a draft with zero dispatched turns is still an "unaccepted Agentic draft" (`isActiveAgenticTaskDraft()` true while `draftBoundSession.sessionId === active session`). Switching away from such a session with unsent input pops the pre-existing confirmation "Discard the unsent draft and switch sessions?" (`AgenticSessionList.activate`). The per-session test sends a warmup turn in B first to exercise the plain switch path; the discard-confirmation path is pre-existing behavior, untouched.

## Verification (2026-09-28)

- e2e above: RED (restore disabled) → GREEN (12.0s).
- Sticky-send spec standalone: pass. File-link spec standalone: pass.
- Jest acp-chat view/input suites: 136/136 (header test mock gained `getInputDraftFor`; the view effect calls it).
- `tsc --build` ai-native clean; eslint 0 errors on the touched files.
- ocr review (session 46a0764c): 9 comments on the workspace, 3 on this change — image/command-only draft lost at migration (fixed with `hasAcpChatSendPayload`), map never pruned (fixed in release/dispose), plus a dup. No open findings.

## Note: multi-spec invocation is out of scope

Running two fixture specs in one playwright invocation (combined CLI args) fails sporadically at fixture setup (`page.setViewportSize: Target page ... has been closed`) because spec files share the module-level `page` from `./hooks` and each file's `beforeAll`/`afterAll` resets/closes the context while the previous runtime's `dispose()` still navigates it (`about:blank`). Pre-existing infrastructure behavior, unrelated to this change; both specs pass standalone consistently. Filed as `issues/04-shared-page-multi-spec-invocation.md`.
