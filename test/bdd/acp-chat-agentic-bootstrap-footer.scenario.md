# Scenario: ACP Chat Agentic Bootstrap Footer - Cold Start Metadata

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatViewWrapper.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, or `packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich`, and a fresh MCP session exposes `acp_chat_get_session_state`, `acp_chat_list_sessions`, and `acp_chat_get_available_commands`. The fixture's `session/new` response includes stable `configOptions`, modes, models, and safe command metadata. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP plus safe ACP Chat MCP state/list/command tools; Playwright conversion requires deterministic selectors for footer config controls, model/mode affordances, and command entry points.

## Given

- The IDE opens directly into Agentic ACP chat from a fresh browser/runtime profile.
- No user prompt has been submitted in the ACP chat input.
- ACP initialization has completed and the mock agent can answer `session/new`.

## When

1. Wait until the ACP chat surface is visible and the initializing progress indicator is gone.
2. `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_STARTUP`.
3. `mcp`: `acp_chat_get_available_commands({})` directly or through the fallback broker -> record `COMMANDS_AFTER_STARTUP`.
4. Record the visible footer config controls, selected config values, model/mode controls, and slash/skill command entry point before typing any prompt.
5. Open the history list and record visible history rows.
6. Submit whitespace-only input and record session state, history rows, and footer controls again.
7. Type a deterministic prompt and send it.
8. Wait until the mock `stream-rich` fixture finishes, then `mcp`: `acp_chat_get_session_state({})` -> record `STATE_AFTER_FIRST_SEND`.
9. Open the history list again and record visible history rows.

## Then

- Cold startup creates exactly one reusable ACP bootstrap session before the first user prompt.
- Before the first prompt, the footer shows ACP session-provided config controls, model/mode affordances, and slash/skill command access.
- `STATE_AFTER_STARTUP.result.active === true` and its raw session id has no `acp:` prefix.
- `COMMANDS_AFTER_STARTUP` contains the safe fixture command metadata used by the slash/skill command surface.
- The empty bootstrap session is hidden from visible chat history before user content is sent.
- Whitespace-only input does not create another session, request, message row, or visible history entry, and it does not clear the footer controls.
- The first valid prompt reuses the bootstrap session instead of issuing a second `session/new`.
- After the first valid send, the same session appears as a normal visible history row with user content or a derived title.
- State/list/command tools remain metadata-only and do not expose full prompt bodies, assistant content, tool-call results, config secrets, or permission content.

## Live Agent Execution

- A real LLM-backed ACP agent may verify the visible cold-start footer and first-send session reuse when it exposes stable command/config metadata.
- Live-agent mode must not assert assistant text, model-specific command effects, exact generated titles, or generated tool choices. Deterministic fixture coverage is required before Playwright conversion.

## Pass / Fail Judgment

- **PASS** - cold startup renders footer metadata through one reusable bootstrap session, keeps the empty session out of visible history, ignores whitespace-only submit, and reuses that session for the first valid prompt.
- **BLOCKED** - the run lacks interactive profile, deterministic `stream-rich` config/command metadata, stable footer/history selectors, or safe MCP state/list/command tools.
- **FAIL** - footer config/model/mode/command controls are missing before first prompt, startup creates multiple ACP sessions, empty bootstrap appears in visible history, whitespace creates a session/request/history row, first valid send creates a second session, or safe tools leak content.
