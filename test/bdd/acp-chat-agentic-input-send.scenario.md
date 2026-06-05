# Scenario: ACP Chat Agentic Input and Send - Draft Lifecycle and Recovery

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** `acp-chat-agentic-startup.scenario.md` has passed, deterministic ACP provider or safe local fallback provider, and fresh MCP session with `acp_chat` enabled. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP; blocked if no deterministic send/failure fixture is available.

## Given

- The Agentic chat surface is visible and focusable.
- Parts that send a message run against a deterministic ACP provider or a safe local fallback provider.
- The scenario must not assert prompt text, assistant response text, or tool-call result content through ACP Chat state tools.

## When

1. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_BEFORE_SEND`.
2. Record the visible empty/welcome state, header title, close action, input editor state, placeholder, send action state, shortcut command buttons, and model/mode controls if rendered.
3. Focus the input, type whitespace only, and attempt to submit.
4. Record whether any user message row was added and whether the send action stayed disabled.
5. Type a multi-line prompt using `Shift+Enter`, then submit with the normal send shortcut or send button.
6. Wait until the input returns to an idle editable state or the deterministic provider emits a terminal assistant update.
7. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_SEND`.
8. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_AFTER_SEND`.
9. Record user message count, assistant message count, duplicate ids/rows, loading controls, final input value, and whether the latest message is visible.
10. Open the slash command surface by typing `/`, select one visible command, and record command list focus plus selected command chip/theme.
11. If `acp_chat_get_available_commands` is exposed, compare visible command names with tool results.
12. Open the mention/context picker by typing `@`, select `editor.js` or the current editor when available, and remove the chip.
13. If attachment controls are enabled, attach a small test file, verify preview/remove state, remove it, and verify no stale attachment is sent.
14. With the message list taller than the viewport, verify bottom auto-scroll for new output and verify an upward user scroll is not overwritten until a new send or explicit bottom-scroll action.
15. Run a deterministic create-session or send failure fixture, record visible recovery state, then retry with a successful fixture.

## Then

- Whitespace-only submits do not create a session, message, or request.
- If `STATE_BEFORE_SEND` is draft/inactive, the first valid send creates or activates an ACP session before writing history.
- `STATE_AFTER_SEND.result.active === true`, with non-empty `sessionId` and a raw id that has no `acp:` prefix.
- The input preserves line breaks before send, clears after successful send, and is disabled only while session creation or sending is active.
- The user message appears exactly once and before the assistant response.
- Assistant loading/streaming renders a single active row and resolves to a stable final row without duplicate ids or duplicate DOM rows.
- Send/cancel/stop controls reflect loading state and do not expose old direct ACP tools.
- Commands, mentions, and attachments update visible chips/control state without leaking raw payloads through state, list, or permission tools.
- User-visible errors re-enable input, clear stale loading/error state after retry, and do not persist half-created empty sessions.

## Pass / Fail Judgment

- **PASS** - draft input, first send, commands, mentions, attachments, scroll, and recovery behave as a complete Agentic chat surface.
- **BLOCKED** - the run lacks interactive profile or a deterministic send/failure fixture.
- **FAIL** - valid sends fail, duplicate messages appear, raw content leaks through state tools, or recovery leaves stale loading/session state.
