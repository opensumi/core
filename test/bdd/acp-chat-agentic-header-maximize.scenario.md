# Scenario: ACP Chat Agentic Header Maximize - Title, Collapse, and Restore

**Trigger:** `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx`, `packages/ai-native/src/browser/chat/AgenticChatHeaderMaximizeAction.tsx`, `packages/ai-native/src/browser/chat/chat.view.acp.tsx`, `packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx`, `packages/ai-native/src/browser/layout/ai-layout.tsx`, or `packages/ai-native/src/browser/layout/panel-layout.service.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent uses `--fixture=history`, seeded ACP sessions are visible in history, and the workspace has Explorer and editor workbench visible before maximizing. **Workspace mutation:** None. **Automation status:** Converted to deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-header-maximize.test.ts` using `fixture=history` and `profile=interactive`.

## Given

- Common preflight in `test/bdd/README.md` passes through Chrome DevTools MCP or Playwright.
- Agentic AI Chat is visible with Explorer and the main editor/workbench area rendered.
- The history fixture provides deterministic sessions titled `BDD History alpha` and `BDD History beta`.

## When

1. Open the Agentic AI Chat view with the deterministic history fixture.
2. Open chat history and activate the newer seeded session.
3. Record the visible chat header title and compare it with the active session title returned by `acp_chat_get_session_state({})`.
4. Click the chat header maximize action.
5. Record AI Chat, workbench/editor, Explorer geometry, and the header action accessible name and icon after the click.
6. Click the same chat header action again.
7. Record restored AI Chat, workbench/editor, Explorer geometry, and the header action icon.

## Then

- The chat header displays the active session title from ACP session metadata.
- With the workbench visible, the action is explicitly named `Focus AI Chat`.
- After the workbench is collapsed, the same action is explicitly named `Restore editor and Explorer` and switches to the shrink/restore icon.
- Clicking maximize calls the Agentic workbench collapse path: AI Chat remains visible and expands to occupy the main body.
- The main editor/workbench area and Explorer/file tree are no longer visibly rendered after maximize.
- Clicking the shrink/restore action restores the main editor/workbench area and Explorer/file tree.
- The active session state remains metadata-only and keeps the same active session title.
- No fatal UI text, uncaught stack, or ACP initialization timeout appears.

## Pass / Fail Judgment

- **PASS** - the active session title is visible in the chat header, maximize leaves AI Chat visible, the header action switches to shrink/restore, and the second click restores the workbench/editor plus Explorer/file tree.
- **BLOCKED** - the run lacks the interactive profile, the history fixture, stable chat header selectors, or a visible Agentic workbench before the maximize action.
- **FAIL** - the header title does not match active session metadata, maximize does not collapse the workbench, the action does not switch to shrink/restore, restore does not bring back the workbench, AI Chat disappears, or the active session state is lost.
