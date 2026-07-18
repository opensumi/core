# Scenario: ACP Chat Agentic Keyboard Accessibility - No Mouse Critical Path

**Trigger:** `packages/ai-native/src/browser/acp/components/AcpChatInput.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatHistory.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, or `packages/ai-native/src/browser/acp/permission-dialog-container.tsx`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent uses separate `--fixture=stream-rich` passes for normal keyboard send/tool-card assertions, `--fixture=long-stream` for queued-turn Immediate Send, Escape-stop, and ArrowUp take-back assertions, `--fixture=history` for at least two sessions during history checks, `--fixture=permission` for dialog keyboard dismissal when the full-profile permission subcase runs, and stable keyboard-focus selectors are available. The deterministic tool card contains a focusable descendant so collapsed accessibility isolation can be observed. A real LLM-backed ACP agent may be used only for live keyboard send smoke coverage. **Workspace mutation:** None. **Automation status:** Automated through Chrome DevTools MCP keyboard events; live-agent runs may cover keyboard focus/send and dismissal behavior, but mock-agent fixtures remain required for stable queue, history, permission, and tool-card keyboard assertions. IME composition no-submit behavior remains covered by `acp-chat-interaction-contract.scenario.md` because this runtime lane has no stable composition-event driver.

**Acceptance coverage:** Runtime coverage for `C-11`, `C-12`, `C-13`, `D-01`, and `D-02` from `test/bdd/feat-0710-acceptance.md`; IME and exact repeat-event contracts are completed by `acp-chat-interaction-contract.scenario.md`.

## Given

- Agentic AI Chat is visible.
- The user can reach chat input from the workbench using keyboard navigation.

## When

1. Use keyboard navigation to focus the Agentic input.
2. Type `line-one`, press `Shift+Enter`, type `line-two`, and confirm a native newline is inserted without submitting.
3. Press plain `Enter` and confirm one normal submit occurs.
4. In a separate `long-stream` pass, enqueue a deterministic draft, focus the main input, and press `Shift+Cmd+Enter` on macOS or `Shift+Ctrl+Enter` on other platforms to request Immediate Send.
5. Open the mention or slash surface, then press `Shift+Alt+Escape`; confirm input expansion toggles while the transient surface stays open and focus/selection stay in the same contenteditable.
6. Press plain `Escape`; confirm it closes the transient surface first. While the long stream is still active, press plain `Escape` again and confirm it delegates to Stop only after no transient input surface remains.
7. While a later queued turn exists, leave the main input empty and press unmodified `ArrowUp`; confirm the queue tail is removed and its full draft is restored before local input-history navigation. Press `ArrowUp` again after no Queued Turn is available and confirm existing input history remains reachable.
8. Open the slash command list with `/`, navigate it with arrow keys, select, then cancel selection with Escape.
9. Open history by keyboard, move between items, select a different session, and return to input.
10. If a permission fixture is available in this profile, open a pending dialog and dismiss it by keyboard.
11. Focus a deterministic tool-call card header and record that it is a disclosure button with `aria-expanded='false'`. Press Enter to expand, keep focus on the header, then press Enter to collapse.
12. Press Space to expand and confirm the page does not scroll; keep focus on the header and press Space to collapse. Dispatch repeated Enter/Space through the deterministic contract harness and confirm repeat does not toggle again.
13. While collapsed, Tab through the surrounding UI and confirm no focus enters the mounted tool content. Record `inert` and `aria-hidden` on the content. Re-expand and confirm the descendant becomes keyboard and accessibility reachable again.

## Then

- Focus order reaches input, command surface, history, tool cards, and dialogs without trapping focus.
- `Shift+Enter` inserts a newline; plain `Enter` creates one normal user row; `Shift+Cmd+Enter` or `Shift+Ctrl+Enter` routes to Immediate Send only after matching cancellation is confirmed.
- Expansion `Shift+Alt+Escape` has priority over transient and delegated Escape handling and preserves the contenteditable node, focus, selection, draft, and attachment state.
- Plain Escape closes transient command/mention/history/dialog surfaces before it delegates to queued-edit cancellation or active-turn Stop, without clearing unrelated input.
- Empty unmodified ArrowUp takes back only the queue tail, restores its text, Mention tokens, images, agent, and command, and falls back to existing input history when no Queued Turn exists.
- Selected history item and active session state remain aligned.
- Tool-card keyboard expansion exposes arguments/result when present.
- The tool header remains focused after Enter/Space, exposes accurate `aria-expanded`, Space does not scroll, and repeated key events do not double-toggle.
- Collapsed tool content remains mounted but is `inert` and `aria-hidden`; its descendants are absent from keyboard focus and the accessibility tree until the card expands.
- IME composition no-submit remains a required deterministic contract assertion even though it is not driven by the runtime browser lane.
- No keyboard-only path requires legacy ACP tools or hidden controls.

## Live Agent Execution

- A real LLM-backed ACP agent may verify keyboard-only focus, newline/normal-submit behavior, one user row creation, loading/recovery, Escape dismissal, expansion focus preservation, and metadata-only state.
- Live-agent mode must not claim Immediate Send ordering, ArrowUp queue take-back, generated assistant content, exact history ordering, permission dialog availability, or tool-card arguments/results unless those surfaces are provided by deterministic fixtures.

## Pass / Fail Judgment

- **PASS** - core Agentic chat workflows and tool disclosures are keyboard-accessible, collapsed content is isolated, and focus/session state is preserved.
- **BLOCKED** - the run lacks interactive profile, stable focus/accessibility selectors, a deterministic focusable tool-card descendant, or the required mock ACP agent fixture pass for the subcase.
- **FAIL** - focus traps, keyboard submit fails, surfaces cannot be dismissed, tool content remains reachable while collapsed, disclosure state/focus drifts, or selection state drifts.
