# Scenario: ACP Chat Agentic Reload During Stream - Mid Request Recovery

**Trigger:** `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, `packages/ai-native/src/browser/chat/acp-session-provider.ts`, or `packages/ai-native/src/browser/chat/chat-manager.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=long-stream` with enough ticks/delay to reload while streaming, the session provider is reload-safe, and a fresh MCP session runs in a profile exposing the required `acp_chat` tools. A real LLM-backed ACP agent may be used only when it reliably streams long enough for live reload coverage. **Workspace mutation:** None. **Automation status:** Deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-reload-during-stream.test.ts` uses `fixture=long-stream` and `profile=interactive` to verify session identity, restored output, continued output, running status, and explicit Stop after reload.

## Given

- Agentic AI Chat is visible.
- The mock `long-stream` fixture can keep a stream active long enough for a browser reload.

## When

1. Send a deterministic long-stream prompt.
2. Wait until the user row and active assistant row are visible.
3. Record active session id and visible loading state.
4. Reload the page without changing the workspace URL.
5. Wait for Common Preflight readiness and Agentic AI Chat recovery.
6. Record recovered session selection, row counts, loading state, input state, and visible recovery/error text.
7. Wait for a later deterministic stream chunk after reload.
8. Record restored state with `acp_chat_get_session_state({})`.
9. Click the restored user-facing Stop control.
10. Wait for the Send control and editable input to return, then record the selected session again.

## Then

- Reload keeps the page on the same workspace and restores Agentic layout.
- The previous active session id is restored.
- Output visible before reload is restored, and later output continues to arrive.
- The restored session remains `working` and exposes the Stop affordance without resending the prompt.
- Clicking Stop after reattachment explicitly cancels the same running Task Conversation and returns the input to a usable state.
- The UI does not duplicate the pre-reload user row or create phantom empty sessions.
- No spinner remains forever after reload.
- State tools remain metadata-only and diagnostics do not leak raw MCP tokens.

## Live Agent Execution

- A real LLM-backed ACP agent may verify that reload during a visible active stream returns the IDE to a usable Agentic chat surface and keeps state tools metadata-only.
- Live-agent mode may assert that the same active session remains selected and continues or completes without an implicit cancellation. If no active stream is observable before reload, record the live-agent reload assertion as blocked.

## Deterministic Playwright Coverage

- `tools/playwright/src/tests/acp-chat-agentic-reload-during-stream.test.ts` runs `loadAcpBddFixtureWorkbench({ fixture: 'long-stream', profile: 'interactive' })`.
- Covered: visible active long-stream sentinel before reload, the same session id after reload, restored pre-reload output, later continued output, one request without prompt duplication, authoritative `working` status, the scoped Stop affordance after reload, and explicit cancellation from the replacement browser connection.

## Pass / Fail Judgment

- **PASS** - mid-stream reload restores the same running Task Conversation, preserves visible output, continues streaming without a duplicate request, and lets the user explicitly Stop that same task after reattachment.
- **BLOCKED** - the run lacks interactive profile or the mock ACP agent `long-stream` reload fixture.
- **FAIL** - reload loses Agentic layout, duplicates messages, leaves permanent loading, or prevents future sends.
