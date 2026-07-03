# Scenario: ACP Chat Agentic File Link Open - Restore Workbench and Explorer

**Trigger:** `packages/ai-native/src/browser/components/ChatMarkdown.tsx`, `packages/ai-native/src/browser/layout/panel-layout.service.ts`, `packages/ai-native/src/browser/chat/AgenticChatHeaderMaximizeAction.tsx`, or editor/file-tree open-link commands.

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Agentic startup has passed, the mock ACP agent uses `--fixture=file-link`, the default Playwright workspace contains `test/test.js`, and the workspace has Explorer and editor workbench visible before maximizing. **Workspace mutation:** None. **Automation status:** Converted to deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-file-link-open.test.ts` using `fixture=file-link` and `profile=interactive`.

## Given

- Common preflight in `test/bdd/README.md` passes through Chrome DevTools MCP or Playwright.
- Agentic AI Chat is visible with Explorer and the main editor/workbench area rendered.
- The deterministic `file-link` fixture can emit bounded assistant markdown containing:
  - a plain relative workspace file path with a line range,
  - an inline-code file path with line and column,
  - an external markdown link whose label is a file path,
  - a fenced-code path that must remain plain code.

## When

1. Open the Agentic AI Chat view with the deterministic `file-link` fixture.
2. Send a deterministic prompt and wait for `BDD_FILE_LINK_READY`.
3. Record that the plain `test/test.js:L1-L2` file path renders as a clickable link in the assistant message.
4. Record that the external markdown link label renders as a single external link and does not create a nested file link.
5. Record that the fenced-code `test/test.js` text does not render as a clickable file link.
6. Click the Agentic chat header maximize action to hide the main editor/workbench and Explorer/file tree.
7. Click the plain file path link from the assistant message.
8. Record AI Chat, workbench/editor, Explorer/file tree, and current editor tab state after the click.

## Then

- Clicking a file path from the Agentic AI Chat message restores the main editor/workbench when it was hidden.
- Explorer/file tree is visible again before or during file reveal.
- The editor opens the workspace file `test/test.js`.
- The clicked file link preserves the line range intent; exact line selection may be asserted by focused unit coverage when DOM selection state is not stable in E2E.
- External markdown links whose labels look like file paths remain normal external links.
- Paths inside fenced code blocks are not converted into clickable file links.
- No fatal UI text, uncaught stack, or ACP initialization timeout appears.

## Pass / Fail Judgment

- **PASS** - the deterministic file-link message renders correct link boundaries, clicking the file link restores workbench/editor plus Explorer/file tree from the maximized chat state, and `test/test.js` opens in the editor.
- **BLOCKED** - the run lacks the interactive profile, `file-link` fixture, stable maximize selector, stable file-link selector, or default workspace file.
- **FAIL** - clicking the file link leaves the main editor or Explorer hidden, opens the wrong file, creates nested external/file anchors, links fenced-code paths, or shows fatal UI text.
