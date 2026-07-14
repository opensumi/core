# Scenario: ACP Chat Agentic Keyboard Accessibility - No Mouse Critical Path

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatHistory.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, or `packages/ai-native/src/browser/acp/permission-dialog-container.tsx`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent uses separate `--fixture=stream-rich` passes for normal keyboard send/tool-card assertions, `--fixture=long-stream` for queued-turn Immediate Send, Escape-stop, and ArrowUp take-back assertions, `--fixture=history` for at least two sessions during history checks, `--fixture=permission` for dialog keyboard dismissal when the full-profile permission subcase runs, and stable keyboard-focus selectors are available. A real LLM-backed ACP agent may be used only for live keyboard send smoke coverage. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP keyboard events; live-agent runs may cover keyboard focus/send and dismissal behavior, but mock-agent fixtures remain required for stable queue, history, permission, and tool-card keyboard assertions.

## Given

- Agentic AI Chat is visible.
- The user can reach chat input from the workbench using keyboard navigation.

## When

1. Use keyboard navigation to focus the Agentic input.
2. Type `line-one`, press `Shift+Enter`, type `line-two`, and confirm a native newline is inserted without submitting.
3. Press plain `Enter` and confirm one normal submit occurs. During IME composition, confirm Enter and the Immediate Send chord do not submit.
4. In a separate `long-stream` pass, enqueue a deterministic draft, focus the main input, and press `Shift+Cmd+Enter` on macOS or `Shift+Ctrl+Enter` on other platforms to request Immediate Send.
5. Open the mention or slash surface, then press `Shift+Alt+Escape`; confirm input expansion toggles while the transient surface stays open and focus/selection stay in the same contenteditable.
6. Press plain `Escape`; confirm it closes the transient surface first. While the long stream is still active, press plain `Escape` again and confirm it delegates to Stop only after no transient input surface remains.
7. While a later queued turn exists, leave the main input empty and press unmodified `ArrowUp`; confirm the queue tail is removed and its full draft is restored before local input-history navigation. Press `ArrowUp` again after no Queued Turn is available and confirm existing input history remains reachable.
8. Open the slash command list with `/`, navigate it with arrow keys, select, then cancel selection with Escape.
9. Open history by keyboard, move between items, select a different session, and return to input.
10. If a permission fixture is available in this profile, open a pending dialog and dismiss it by keyboard.
11. Expand and collapse a tool-call card by keyboard if the card is present.

## Then

- Focus order reaches input, command surface, history, tool cards, and dialogs without trapping focus.
- `Shift+Enter` inserts a newline; plain `Enter` creates one normal user row; `Shift+Cmd+Enter` or `Shift+Ctrl+Enter` routes to Immediate Send only after matching cancellation is confirmed.
- Expansion `Shift+Alt+Escape` has priority over transient and delegated Escape handling and preserves the contenteditable node, focus, selection, draft, and attachment state.
- Plain Escape closes transient command/mention/history/dialog surfaces before it delegates to queued-edit cancellation or active-turn Stop, without clearing unrelated input.
- Empty unmodified ArrowUp takes back only the queue tail, restores its text, Mention tokens, images, agent, and command, and falls back to existing input history when no Queued Turn exists.
- Selected history item and active session state remain aligned.
- Tool-card keyboard expansion exposes arguments/result when present.
- No keyboard-only path requires legacy ACP tools or hidden controls.

## Live Agent Execution

- A real LLM-backed ACP agent may verify keyboard-only focus, newline/normal-submit behavior, one user row creation, loading/recovery, Escape dismissal, expansion focus preservation, and metadata-only state.
- Live-agent mode must not claim Immediate Send ordering, ArrowUp queue take-back, generated assistant content, exact history ordering, permission dialog availability, or tool-card arguments/results unless those surfaces are provided by deterministic fixtures.

## Pass / Fail Judgment

- **PASS** - core Agentic chat workflows are keyboard-accessible and preserve focus/session state.
- **BLOCKED** - the run lacks interactive profile, stable focus selectors, or the required mock ACP agent fixture pass for the subcase.
- **FAIL** - focus traps, keyboard submit fails, surfaces cannot be dismissed, or selection state drifts.
