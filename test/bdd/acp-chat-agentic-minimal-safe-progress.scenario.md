# Scenario: ACP Chat Agentic Minimal Delivery - Safe Progress Without Raw Intermediate Output

**Trigger:** `packages/ai-native/src/node/acp/acp-cli-back.service.ts`, `packages/ai-native/src/browser/chat/acp-chat-agent.ts`, `packages/ai-native/src/browser/chat/chat-model.ts`, `packages/ai-native/src/browser/components/ChatReply.tsx`, `packages/core-common/src/types/ai-native/index.ts`, or `packages/i18n/src/common/*`

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node <absolute-repo-path>/test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich`, and ACP Delivery Mode is set to `minimal` for the run. A fresh MCP session may use default-profile `acp_chat_get_session_state` for metadata-only state checks. **Workspace mutation:** None. **Automation status:** Scenario-owned runtime BDD. Core minimal-delivery transformation is covered by focused Jest in `packages/ai-native/__test__/node/acp-cli-back.test.ts`, transient response state by `packages/ai-native/__test__/browser/chat/chat-model.test.ts`, and visible safe-progress rendering by `packages/ai-native/__test__/browser/chat/chat-reply.test.tsx`. Playwright conversion should wait until ACP Delivery Mode override and stable safe-progress selectors are available in the E2E fixture.

## Given

- ACP Chat is running in the Agentic layout with ACP Delivery Mode `minimal`.
- The deterministic `stream-rich` fixture emits bounded thought chunks, plan entries, assistant chunks, tool-call lifecycle updates, and completion.
- `minimal` is a low-volume ACP delivery mode: it may show ACP Safe Progress Signals, but must not stream ACP Intermediate Output to the browser.
- ACP Safe Progress Signals are transient UI state. They are not part of the final assistant response, session history, state-tool payloads, copied assistant text, or replayed session JSON.
- The runtime assertion must not depend on exact LLM-generated assistant content.

## When

1. Verify the active runtime uses ACP Delivery Mode `minimal`.
2. `mcp` when available: `acp_chat_get_session_state({})` -> record `STATE_BEFORE_MINIMAL_SEND`.
3. Focus the Agentic input and send a deterministic prompt through the UI.
4. Wait for the active assistant row to enter loading/thinking state.
5. Observe the current assistant row while the fixture emits `threadStatus: working`.
6. Observe the same assistant row while the fixture emits `agent_thought_chunk` updates.
7. Observe the same assistant row while the fixture emits a `plan` update with multiple plan entries.
8. Observe the same assistant row while the fixture emits `tool_call` and `tool_call_update` activity.
9. Observe the same assistant row while the fixture emits assistant `agent_message_chunk` content before `done`.
10. Wait for fixture completion and final assistant response rendering.
11. `mcp` when available: `acp_chat_get_session_state({})` -> record `STATE_AFTER_MINIMAL_SEND`.
12. Reload or switch away and back to the session when the scenario runner supports it, then record whether safe progress reappears.

## Then

- The user message appears exactly once and before the assistant response.
- While the request is running, the current assistant row shows at most one safe-progress line or fallback thinking line at a time.
- `threadStatus: working` may appear as a safe progress signal without adding an extra assistant message row.
- Plan activity may appear only as aggregated progress, such as a step count. Raw plan item text, file paths, prompt text, and task-specific details must not be visible in minimal safe progress.
- Tool activity may appear only as a generic or safety-mapped label, such as `Running tool`. Raw tool title, raw input, arguments, file paths, and raw output must not be visible in minimal safe progress.
- Thought chunks must not be visible, expandable, copied, or persisted in minimal delivery.
- Partial assistant content must not stream into the row before completion.
- The final assistant response appears after `done` as one completed assistant response and does not include prior safe-progress text.
- `STATE_AFTER_MINIMAL_SEND` remains metadata-only and must not include thought text, raw plan item text, partial assistant chunks, raw tool input, raw tool output, raw ACP JSON, MCP tokens, or permission content.
- Reloading or switching sessions must not replay safe-progress text as history.
- The input returns to an idle editable state after completion.

## Live Agent Execution

- A real LLM-backed ACP agent may verify only the coarse minimal-delivery shell: one user row, one running assistant row, a safe-progress or fallback thinking line, final completion, and no visible raw thought text.
- Live-agent mode must not assert generated assistant text, plan content, tool choices, timing, token order, or exact safe-progress sequence.

## Pass / Fail Judgment

- **PASS** - minimal delivery shows low-volume transient safe progress while hiding thought text, raw plan/tool details, partial assistant chunks, and persisted safe-progress history, then renders the final assistant response once.
- **BLOCKED** - the run lacks Agentic startup, deterministic `stream-rich` fixture, a way to set ACP Delivery Mode to `minimal`, or stable safe-progress/assistant-row selectors.
- **FAIL** - minimal delivery streams raw intermediate output, shows raw plan/tool/thought details, duplicates assistant rows, persists safe progress into history/state, or fails to render the final assistant response.
