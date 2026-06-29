# Scenario: ACP Chat Agentic Context Attachments - Files, Folders, Code, Rules

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatMentionInput.tsx`, `packages/ai-native/src/browser/components/acp/MentionInput.tsx`, `packages/ai-native/src/browser/components/chat-context/**`, or `packages/ai-native/src/browser/chat/chat.view.acp.tsx`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, workspace contains `editor.js`, `test/test.js`, and an optional rule fixture, the mock ACP agent is configured as `node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --fixture=stream-rich` for deterministic attachment send shell coverage, and a fresh MCP session runs in a profile exposing the required `acp_chat` tools. A real LLM-backed ACP agent may be used only for live attachment send smoke coverage. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP; live-agent runs may cover picker/chip/send shell behavior, but required workspace fixtures, the mock send fixture, and stable context picker selectors remain mandatory for conversion.

## Given

- Agentic AI Chat is visible and the input supports context chips or attachment controls.
- The workspace fixture contains stable files and folders.

## When

1. Open the context picker from the Agentic input.
2. Select a file context and record visible chip text and remove control.
3. Select a folder context if the picker exposes folders.
4. Select a code-range context from the active editor if available.
5. Select a rule context if rules are exposed.
6. Remove one selected chip and verify it disappears.
7. Send a deterministic prompt with the remaining selected contexts.
8. Record user row display, assistant response, final input value, and chip cleanup state.
9. Record `acp_chat_get_session_state({})`, and if exposed, `acp_chat_prepare_session_digest({ sourceSessionId })` for metadata-only boundaries.

## Then

- Context chips show safe display names, not raw absolute paths when a workspace-relative label is available.
- Removing a chip prevents it from being sent.
- Sent user row renders readable context labels without exposing hidden attachment payload wrappers.
- Input clears after successful send and does not retain stale chips.
- State/digest tools do not expose raw attached file content unless that tool's bounded contract explicitly returns a digest.
- Missing optional context types are recorded as skipped within the scenario, not as failure.

## Live Agent Execution

- A real LLM-backed ACP agent may verify context picker visibility, chip add/remove behavior, send shell behavior with selected context, input cleanup, and metadata-only state/digest boundaries when deterministic fixture mode is not required.
- Live-agent mode must not assert generated assistant content, hidden attachment payloads chosen by the model, exact digest text, or full file contents. Attachment cleanup and payload-safety hardening should use deterministic fixtures or bounded protocol records.

## Pass / Fail Judgment

- **PASS** - Agentic context selection, removal, send display, and cleanup are stable and metadata-safe.
- **BLOCKED** - the run lacks interactive profile, required workspace files, the mock ACP agent `stream-rich` send fixture, or a stable context picker.
- **FAIL** - stale attachments are sent, chips cannot be removed, raw payloads leak, or send corrupts the input state.
