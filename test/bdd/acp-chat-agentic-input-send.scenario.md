# Scenario: ACP Chat Agentic Input and Send - Draft Lifecycle and Recovery

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** `acp-chat-agentic-startup.scenario.md` has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich` for successful send assertions, separate `--fixture=create-failure` and `--fixture=send-failure` passes cover recovery assertions, and a fresh MCP session runs in a profile exposing the required `acp_chat` tools. A real LLM-backed ACP agent may be used only for live shell/send coverage. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP; live-agent runs may proceed without the mock send/failure fixture only for stable shell and metadata checks. Fixture-only failure/retry assertions require the mock ACP agent fixture passes.

## Given

- The Agentic chat surface is visible and focusable.
- Parts that send a message run against the process-level mock ACP agent through the real `AcpThread` stdio/JSON-RPC path.
- First-send assertions start from a fresh draft. If the page opens on an existing or stale active session, click New Chat before Step 1; record any stale-session send failure as reload/session-recovery evidence instead of the primary input-send verdict.
- The scenario may assert bounded session title metadata, but must not assert full prompt/message bodies, assistant response text, or tool-call result content through ACP Chat state tools.

## When

1. Ensure the Agentic input is in a fresh draft/New Chat state, then `mcp`: `acp_chat_get_session_state({})` -> record `STATE_BEFORE_SEND`.
2. Record the visible empty/welcome state, header title, close action, input editor state, placeholder, send action state, shortcut command buttons, and model/mode controls if rendered.
3. Focus the input, type whitespace only, and attempt to submit.
4. Record whether any user message row was added and whether the send action stayed disabled.
5. Type a multi-line prompt using `Shift+Enter`, then submit with the normal send shortcut or send button.
6. Wait until the input returns to an idle editable state or the mock `stream-rich` fixture emits a terminal assistant update.
7. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_SEND`.
8. `mcp`: `acp_chat_get_permission_state({})` -> record `PERMISSION_AFTER_SEND`.
9. Record user message count, assistant message count, duplicate ids/rows, loading controls, final input value, and whether the latest message is visible.
10. Open the slash command surface by typing `/`, select one visible command, and record command list focus plus selected command chip/theme.
11. If `acp_chat_get_available_commands` is exposed, compare visible command names with tool results.
12. Open the mention/context picker by typing `@`, select `editor.js` or the current editor when available, and remove the chip.
13. If attachment controls are enabled, attach a small test file, verify preview/remove state, remove it, and verify no stale attachment is sent.
14. With the message list taller than the viewport, verify bottom auto-scroll for new output and verify an upward user scroll is not overwritten until a new send or explicit bottom-scroll action.
15. Run the mock ACP agent once with `--fixture=create-failure` and once with `--fixture=send-failure`, record visible recovery state for each pass, then retry with `--fixture=stream-rich`.

## Then

- Whitespace-only submits do not create a session, message, or request.
- `STATE_BEFORE_SEND` is draft/inactive before first-send checks, and the first valid send creates or activates an ACP session before writing history.
- `STATE_AFTER_SEND.result.active === true`, with non-empty `sessionId` and a raw id that has no `acp:` prefix.
- The input preserves line breaks before send, clears after successful send, and is disabled only while session creation or sending is active.
- The user message appears exactly once and before the assistant response.
- Assistant loading/streaming renders a single active row and resolves to a stable final row without duplicate ids or duplicate DOM rows.
- Send/cancel/stop controls reflect loading state and do not expose old direct ACP tools.
- Commands, mentions, and attachments update visible chips/control state without leaking raw payloads through state, list, or permission tools outside allowed title metadata.
- User-visible errors re-enable input, clear stale loading/error state after retry, and do not persist half-created empty sessions.

## Live Agent Execution

- A real LLM-backed ACP agent may verify input focus, draft/send lifecycle, user row creation, loading or streaming transition, input recovery, and metadata-only state.
- Live-agent mode must not assert generated assistant text, exact response timing, model-selected tool choices, command-derived titles, or retry content. Failure injection and retry hardening still require a deterministic fixture before Playwright conversion.

## Pass / Fail Judgment

- **PASS** - draft input, first send, commands, mentions, attachments, scroll, and recovery behave as a complete Agentic chat surface.
- **BLOCKED** - the run lacks interactive profile, the mock ACP agent `stream-rich`/failure fixture passes, or a stable New Chat/fresh draft entry point.
- **FAIL** - valid sends from the fresh draft fail, duplicate messages appear, raw message/tool content leaks through state tools outside allowed title metadata, or recovery leaves stale loading/session state.
