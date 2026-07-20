# Scenario: Agentic Cross-Project Session Activation

**Trigger:** `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts`, `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** Disposable current and secondary Project workspaces, deterministic history sessions in both Projects, a dirty current-workspace editor, and one persisted unavailable Project. **Workspace mutation:** Fixture setup may create disposable workspaces and dirty a fixture editor; runtime actions must remain in the current IDE workspace and must not mutate a user workspace. **Automation status:** Converted to deterministic Playwright coverage in `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts` for in-place cross-Project activation, working-directory context, Project-group launch, and unavailable-Project filtering.

## Given

- The IDE is open in `Project Current` with a dirty editor.
- `Project Other` has an activatable Task, and `Project Missing` has a cwd that does not exist.

## When

1. Click the Task from `Project Other` while the dirty current-workspace editor remains open.
2. Inspect session state, browser URL, workspace cwd, Explorer, dirty editor, dialogs, and the Agent working-directory indicator.
3. Click `Project Other`'s Project-group `+`, then use Header `New Task` while the foreign Task is selected.
4. Inspect active and archived content, search, counts, attention, and launch surfaces for `Project Missing`.

## Then

- Cross-Project selection activates the ACP session in place and clears unread only after success.
- Browser URL, IDE workspace cwd, Explorer, and dirty editor remain unchanged; no save/discard/cancel workspace-switch dialog appears.
- The chat header exposes the foreign Agent working directory with the complete cwd in its hover title.
- Project-group and header launches target `Project Other` without navigation, reload, or dirty-editor guard.
- The unavailable Project remains persisted for recovery but is absent from active/archived rows, search, counts, attention, Agent selection, and launch controls; its cwd never reaches `workspaceService.open`.

## Pass / Blocked Judgment

- **PASS** - cross-Project sessions and drafts activate in place with the correct working directory while the IDE workspace and dirty editor remain untouched.
- **BLOCKED** - the disposable workspaces, dirty editor, multi-Project fixture, or stable session/working-directory selectors are unavailable.
- **FAIL** - the workbench navigates, a dirty-editor dialog opens, the wrong session/cwd activates, unread clears on failure, or the missing cwd is opened.

## Codegen Plan

- Keep the existing Task Workbench spec as the single hardened browser workflow for this scenario; do not create a duplicate cross-Project spec.
