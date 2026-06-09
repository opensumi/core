# Scenario: ACP Chat Agentic Deep Thinking Collapse

**Trigger:** `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/components/ChatReply.tsx`, or `packages/ai-native/src/browser/chat/chat-model.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich`, stable selectors or visible text access are available for the Agentic message list and `Deep Thinking` toggle, and a fresh MCP session runs in a profile exposing the required `acp_chat` tools. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP plus the deterministic mock ACP agent; live-agent runs may verify only coarse collapsed-shell behavior, while sentinel reasoning assertions require the mock `stream-rich` fixture.

## Given

- Agentic AI Chat is visible and focusable.
- Deterministic-fixture mode uses the mock ACP agent `stream-rich` fixture through `AcpThread`.
- The fixture emits stable reasoning sentinel text such as `BDD_THOUGHT_STEP_1` and `BDD_CONFIG_SNAPSHOT`.
- The scenario validates visible message-list behavior, not raw ACP notification JSON.

## When

1. Focus the Agentic input and send the deterministic deep-thinking prompt through the UI.
2. Wait until the assistant row shows the `Deep Thinking` toggle while the response is still streaming.
3. Record a visible text snapshot of the assistant row before interacting with the toggle.
4. Wait for the deterministic stream to complete without expanding `Deep Thinking`.
5. Record another visible text snapshot of the final assistant row.
6. Click the `Deep Thinking` toggle on the completed assistant row.
7. Record the expanded reasoning content, then click the same toggle again.
8. Start a second deterministic stream-rendering prompt in a fresh ACP session.
9. While the response is still streaming and after the first reasoning chunk, click the `Deep Thinking` toggle.
10. Wait for the next reasoning chunk and record the expanded reasoning content.
11. Let the stream complete and record the final assistant row state.
12. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_DEEP_THINKING`.

## Then

- The `Deep Thinking` toggle is visible for reasoning updates in the assistant response.
- Before any toggle click, reasoning sentinel text is not visible in the message list while streaming.
- If no toggle click occurs, reasoning sentinel text remains hidden after the assistant response completes.
- Clicking `Deep Thinking` on a completed response expands the reasoning content and reveals the deterministic sentinel text.
- Clicking the same toggle again collapses the content and hides the sentinel text.
- Clicking `Deep Thinking` during streaming expands the reasoning content instead of being ignored.
- After streaming reasoning is expanded, later reasoning chunks appear inside the same expanded response without creating duplicate assistant rows or duplicate `Deep Thinking` toggles.
- The final assistant row preserves the user's last explicit expanded/collapsed choice for that response.
- `STATE_AFTER_DEEP_THINKING` returns `success: true` and remains metadata-only; it must not include full prompt/message bodies, assistant text, reasoning text, raw ACP JSON, MCP tokens, or permission content.
- No step uses or expects legacy direct ACP tools such as `acp_sendMessage`, `acp_cancelRequest`, or older camelCase ACP Chat tool names.

## Live Agent Execution

- A real LLM-backed ACP agent may verify that `Deep Thinking` appears as a collapsed shell during streaming and after completion.
- Live-agent mode must not assert exact reasoning text, chunk order, token timing, or generated assistant content.

## Pass / Fail Judgment

- **PASS** - ACP Agentic `Deep Thinking` content is collapsed by default during streaming and after completion, remains user-expandable, preserves explicit toggle state, and does not duplicate rows or leak content through state tools.
- **BLOCKED** - the run lacks interactive profile, the mock ACP agent `stream-rich` fixture, stable `Deep Thinking` toggle selectors, or a supported browser/MCP execution surface.
- **FAIL** - reasoning content is visible by default, the streaming toggle cannot be expanded, explicit toggle state is lost, duplicate assistant rows/toggles appear, or ACP Chat state tools leak message/reasoning/raw protocol content.
