# Shared page across spec files breaks multi-spec playwright invocations

Status: done (2026-09-28) Type: bug (test infrastructure, pre-existing)

## Context

Discovered 2026-09-28 while re-running specs after the per-session input draft work (see `issues/03`). Invoking playwright with two fixture spec files in one command fails sporadically at fixture setup, with varying symptoms:

- `page.evaluate: Execution context was destroyed, most likely because of a navigation` (`acp-chat-agentic-agent-cwd-file-link.test.ts:199`, during project seeding)
- `page.setViewportSize: Target page, context or browser has been closed` (`acp-bdd-fixture.ts:436`)

Both specs pass standalone, consistently. The interference comes from the shared module-level `page`/`context` in `tools/playwright/src/tests/hooks/index.ts` plus the fixture's `dispose()` navigating that same page (`page.goto('about:blank')`, `acp-bdd-fixture.ts:494`) while the next spec file's `beforeAll` resets the context (`resetPage`). Not caused by any product change.

## Options

A. Make the fixture `dispose()` not touch the shared page (only app/workspace/lock), letting each file's `beforeAll` own the page lifecycle. B. Make `resetPage` part of the fixture load (each `loadAcpBddFixtureWorkbench` calls it), and keep afterAll as-is. C. Document "one fixture spec per invocation" as convention (cheap, but combined runs keep being a trap).

## Acceptance

- Two fixture specs run in one invocation pass reliably (e.g. 3 consecutive runs).
- Standalone runs unaffected.

## Resolution

Root cause refined: top-level `test.beforeAll/afterAll` in `hooks/index.ts` attach to the **first spec file loaded in a worker** (the module is evaluated once, cached afterwards), so later files never reset the shared page and inherit a closed page; the fixture also received that stale module `page` as a plain argument.

Fix (hybrid A/B, zero call-site changes):

- `hooks/index.ts` captures the fixture `browser` and exports `ensurePage()` — resets the shared page when it is undefined/closed (`resetPage` closes the previous context, which flushes recorded videos of earlier files).
- `loadAcpBddFixtureWorkbench` heals a closed page at entry (`if (page.isClosed()) page = await ensurePage()`); spec bodies keep working because they use the module live binding that `resetPage` reassigns.

Verification: five multi-file invocations (file-link + sticky + per-session + held-turn, 4-5 tests each) → 4/4, 4/5, 5/5, 5/5, 5/5 (24/25 tests total). Rounds 3-5 passed consecutively → acceptance (3 consecutive green runs) met. The single failure (agent-cwd-file-link, round 2) left no artifacts (later runs clean test-results) and has not reproduced; record as watch-item, not a blocker. Standalone runs unaffected.

ocr follow-ups processed (session cbea4d47):

- [bug · critical] "heal ineffective (param rebind vs module binding)" — **refuted by evidence**: `resetPage` reassigns the module-level `page` export; spec bodies access it through transpiled live bindings (`hooks_1.page`); specs in positions 2-4 of rounds 3-5 drove locators on the healed page successfully.
- [maintainability · medium] top-level `afterAll` only fires for the first file, so later files' video flush relies on the next `resetPage`/worker teardown — **accepted** (video usage is opt-in per-run; `resetPage` closes the old context on every heal).
- [maintainability · low] double activation-fire on the held-turn drop path — **accepted**, idempotent state updates.
- Fixed from the same round: `clearSessionModel` now deletes the cleared session's input draft slot (`inputDrafts.delete(sessionId)`), and the cancellation error name is centralized as `ACP_SESSION_CREATION_CANCELLED_ERROR_NAME` in `acp-chat-queued-turns.ts` (the leaf module — the service imports it as a value, so no new runtime import cycle; the service's other queued-turns import is type-only).
