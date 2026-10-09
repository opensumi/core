# Add jest unit test for the sticky-send submitDisabled formula

Status: done (2026-09-28) Blocked by: none

## Resolution

Implemented in `packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx` — that suite already renders the full `AIChatViewACPContent` with a complete mock harness, so the formula is locked through the real render path: `services.getLatestChatInputProps()` asserts the actual ChatInput props, and the status strip is read from `[data-testid="acp-live-connecting"]`. The mock service gained an `isSessionCreationPending: false` field that tests override.

Discovery worth noting: the strip is **delayed** — `showDelayedAgenticConnectionStatus` (chat.view.acp.tsx ~:1673) only turns true 500ms after `showAgenticConnectionStatus`, unless live-ready is `'failed'` (immediate). New tests use `jest.useFakeTimers()` + `act(() => jest.advanceTimersByTime(500))`, the same pattern as the pre-existing "keeps the Agentic transcript visible while Live Ready is pending" test.

Four tests lock the formula (slightly refined from the issue's case list — case 3 blocks via `disabled`, not `submitDisabled`, because `showAgenticConnectionStatus` is false without the agentic layout):

1. creation in flight (agentic, `isSessionCreationPending = true`, live-ready `pending`) → `submitDisabled: false` + copy "Starting task. Your message will be sent when the task is ready.";
2. restore pending (agentic, live-ready `pending`, no creation) → `submitDisabled: true` + copy "Restoring session. You can send when it is ready.";
3. classic layout + session loading → `disabled: true` (non-agentic channel), `submitDisabled: false`, no strip;
4. agentic ready (baseline) → both false, no strip.

Evidence: suite 72/72; full affected jest matrix 495/495 (incl. acp-chat-internal.service, acp-chat-queued-turns, acp-queued-turns/-editor suites).

## Context

The product fix for the swallowed send (`.scratch/acp-sticky-send/spec.md`) reduced to a formula in `chat.view.acp.tsx`:

- `stickySendDuringSessionCreation = isAgenticLayout && aiChatService.isSessionCreationPending`
- `submitDisabled = showAgenticConnectionStatus && !stickySendDuringSessionCreation`
- `agenticConnectionStatusMessage` picks copy by cause (failed / creation / restore).

Currently only the e2e regression test (`tools/playwright/src/tests/acp-chat-agentic-send-during-session-creation.test.ts`) covers the creation-window case; nothing locks the **restore-path-unchanged** invariant:

1. restore in progress (`getAgenticSessionLiveReadyStatus === 'pending'`, no in-flight `sessionCreationPromise`) → sends stay blocked, copy is "Restoring session…";
2. creation in flight (`isSessionCreationPending === true`) → sends allowed, copy is "Starting task…";
3. creation in flight + `isAgenticLayout === false` (classic) → sends stay blocked (`showBlockingSessionLoading` path), copy irrelevant.

## Acceptance

- A jest test (jsdom, following `packages/ai-native/__test__/browser/acp-chat-view-*.test.tsx` patterns and its service mocks) asserts the three cases above.
- Mock `AcpChatInternalService.isSessionCreationPending` (getter) rather than touching private state.
- Runs green alongside the existing suites.
