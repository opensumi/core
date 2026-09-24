# Scenario: ACP Chat Agentic Rich History Restore - Complex Response Replay

**Trigger:** `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/acp-session-provider.ts`, `packages/ai-native/src/browser/chat/chat-manager.service.acp.ts`, or `packages/ai-native/src/browser/model/msg-history-manager.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=history`; it seeds at least two sessions, emits bounded rich replay updates on `session/load`, and emits `stream-rich` style content after a deterministic prompt so one session can contain completed content, reasoning, plan, and tool-call result updates. A real LLM-backed ACP agent may be used only for live restore smoke coverage. A fresh MCP session runs in a profile exposing `acp_chat_list_sessions`. **Workspace mutation:** None. **Automation status:** Converted to `tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts` with `fixture=history`, `profile=interactive`, deterministic session switching, bounded reload recovery, and metadata-only state/list assertions.

## Given

- Agentic AI Chat is visible.
- At least one ACP session has a completed deterministic rich response produced by the mock `history` fixture after a prompt.
- The mock `history` fixture can reload the same session after page reload or session switching.

## When

1. Open the session that contains the completed rich response.
2. Record visible user rows, assistant rows, reasoning UI, plan content, tool-call cards, and expanded tool result state.
3. Open another ACP session, then switch back to the rich-response session from history.
4. Record the same visible elements again.
5. Reload the page without changing the workspace URL.
6. Wait for Agentic AI Chat and history to recover.
7. Reopen the rich-response session if needed and record restored rows/cards.
8. Call `acp_chat_get_session_state({})` and, if exposed, `acp_chat_list_sessions({})`.

## Then

- Switching away and back restores the same active session id and safe title.
- The Agent Session Browser row uses the Agent-returned title rather than deriving one from the local prompt.
- The user row and final assistant row are restored once, without duplicate rows.
- Completed reasoning, plan content, and tool-call result remain associated with the same assistant response.
- Expanded/collapsed UI state may reset, but the underlying tool-call card and result remain visible after expansion.
- Reload does not create an empty duplicate session and does not leave the recovered chat in loading state.
- State and list tools expose metadata only. Safe titles are allowed, but rich message bodies and tool results are not.

## Live Agent Execution

- A real LLM-backed ACP agent may verify that existing live sessions can be reopened after switching or reload and that state/list tools remain metadata-only.
- Live-agent mode must not assert exact restored user/assistant text, reasoning, plan, tool result content, or generated titles. Complex replay and duplicate-row hardening remain deterministic-fixture only.

## Pass / Fail Judgment

- **PASS** - complex Agentic response history survives session switching and reload without duplicates, stale loading, or metadata leaks.
- **BLOCKED** - the run lacks interactive profile, the mock ACP agent `history` rich-history fixture, or at least two sessions.
- **FAIL** - reload/switch loses rich response structure, duplicates rows/cards, drifts session selection, or leaks content through state/list tools.
