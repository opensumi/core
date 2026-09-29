# Decide semantics: held turn when the draft is superseded or discarded

Status: done (A implemented 2026-09-28) Type: decision Blocked by: none

## Decision input (2026-09-28)

User confirmed the production premise: agents run in users' **cloud Linux environments**, where session creation routinely takes **seconds or longer**. Per the pre-agreed rule ("seconds+ latency ⇒ A"), option A is implemented.

## Context

With sticky send (`.scratch/acp-sticky-send/spec.md`), a Send clicked during the draft-bound session creation window is reserved by the queued-turn runtime and dispatches once the session binds. But if the user discards the draft (`discardAgenticTaskDraft`, `chat.internal.service.acp.ts:673-690`) or supersedes it by entering a new draft before the session binds, the in-flight creation is cancelled (`prepareDraftBoundSession` resolves `undefined`) and `ensureSessionModel` (`:608-632`) falls through to `startSessionModel()` — the held message then starts a brand-new session.

Independent review verdict (2026-09-24): mechanically safe — no double dispatch, no hanging `reservedTurn`/`pendingInitialStart` (catch paths reset at `acp-chat-queued-turns.ts:562`, clear via `applyActivation`/`deactivate`), failures surface as the existing `start-failed` pause UI. But the user's explicit discard is contradicted: the message still launches a task in a new session.

## Options

A. Cancel the held turn on supersede/discard (bump epoch / cancel initial start so the reserved turn dies with the draft generation; matches ADR-0004 latest-intent semantics). B. Keep current behavior; document it in `packages/ai-native/docs/adr/0004-create-draft-bound-acp-sessions-for-initial-skill-catalogs.md` and soften the status copy to say the message will start a new task if the draft is discarded.

Frequency is low (discard/supersede within a 0.5–3s window), impact is visible-but-recoverable (the task appears in the task list; no data loss).

## Related evidence found while implementing per-session drafts (2026-09-28)

There is already one guardrail adjacent to this edge case: an unaccepted draft-bound session (bound but no dispatched turn yet) with unsent input blocks silent switching — `AgenticSessionList.activate` pops "Discard the unsent draft and switch sessions?" because `isActiveAgenticTaskDraft()` stays true for a bound-but-zero-turn session (`chat.internal.service.acp.ts` `isActiveAgenticTaskDraft`). This covers the "switch away mid-window" variant but NOT the held-turn variant: a message already reserved by the queued-turn runtime (sticky send) dispatches regardless of that dialog, because it was accepted before the discard. Impact on the option decision: the window for the unconfirmed switch case is narrower than assumed, but the held-turn-after-explicit-discard case is unchanged. Also note the window width scales with the agent's `session/new` latency (not per-turn response time) — slower agents make every case here more likely.

## Acceptance

- A chosen behavior is implemented or documented, with the chosen option recorded here.
- If A: a regression test asserting the held turn does NOT dispatch after an explicit discard.

## Implemented (2026-09-28, option A)

- `chat.internal.service.acp.ts` `ensureSessionModel()`: captures `draftBoundSessionGeneration` at entry; if the awaited draft-bound preparation lands on a generation that changed (superseded by `enterAgenticTaskDraft`, discarded by `discardAgenticTaskDraft` — both bump the generation), it throws `ACP_SESSION_CREATION_CANCELLED` instead of falling through to `startSessionModel()`. Veto is placed BEFORE the self-heal recursion, which otherwise routes the stale held turn onto the superseding draft's brand-new session (the double-start scenario that motivated A for slow agents). The veto also closes the race where a bind completes and the discard lands before dispatch.
- `acp-chat-queued-turns.ts` `startReservedTurn` catch: rejects named `ACP_SESSION_CREATION_CANCELLED` are dropped silently via `dropReservedTurnSilently()` (no re-queue to entries, no `start-failed` pause; mirrors the existing explicit-cancel path). A deferred session activation (user clicked another session mid-window) is still applied before the drop.
- Not changed: mid-window activation of an existing session does not bump the draft generation, so a held turn may still dispatch into its own draft-bound session in that case — pre-existing overlap behavior, out of the decision's scope (recorded for future triage).
- Copy audit: the discard dialog ("Your unsent message will be lost.") and the "Starting task…" strip stay accurate — under the veto the reserved message really is lost on discard, and the strip disappears when the turn is dropped.

## Verification

- New e2e `tools/playwright/src/tests/acp-chat-agentic-held-turn-cancelled-on-discard.test.ts` (mock `--new-session-delay-ms=4000`):
  1. supersede by re-launch during the window → superseding draft's session binds, requestCount stays 0, no PROMPT transcript after the original window deadline; RED verified by neutering the veto (requestCount became 1 — the held turn started a session), GREEN after restore.
  2. explicit discard via `agentic-task-draft-close` → discard confirmation → session state stays null past the original window deadline.
- Sticky-send spec (no discard, dispatch-on-bind) standalone: pass — veto does not affect the normal path.
- Per-session draft spec standalone: pass. Jest acp-chat + queued-turns suites: 182/182. tsc clean; eslint 0 errors on touched files.
- ocr session 72139107: zero findings on the touched files.
