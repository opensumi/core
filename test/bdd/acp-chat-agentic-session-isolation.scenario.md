# Scenario: ACP Chat Agentic Session Isolation - Concurrent Status and Updates

**Trigger:** `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`, `packages/ai-native/src/browser/chat/chat-manager.service.acp.ts`, or `packages/ai-native/src/node/acp/acp-agent.service.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** The mock ACP agent uses `--fixture=history` for two deterministic ACP sessions, `--fixture=long-stream` for a controlled active stream, and `--fixture=stream-rich` for completed stream assertions. A deterministic delayed-activation seam keeps one Session switch pending long enough to inspect its loading and disabled-control state. A real LLM-backed ACP agent may be used only for live two-session smoke coverage. The Agent Tasks list is available, and a fresh MCP session runs in a profile exposing `acp_chat_get_session_state` and `acp_chat_list_sessions`. **Workspace mutation:** None. **Automation status:** Agent Tasks session isolation is converted to `tools/playwright/src/tests/acp-chat-agentic-session-isolation.test.ts` with `fixture=history`, `profile=interactive`, two Tasks created through the normal first-prompt flow, deterministic per-session send/switch assertions, and metadata-only state/list checks. Concurrent long-stream isolation and delayed-switch accessibility remain runtime BDD/Jest-backed until their fixture seams are converted.

## Given

- Agentic AI Chat is visible.
- Session A can stream for a controlled duration with the mock `long-stream` fixture.
- Session B can complete a short deterministic response with the mock `stream-rich` fixture, or the subcase is recorded as blocked if the harness cannot switch fixtures while preserving both sessions.

## When

### Converted Agent Tasks subcase

1. Create Session A and Session B through the normal Agentic first-prompt flow so both appear in Agent Tasks.
2. Select Session A and Session B from Agent Tasks and record each completed baseline shell.
3. Send one additional deterministic prompt in Session A and wait for completion.
4. Switch to Session B and verify its baseline shell has not changed.
5. Send one additional deterministic prompt in Session B and wait for completion.
6. Switch back and forth through Agent Tasks and verify each Session restores only its own two turns.
7. Record `acp_chat_get_session_state({})` and `acp_chat_list_sessions({})` and verify each Session reports two requests without content leakage.

### Concurrent and delayed-activation subcase

1. Select or create Session A.
2. Start a long-running deterministic stream in Session A.
3. Switch to Session B from the history surface while Session A is still working.
4. Before delayed activation settles, record the message-region role/text/busy state, queue controls, main input, Send/Stop action, and mode/model/config controls.
5. Complete the activation, send a short deterministic prompt in Session B, and wait for completion.
6. Record visible rows, loading state, and current session marker.
7. Let Session A emit more stream updates while Session B remains selected.
8. Record whether Session B DOM changes.
9. Switch back to Session A and record its stream/status state.
10. Record `acp_chat_get_session_state({})` and `acp_chat_list_sessions({})`.

## Then

- Session B does not receive Session A content, reasoning, tool cards, status, or permission badges.
- During delayed activation, the message region exposes `role='status'`, `aria-busy='true'`, and `Loading chat…`; submission, queue actions, Send/Stop, and footer configuration are disabled while request-loading remains false.
- When activation completes, the loading surface is removed and Session B controls become usable according to its own state.
- Session A working status remains scoped to Session A while another session is selected.
- Session B can send and complete while Session A is still active or pending.
- Switching back to Session A shows only Session A rows and active status.
- Current markers and state tool active session id agree after each selection.
- List/state tools remain metadata-only.

## Live Agent Execution

- A real LLM-backed ACP agent may verify that two live sessions can be listed, selected, and kept visually separate while state/list tools remain metadata-only.
- Live-agent mode must not assert concurrent stream timing, exact status transitions, exact history order, or model-generated content per session. Wrong-session update isolation remains deterministic-fixture only.

## Pass / Fail Judgment

- **PASS** - concurrent Agentic session updates remain isolated in visible UI, history, and metadata.
- **BLOCKED** - the run lacks interactive profile, two deterministic sessions, controllable long-stream fixture, or a harness that can preserve sessions across the required fixture passes.
- **FAIL** - cross-session updates appear in the wrong chat, active markers drift, or a non-active session blocks the active session UI.
