# Scenario: ACP Chat Agentic Editor Target Reveal - Settings Opens Visible Workbench

**Trigger:** `packages/ai-native/src/browser/layout/panel-layout.service.ts`, `packages/preferences/src/browser/preference-contribution.ts`, `packages/editor/src/browser/workbench-editor.service.ts`, or any foreground editor-hosted workbench target.

**Layer:** `runtime-ui` **Required profile:** `default` **Fixtures:** Agentic startup has passed, the mock ACP agent uses `--fixture=stream-rich`, the default Playwright workspace is available, and Settings can be opened through the standard preference command/keybinding. **Workspace mutation:** None. **Automation status:** Converted to deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-editor-target-reveal.test.ts` using `fixture=stream-rich` and `profile=default`.

## Given

- Common preflight in `test/bdd/README.md` passes through Chrome DevTools MCP or Playwright.
- Agentic AI Chat is visible.
- The main editor/workbench area is hidden, or the Agentic chat header maximize action can hide it.

## When

1. Open the Agentic AI Chat view with the deterministic `stream-rich` fixture.
2. If the workbench/editor area is visible, click the Agentic chat header maximize action to hide it.
3. Record that AI Chat remains visible while the workbench/editor area is hidden.
4. Open Settings through the standard preferences entrypoint.
5. Record AI Chat, workbench/editor, and Settings visibility after the command.

## Then

- Opening Settings restores the main editor/workbench when it was hidden.
- The Settings editor is visible inside the restored workbench.
- The restored workbench remains visible until the user explicitly hides it again.
- No fatal UI text, uncaught stack, or ACP initialization timeout appears.

## Pass / Fail Judgment

- **PASS** - the Settings command restores the hidden Agentic workbench and shows the Settings editor.
- **BLOCKED** - the run lacks the default profile, `stream-rich` fixture, stable maximize selector, stable Settings entrypoint, or default workspace.
- **FAIL** - opening Settings leaves the main editor hidden, fails to render Settings, immediately hides the restored workbench again, or shows fatal UI text.
