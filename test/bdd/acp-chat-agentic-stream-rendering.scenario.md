# Scenario: ACP Chat Agentic Stream Rendering - Deterministic Agent Updates

**Trigger:** `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/components/ChatReply.tsx`, `packages/ai-native/src/browser/components/acp/ChatReply.tsx`, `packages/ai-native/src/browser/chat/chat-model.ts`, `packages/ai-native/src/browser/chat/acp-chat-agent.ts`, or `packages/ai-native/src/node/acp/acp-cli-back.service.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** `acp-chat-agentic-startup.scenario.md` and `acp-chat-agentic-input-send.scenario.md` have passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich` for content/reasoning/plan/tool-call assertions, a separate `--fixture=send-failure` pass covers failure recovery, optionally a real LLM-backed ACP agent covers live shell/stream smoke, a fresh MCP session runs in a profile exposing the required `acp_chat` tools, and the default `toolCall` chat component is registered. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP plus the `opensumi-ide` MCP server; live-agent runs may verify coarse stream state, but deterministic mock-agent fixtures are required for content/reasoning/plan/tool-call assertions and Playwright conversion.

## Given

- Agentic AI Chat is visible and focusable.
- Deterministic-fixture mode uses the mock ACP agent `stream-rich` fixture through `AcpThread`, not a live LLM response.
- Live-agent mode may use a real LLM response only for coarse shell and stream-state evidence.
- The deterministic fixture can emit stable sentinel content for browser DOM checks without relying on generated assistant text.
- The scenario validates UI rendering of converted chat progress, not the raw ACP notification JSON contract.
- ACP Chat state tools must remain metadata-only. Bounded session titles are allowed, but full prompt/message bodies, assistant text, tool-call arguments, tool results, and raw ACP JSON payloads are not.

## When

1. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_BEFORE_STREAM`.
2. Focus the Agentic input and send the deterministic stream-rendering prompt through the UI.
3. Wait until the first user row is visible and record user row count, assistant row count, active loading state, and input disabled state.
4. The deterministic stream emits `threadStatus: working` for the active raw session id.
5. The deterministic stream emits `sessionState` metadata, including at least one stable mode/model/config update.
6. The deterministic stream emits two `reasoning` chunks with stable sentinel text.
7. Record the assistant row before clicking `Deep Thinking` and confirm reasoning sentinel text is not visible by default.
8. Click `Deep Thinking` while the response is still streaming, then wait for the next reasoning chunk and record the expanded content.
9. Click `Deep Thinking` again and confirm the reasoning sentinel text is hidden.
10. The deterministic stream emits a `plan` update converted to stable checklist or markdown text.
11. The deterministic stream emits two assistant `content` chunks that should merge into one assistant response.
12. The deterministic stream emits one `toolCall` update for a stable tool id and tool name.
13. The deterministic stream emits a second `toolCall` update with the same tool id and updated arguments.
14. The deterministic stream emits a final `toolCall` result update with the same tool id.
15. The deterministic stream emits final assistant content, `threadStatus: awaiting_prompt`, and completes.
16. Record the completed assistant row before clicking `Deep Thinking` again.
17. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_STREAM`.
18. Expand the visible tool-call card and record its tool name, arguments section, result section, and row/card count.
19. Run a separate `--fixture=send-failure` mock-agent pass after a user row has rendered.
20. Record visible error text, input focusability, loading state, and whether a retry with the successful fixture clears stale error/loading UI.

## Then

- Step 2 creates or activates exactly one ACP session before writing history.
- The user message appears exactly once and before the assistant response.
- The assistant stream renders as one active assistant response row and resolves to one stable final assistant row.
- `threadStatus: working` is reflected in loading or history/session status, and `threadStatus: awaiting_prompt` clears loading state when the stream finishes.
- `sessionState` updates mode/model/config controls or session metadata without adding a chat message row.
- Reasoning renders as a `Deep Thinking` toggle in the thinking UI while streaming and remains associated with the same assistant response after completion.
- Reasoning content is collapsed by default while streaming; deterministic reasoning sentinel text is not visible until the user expands `Deep Thinking`.
- Clicking `Deep Thinking` while streaming expands the current reasoning content and later reasoning chunks continue rendering inside the same expanded response.
- Clicking `Deep Thinking` again collapses the reasoning content and hides the deterministic sentinel text.
- If the user leaves `Deep Thinking` collapsed, reasoning content remains hidden after completion.
- Plan content renders as normal assistant markdown/checklist content in the same response flow.
- Assistant content chunks merge in order without duplicate markdown blocks or duplicate assistant rows.
- The first tool call renders one tool-call card with the stable tool name.
- The second tool-call update with the same id updates the existing card instead of adding a duplicate card.
- The final tool-call result update makes the existing card show a result-ready state and a result section after expansion.
- The input is disabled only while session creation or streaming is active and becomes editable after success or failure.
- The failure fixture shows a user-visible error, clears stale loading state, preserves the user row, and allows a successful retry without duplicating stale assistant/tool rows.
- `STATE_AFTER_STREAM` returns `success: true` and remains metadata-only; it may include bounded title metadata, but must not include full prompt/message bodies, assistant text, reasoning text, plan content, tool arguments, tool results, raw ACP JSON, MCP tokens, or permission content.
- No step uses or expects legacy direct ACP tools such as `acp_sendMessage`, `acp_cancelRequest`, or older camelCase ACP Chat tool names.

## Live Agent Execution

- A real LLM-backed ACP agent may verify that sending creates one user row, one active assistant row, visible loading/streaming state, stop visibility when available, completion recovery, and metadata-only state.
- Live-agent mode must not assert assistant markdown, reasoning text, plan text, token/chunk order, tool-call arguments/results, or exact completion text. Those assertions remain deterministic-fixture only and should be omitted explicitly from live-agent evidence.

## Pass / Fail Judgment

- **PASS** - deterministic ACP stream progress renders content, reasoning, plan, tool-call updates, session state, completion, and failure recovery in the Agentic UI without duplicate rows/cards or state-tool content leaks.
- **BLOCKED** - the run lacks interactive profile, the mock ACP agent `stream-rich`/`send-failure` fixture passes, the default `toolCall` chat component, or a supported browser/MCP execution surface.
- **FAIL** - converted stream updates do not render, duplicate assistant rows or tool cards appear, loading/input state gets stuck, retry leaves stale error/tool UI, or ACP Chat state tools leak message/tool/raw protocol content.
