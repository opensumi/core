# Scenario: ACP Chat Agentic Command Surface - Slash and Shortcut Commands

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/chat/acp-chat-agent.ts`, or `packages/ai-native/src/browser/acp/webmcp-groups/acp-chat.webmcp-group.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich` so available commands are stable, the command picker is visible from input, and a fresh MCP session runs in a profile exposing `acp_chat_get_available_commands`. A real LLM-backed ACP agent may be used only when it exposes stable available commands for the run. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP plus `acp_chat_get_available_commands`; live-agent runs may cover command picker/send smoke, but stable mock command metadata and picker selectors are required for conversion.

## Given

- Agentic AI Chat is visible and focusable.
- `acp_chat_get_available_commands` is callable directly or through the fallback broker.

## When

1. Call `acp_chat_get_available_commands({})` and record safe command metadata.
2. Type `/` in the Agentic input to open the command surface.
3. Record visible command count, labels, descriptions, focus state, and selected item.
4. Press Escape before selecting a command and record whether the picker closes while the literal `/` remains editable user text.
5. Clear the input if needed, reopen the command surface, navigate the command list by keyboard, and select one deterministic command.
6. Record selected command chip/theme, placeholder/default input changes, and send button state.
7. Cancel the selected command and verify command state is cleared. If the input retains literal user-typed text, record it and clear it before the send check.
8. Select the command again, type a deterministic prompt, and send it.
9. Record user row command display, assistant completion, and final input state.
10. Restore a historical Agent Session through `session/load` and open `/` before and after its `available_commands_update` notification.
11. Emit a replacement command catalog for the active Session while the picker is open.

## Then

- Every ACP command returned by `acp_chat_get_available_commands` appears once in the visible command list. Product-local commands may appear in addition to the ACP metadata and are recorded separately.
- Pressing Escape while only the picker is open closes the picker and keeps the input editable; it may leave the literal `/` as user text.
- Command selection updates visible input state without sending immediately.
- Canceling a selected command removes command state and restores normal input behavior; it does not have to delete unrelated literal input text.
- Sending with a command produces one user row and one assistant response.
- A restored Session uses only its own cached command catalog; catalogs never leak across Sessions.
- `available_commands_update` replaces the complete active Session catalog and may update an already open picker without recreating the Session.
- Opening `/` reads the current cached catalog without waiting for a client-to-Agent refresh request.
- Command metadata and state tools may expose bounded session title metadata, but do not expose full prompt/message bodies, assistant content, or tool-call results.

## Live Agent Execution

- A real LLM-backed ACP agent may verify command discovery, picker navigation, selection/cancel behavior, send shell behavior, and metadata-only command/state responses when its command list is stable for the run.
- Live-agent mode must not assert generated assistant content, exact command-derived session titles, or model-specific command effects. Command catalog parity hardening requires stable command metadata in the active profile.

## Pass / Fail Judgment

- **PASS** - slash command discovery, Session-scoped refresh, restoration, selection, cancellation, send, and metadata parity work in Agentic input.
- **BLOCKED** - the run lacks interactive profile, the mock ACP agent `stream-rich` command metadata, or stable command picker selectors.
- **FAIL** - command UI drifts from metadata, the picker or selected command state gets stuck, sends duplicate rows, or leaks content through command tools.
