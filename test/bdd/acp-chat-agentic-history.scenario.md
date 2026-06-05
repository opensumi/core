# Scenario: ACP Chat Agentic History - New Chat and Session Switching

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup and input/send scenarios have passed, deterministic ACP provider, and at least two ACP sessions when selection checks run. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP plus `acp_chat_list_sessions`.

## Given

- Agentic AI Chat is visible and has `acp_chat` enabled in a fresh MCP session.
- History checks run after at least one successful deterministic send.
- Pending permission badge checks run only when the fixture can create pending permission state without exposing permission content.

## When

1. Click the Agentic chat header New Chat action.
2. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_NEW_CHAT`.
3. `mcp`: `acp_chat_list_sessions({})` directly or through the fallback broker -> record `SESSIONS_AFTER_NEW_CHAT`.
4. Send one short prompt through the UI in the new draft and wait for the deterministic provider to finish.
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
- History item titles and `acp_chat_list_sessions` results remain metadata-only.
- Pending permission badges show counts/scoped state only and do not expose approval/rejection controls or permission content.

## Pass / Fail Judgment

- **PASS** - New Chat draft behavior, persisted history, session selection, and badge observability stay consistent and metadata-only.
- **BLOCKED** - the run lacks interactive profile, deterministic provider, or at least two ACP sessions for selection checks.
- **FAIL** - empty drafts persist as history rows, selection state drifts, history leaks content, or permission badges expose decision controls/content.
