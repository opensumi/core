# Sticky send during draft-bound session creation

## Summary

Defect: in Agentic layout, a Send click inside the draft-bound session swap window (~0.5–3s under load, while `startSessionModel` holds `sessionLoading=true`) was silently swallowed — no turn dispatched, no error, input text retained.

Root cause: the view mapped `sessionLoading` onto `submitDisabled` (`showAgenticConnectionStatus` in `chat.view.acp.tsx`), and `components/acp/MentionInput.tsx` removed the send button's `onClick` entirely (:2190) and early-returned the Enter path (:1692) while `submitDisabled` was true. The click never entered the send pipeline. The handoff's original code map pointed at `components/mention-input/mention-input.tsx` — that is the legacy input; the real agentic input is `components/acp/MentionInput.tsx` (via `AcpTurnEditor`).

Fix (option A, "sticky send"): keep the send affordance active during the creation window and let the existing queued-turn machinery hold the turn:

- `chat.internal.service.acp.ts`: added `get isSessionCreationPending()` (`sessionCreationPromise !== undefined`).
- `chat.view.acp.tsx`: `stickySendDuringSessionCreation = isAgenticLayout && aiChatService.isSessionCreationPending`; `submitDisabled={showAgenticConnectionStatus && !stickySendDuringSessionCreation}`; connection strip copy split by cause (creation vs restore) via `agenticConnectionStatusMessage`.
- No changes to `MentionInput.tsx` / `AcpTurnEditor.tsx` / `acp-chat-queued-turns.ts` — the hold-and-dispatch chain already existed (`startReservedTurn` → `pendingInitialStart` → `port.start(undefined)` → `ensureSessionModel()` awaits the in-flight `draftBoundSessionPreparation` → dispatch on bind; "Starting task…" renders via `snapshot.initialStartPending`).
- Session restore (`doActivateAgenticSession`) keeps blocking sends until live-ready — behavior unchanged.

## Verification

- Regression test (RED before fix → GREEN after): `tools/playwright/src/tests/acp-chat-agentic-send-during-session-creation.test.ts` (deterministic via mock agent `--new-session-delay-ms`; in-window click dispatches without a second click, "Starting task…" feedback, input cleared, no double dispatch).
- Existing spec `acp-chat-agentic-agent-cwd-file-link` still passes.
- Jest: acp-chat-view-wrapper / acp-chat-input-handle / acp-chat-mention-input-ref = 64/64 pass.
- `tsc --build` (ai-native) clean; eslint clean on changed hunks.
- Independent agent review: mergeable, no must-fix items (report 2026-09-24).
- ocr review: single finding on this change (nested ternary) fixed.

## Open issues

- `issues/01-supersede-held-turn-semantics.md` — **resolved (A, 2026-09-28)**: held turn is cancelled when the draft is superseded/discarded; regression spec + RED/GREEN recorded there.
- `issues/02-jest-sticky-send-formula.md` — **done (2026-09-28)**: 4 render-level jest tests lock the formula + per-cause copy in `acp-chat-view-header.test.tsx` (fake-timer advance past the 500ms strip delay).
- `issues/03-per-session-input-draft.md` — **resolved (B, 2026-09-28)**: per-session input drafts implemented; regression spec + RED/GREEN recorded there.
- `issues/04-shared-page-multi-spec-invocation.md` — **done (2026-09-28)**: fixture-entry page heal + `ensurePage()`; 3+ consecutive green multi-spec runs; ocr findings processed.
