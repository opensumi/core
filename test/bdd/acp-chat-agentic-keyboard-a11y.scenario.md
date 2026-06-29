# Scenario: ACP Chat Agentic Keyboard Accessibility - No Mouse Critical Path

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatHistory.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, or `packages/ai-native/src/browser/acp/permission-dialog-container.tsx`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent uses `--fixture=stream-rich` for keyboard send/tool-card assertions, `--fixture=history` for at least two sessions during history checks, `--fixture=permission` for dialog keyboard dismissal when the full-profile permission subcase runs, and stable keyboard-focus selectors are available. A real LLM-backed ACP agent may be used only for live keyboard send smoke coverage. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP keyboard events; live-agent runs may cover keyboard focus/send and dismissal behavior, but mock-agent fixtures remain required for stable history, permission, and tool-card keyboard assertions.

## Given

- Agentic AI Chat is visible.
- The user can reach chat input from the workbench using keyboard navigation.

## When

1. Use keyboard navigation to focus the Agentic input.
2. Type a multi-line deterministic prompt with keyboard only.
3. Submit with the supported keyboard shortcut.
4. Open the slash command list with `/`, navigate it with arrow keys, select, then cancel selection with Escape.
5. Open history by keyboard, move between items, select a different session, and return to input.
6. If a permission fixture is available in this profile, open a pending dialog and dismiss it by keyboard.
7. Expand and collapse a tool-call card by keyboard if the card is present.

## Then

- Focus order reaches input, command surface, history, tool cards, and dialogs without trapping focus.
- Keyboard submit creates one user row and one assistant response.
- Escape closes transient command/history/dialog surfaces without clearing unrelated input unexpectedly.
- Selected history item and active session state remain aligned.
- Tool-card keyboard expansion exposes arguments/result when present.
- No keyboard-only path requires legacy ACP tools or hidden controls.

## Live Agent Execution

- A real LLM-backed ACP agent may verify keyboard-only focus, multi-line submit, one user row creation, loading/recovery, Escape dismissal, and metadata-only state.
- Live-agent mode must not assert generated assistant content, exact history ordering, permission dialog availability, or tool-card arguments/results unless those surfaces are provided by deterministic fixtures.

## Pass / Fail Judgment

- **PASS** - core Agentic chat workflows are keyboard-accessible and preserve focus/session state.
- **BLOCKED** - the run lacks interactive profile, stable focus selectors, or the required mock ACP agent fixture pass for the subcase.
- **FAIL** - focus traps, keyboard submit fails, surfaces cannot be dismissed, or selection state drifts.
