# Scenario: ACP Chat Agentic Reload During Stream - Mid Request Recovery

**Trigger:** `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, `packages/ai-native/src/browser/chat/acp-session-provider.ts`, or `packages/ai-native/src/browser/chat/chat-manager.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=long-stream` with enough ticks/delay to reload while streaming, a `--fixture=stream-rich` pass is available for post-reload success recovery, the session provider is reload-safe, and a fresh MCP session runs in a profile exposing the required `acp_chat` tools. A real LLM-backed ACP agent may be used only when it reliably streams long enough for live reload coverage. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP; live-agent runs may verify reload recovery around a visible active stream, but the mock mid-stream reload fixture is required for conversion.

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
7. Send a deterministic successful prompt after reload.
8. Record final state and `acp_chat_get_session_state({})`.

## Then

- Reload keeps the page on the same workspace and restores Agentic layout.
- The previous active session is either safely restored or a structured recoverable state is shown.
- The UI does not duplicate the pre-reload user row or create phantom empty sessions.
- No spinner remains forever after reload.
- A new prompt can be sent after recovery.
- State tools remain metadata-only and diagnostics do not leak raw MCP tokens.

## Live Agent Execution

- A real LLM-backed ACP agent may verify that reload during a visible active stream returns the IDE to a usable Agentic chat surface and keeps state tools metadata-only.
- Live-agent mode must not assert whether the model resumes, cancels, or completes the interrupted answer, nor exact restored assistant content. If no active stream is observable before reload, record the live-agent reload assertion as blocked.

## Pass / Fail Judgment

- **PASS** - mid-stream reload recovers to a usable Agentic chat state and allows a new send without duplicates or stuck loading.
- **BLOCKED** - the run lacks interactive profile or the mock ACP agent `long-stream` reload fixture.
- **FAIL** - reload loses Agentic layout, duplicates messages, leaves permanent loading, or prevents future sends.
