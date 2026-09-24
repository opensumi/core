# Scenario: ACP Chat Agentic Cancel Stop - Long Stream Interruption

**Trigger:** `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat-manager.service.ts`, `packages/ai-native/src/browser/chat/acp-chat-agent.ts`, or `packages/ai-native/src/node/acp/acp-agent.service.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=long-stream` with enough ticks/delay to expose the stop control, a fresh MCP session runs in a profile exposing the required `acp_chat` tools, and a visible stop/cancel control exists. A real LLM-backed ACP agent may be used only when it reliably streams long enough for live stop coverage. **Workspace mutation:** None. **Automation status:** Converted to deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-cancel-stop.test.ts` using `fixture=long-stream` and `profile=interactive` for cancellation, Task Row synchronization, same-session follow-up, metadata state, and reload persistence.

## Given

- Agentic AI Chat is visible and focusable.
- The mock `long-stream` fixture can keep a request in `working` state until the UI interrupts it.
- The scenario must not call legacy direct ACP cancellation tools.

## When

1. Send a deterministic long-stream prompt through the Agentic input.
2. Wait until the user row, one assistant row, and visible streaming/loading state are present.
3. Record `acp_chat_get_session_state({})` while the stream is active.
4. Click the user-facing stop/cancel control in the chat UI.
5. Wait until the input becomes editable and no active loading control remains.
6. Record visible assistant row content, stopped/canceled state, duplicate row counts, and thread/history status.
7. Send a second deterministic successful prompt in the same session.
8. Record final row counts, input state, and `acp_chat_get_session_state({})`.

## Then

- The first prompt creates exactly one user row and one active assistant response row.
- Stop/cancel is available only while the request is active.
- Session-row loading animation is reserved for Pending Agent Session Selection and is not reused as a persisted task-status indicator.
- Clicking stop/cancel does not remove the user row and does not leave the assistant row stuck in a spinner-only state.
- The input becomes editable after cancellation.
- The matching Agent Session remains discoverable, does not retain a pending-selection spinner, and remains selectable after reload.
- The session remains usable and the second prompt succeeds in the same active session.
- No duplicate assistant rows, duplicate tool cards, or stale loading controls remain after retry.
- State tools remain metadata-only; bounded session titles are allowed, but full canceled prompt/message bodies, partial assistant text, and raw cancellation payloads are not exposed.

## Live Agent Execution

- A real LLM-backed ACP agent may verify that a long-enough live stream exposes stop/cancel UI, returns the input to a usable state, preserves the user row, and permits a follow-up send.
- Live-agent mode must not assert partial assistant text, exact cancellation timing, model-specific stop semantics, or generated follow-up content. If the live response completes before stop is observable, record the run as blocked for live stop coverage rather than passing the cancel assertions.

## Deterministic Playwright Coverage

- `tools/playwright/src/tests/acp-chat-agentic-cancel-stop.test.ts` runs `loadAcpBddFixtureWorkbench({ fixture: 'long-stream', profile: 'interactive' })`.
- Covered: visible active long-stream sentinel, exactly one initial user row, scoped Stop affordance, editable input recovery, deterministic follow-up success in the same Session, metadata-only session state, Session discovery continuity, and reload without a stale pending-selection spinner.
- Remaining outside this focused pass: duplicate tool-card assertions, because the `long-stream` fixture emits no tool calls.

## Pass / Fail Judgment

- **PASS** - long-stream cancellation is visible, leaves the Agentic chat usable, and a follow-up send succeeds without stale loading or duplicate rows.
- **BLOCKED** - the run lacks interactive profile, the mock ACP agent `long-stream` fixture, or stable stop/cancel selector.
- **FAIL** - cancellation is unavailable, uses legacy ACP tools, leaves stuck loading, loses the session, or corrupts subsequent sends.
