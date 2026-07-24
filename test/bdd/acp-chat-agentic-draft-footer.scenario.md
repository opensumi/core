# Scenario: ACP Chat Agentic Draft Footer - Lazy Session Controls

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatViewWrapper.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`, or `packages/ai-native/src/browser/components/acp/MentionInput.tsx`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich`, one deterministic send has completed so the active session exposes stable ACP `configOptions` and `availableCommands`, and a fresh MCP session runs in a profile exposing `acp_chat_get_session_state`, `acp_chat_list_sessions`, and `acp_chat_get_available_commands`. A real LLM-backed ACP agent may be used only when it exposes stable footer config options and command metadata for the run. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP plus safe ACP Chat MCP state/command tools; Playwright conversion requires deterministic fixture selectors for the footer config controls and command surface.

## Given

- Agentic AI Chat is visible and the input footer has already rendered ACP session-provided `configOptions`.
- The slash/skill command footer entry point is visible or the `/` command surface can be opened from the input.
- `acp_chat_get_available_commands` returns safe command metadata for the active fixture session.
- The check starts from an active Task created by a deterministic send, then uses the Agentic header primary New Task action to enter a fresh Task Draft.

## When

1. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_ACTIVE`.
2. `mcp`: `acp_chat_get_available_commands({})` directly or through the fallback broker -> record `COMMANDS_ACTIVE`.
3. Record the active footer config controls: count, order, selected values, disabled state, and whether legacy duplicate mode/model controls are absent when `configOptions` are present.
4. Record the slash/skill command entry point and open the command surface once to capture visible command names, focus state, and dismiss behavior.
5. Click the Agentic chat header primary New Task action without opening the adjacent Agent menu.
6. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_DRAFT`.
7. `mcp`: `acp_chat_list_sessions({})` directly or through the fallback broker -> record `SESSIONS_AFTER_NEW_CHAT`.
8. Before typing any valid prompt, record the draft footer config controls and slash/skill command entry point again.
9. Open the draft command surface with `/`, compare visible command names with `COMMANDS_ACTIVE`, then dismiss without sending.
10. Submit whitespace-only input and record state, history rows, session list count, and footer visibility.
11. Type a deterministic prompt in the draft and send it.
12. Wait for the mock `stream-rich` fixture to finish, then `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_FIRST_SEND`.

## Then

- New Task enters a draft/inactive state for the resolved Project and Agent and does not eagerly create or persist a new ACP session.
- `STATE_DRAFT` is inactive or has no active session id before the valid send, and `SESSIONS_AFTER_NEW_CHAT` has no additional empty draft row.
- The draft footer still shows the same normalized ACP config option controls that were visible on the active session, including selected values and ordering.
- The draft footer still exposes the slash/skill command entry point, and the command surface remains aligned with safe `COMMANDS_ACTIVE` metadata.
- Whitespace-only submit does not create a session, request, message row, or empty history entry, and it does not clear the draft footer controls.
- The first valid draft send creates or activates the next ACP session before writing history, and `STATE_AFTER_FIRST_SEND.result.active === true` with a non-empty raw session id that has no `acp:` prefix.
- After the first valid send, footer config controls refresh from the created session state without duplicating legacy mode/model selectors or losing command access.
- State/list/command tools remain metadata-only and do not expose full prompt bodies, assistant content, tool-call results, config secrets, or permission content.

## Live Agent Execution

- A real LLM-backed ACP agent may verify the visible draft footer, command entry point, lazy session creation, and metadata-only state when it exposes stable command/config metadata.
- Live-agent mode must not assert assistant text, model-specific command effects, exact session titles, or generated tool choices. Deterministic fixture coverage is required before Playwright conversion.

## Pass / Fail Judgment

- **PASS** - New Task keeps the Agentic draft footer usable without creating a session, whitespace-only input stays inert, and the first valid send creates the ACP session while preserving footer config and command access.
- **BLOCKED** - the run lacks interactive profile, deterministic `stream-rich` config/command metadata, a stable primary New Task action, or stable footer/command selectors.
- **FAIL** - draft footer config options or slash/skill commands disappear before first send, New Task opens the Agent menu or eagerly creates an empty session, whitespace creates a session, first valid send fails from draft, duplicate controls render, or safe tools leak content.
