# Scenario: ACP Chat Agentic History - New Chat and Session Switching

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup and input/send scenarios have passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=history` for seeded multi-session assertions, `--fixture=stream-rich` may be used for a normal send pass, and at least two ACP sessions are visible when selection checks run. A real LLM-backed ACP agent may be used only for live session-list/switch smoke coverage. **Workspace mutation:** None. **Automation status:** Converted to `tools/playwright/src/tests/acp-chat-agentic-history.test.ts` with `fixture=history`, `profile=interactive`, deterministic seeded sessions, and metadata-only `acp_chat_list_sessions` / `acp_chat_get_session_state` assertions.

## Given

- Agentic AI Chat is visible and the active profile exposes the required `acp_chat` tools in a fresh MCP session.
- History checks run after at least one successful deterministic send, or against the mock `history` fixture's seeded sessions when the check does not need message content.
- Full session-switching assertions require at least two deterministic persisted sessions from the mock `history` fixture. If a live run only has one session, record New Chat/history metadata observations and mark the session-switching portion **BLOCKED**, not **FAIL**.
- Pending permission badge checks run only when the fixture can create pending permission state without exposing permission content.

## When

1. Click the Agentic chat header New Chat action.
2. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_NEW_CHAT`.
3. `mcp`: `acp_chat_list_sessions({})` directly or through the fallback broker -> record `SESSIONS_AFTER_NEW_CHAT`.
4. Send one short prompt through the UI in the new draft and wait for the mock `stream-rich` fixture to finish.
5. Open the Agentic chat history surface from the header.
6. Record history visibility, item count, item ids/titles/timestamps/current markers, New Chat action count, collapse/expand state, and pending permission badge counts.
7. `mcp`: `acp_chat_list_sessions({})` -> record `SESSIONS_WITH_HISTORY_OPEN`.
8. If at least two sessions are visible, select the older item, record state/header/message view, then select the newer item and record state/header/message view.
9. Collapse and reopen history.
10. If any non-active session has pending permission, record whether header/history badges show scoped counts without permission content.

## Then

- Clicking New Chat enters draft state and does not eagerly persist another empty ACP session before the next send.
- Empty draft sessions do not create duplicate `(untitled)` or `New Session` rows.
- History order matches the session list order expected by ACP, newest first by `createdAt` or first-message timestamp.
- Each visible history item has a stable session id and a non-empty safe title.
- Selected/current markers follow `acp_chat_get_session_state` after selection and reselection.
- History collapse/reopen preserves active session selection and does not duplicate header actions.
- History item titles are allowed metadata. `acp_chat_list_sessions` remains metadata-only and must not include full message bodies, assistant content, tool-call results, or permission content.
- Pending permission badges show counts/scoped state only and do not expose approval/rejection controls or permission content.

## Live Agent Execution

- A real LLM-backed ACP agent may create or load live sessions to verify New Chat, list visibility, selection switching, active-session highlighting, and metadata-only session state.
- Live-agent mode must not assert exact generated session titles, history ordering derived from model timing, full message restoration, or assistant content. Stable multi-session history hardening remains deterministic-fixture only.

## Pass / Fail Judgment

- **PASS** - New Chat draft behavior, persisted history, session selection, and badge observability stay consistent and metadata-only with at least two deterministic sessions.
- **BLOCKED** - the run lacks interactive profile, the mock ACP agent `history` fixture, at least two ACP sessions for selection checks, or a stable history selector.
- **FAIL** - empty drafts persist as history rows, selection state drifts, history leaks message/tool/permission content outside allowed title metadata, or permission badges expose decision controls/content.
