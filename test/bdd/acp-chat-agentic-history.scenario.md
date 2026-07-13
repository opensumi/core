# Scenario: Agentic Task Workbench - Header Launch, Project-Bound Activation, and Safe Restore

**Trigger:** `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx`, `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx`, `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts`, `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** A deterministic ACP `history` fixture with at least two named agents; the default workspace; a second existing workspace; fixture-local registry state containing (a) a current-workspace Project with two Tasks, (b) a second existing Project with one Task, and (c) an unavailable Project whose cwd does not exist. Dirty-editor branches require a controllable dirty-editor dialog fixture. **Workspace mutation:** The fixture may switch only between its two disposable workspaces and must restore the default workspace. It must not delete or mutate a user workspace. **Automation status:** Current-workspace lifecycle and persistence are converted in `tools/playwright/src/tests/acp-chat-agentic-history.test.ts` and `tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts`. Header-launch placement, unavailable-project filtering, and multi-workspace switching require the expanded deterministic catalog fixture described above.

## Given

1. The IDE starts in Agentic Layout with the Task List, Main Conversation Area, file tree, and editor visible together.
2. The fixture exposes two selectable ACP Agents, `Agent A` and `Agent B`.
3. The registry contains these immutable records:
   - `Project Current`: cwd is the default workspace; Tasks `Current newer` and `Current older` are ready.
   - `Project Other`: cwd is the second disposable workspace; Task `Other ready` is ready.
   - `Project Missing`: cwd is absent; Task `Missing ready` is ready but unavailable.
4. The currently active workspace is `Project Current`, and the active ACP Agent is `Agent A`.
5. The registry contains no prompt body, assistant output, tool result, thought, permission content, or other message content.

## When / Then

### A. Task List structure and Project labels

1. Observe the Task List header.
   - It shows `Task List` and any attention count.
   - It does not show a global `New Task` button.
   - It includes `Project Current` and `Project Other` only.
   - It does not render `Project Missing`, its Task count, or `Missing ready` in either active or archived Task List content.
2. Observe every rendered active and archived Project label.
   - The visible label uses the custom Project name when defined, otherwise its workspace path.
   - Hovering the label exposes the complete workspace cwd, even when its visible text is ellipsized.
3. Search for `Current older`.
   - Only matching immutable Task titles remain visible.
   - Searching does not reorder Tasks or change their stored titles.

### B. Header New Task placement and Project-first launch

4. Observe the chat-panel action area.
   - The compact `New Task` icon is immediately left of the fullscreen/restore action.
   - It has an accessible `New Task` label and is visually equivalent in size to the existing header action.
5. Click `New Task`.
   - The first menu level is `Choose Project`.
   - `Project Current` is preselected and receives initial focus because it is the active workspace.
   - `Project Other` remains selectable in registry order.
   - `Project Missing` is filtered out and is not rendered in the picker.
   - The user must still explicitly confirm a Project before Agent choices are shown.
6. Confirm `Project Current` or select `Project Other`.
   - The second menu level is `Choose ACP Agent`.
   - `Agent A` is preselected and receives initial focus because it is the active Agent.
   - Both `Agent A` and `Agent B` are selectable.
   - The back row returns to Project selection without creating a draft or changing the default Agent preference.
7. Select `Agent B`.
   - The menu closes only after the Agent is selected.
   - A pending launch for `Project Other` and `Agent B` is prepared.
   - The IDE opens the target workspace, then creates an Agentic draft with that Agent and target cwd.
   - The user's default Agent preference remains unchanged.
8. When no registered Project is currently available, `New Task` is disabled and no empty Project picker opens.

### C. Task activation in the current Project

9. Click `Current older`.
   - The selected row receives the active selection state.
   - `acp_chat_get_session_state({})` changes to that ACP session.
   - Its unread marker is cleared.
   - The browser main frame does not navigate and the workspace cwd does not change.
10. Reload the current workspace and select the persisted Task again.
    - The Task remains in the same Project.
    - Bounded rich-history recovery is usable.
    - Registry metadata remains content-free.

### D. Cross-Project activation and dirty editors

11. With no dirty editor, click `Other ready`.
    - A pending activation for that Task is stored before switching workspaces.
    - The IDE opens `Project Other` with `preserveWindow: true`.
    - After the target workspace is ready, the stored Task session activates and its unread marker clears.
12. With a dirty editor, click `Other ready` and choose each dialog branch independently.
    - `Save All and Switch`: all documents save; switching continues only when no dirty editor remains.
    - `Discard Changes and Switch`: documents close/discard; switching continues.
    - `Cancel`: workspace, active session, pending activation, and unread state remain unchanged.

### E. Unavailable Project filtering and task safety

13. Observe `Project Missing`.
    - Its Project and Tasks remain in the persisted registry for future recovery.
    - Its Project header, Task rows, archived entries, and search results are filtered out of the Task List by default.
    - It does not contribute a visible Task count or attention count.
14. Open `New Task` with `Project Missing` present.
    - The missing Project is filtered out of the Project picker.
    - A missing cwd never triggers `workspaceService.open`.

### F. Archive, Classic Layout, and boundaries

15. Archive then unarchive a ready Task.
    - Only ready, stopped, or error Tasks expose Archive.
    - Unarchive returns the Task to its original Project group without losing title, Project reference, or status.
16. Switch Agentic -> Classic -> Agentic.
    - Classic retains its own ACP history popover/button behavior.
    - Agentic restores the Task List and header `New Task` action.
    - This scenario does not alter IDE Layout behavior outside the Agentic surface.

## Pass / Blocked Judgment

- **PASS** - every enabled Project can launch and activate through the declared Project-first flow; the active Project and Agent are preselected but explicitly confirmed; unavailable Projects are filtered from user-facing Task List and launch choices and never switch workspaces; the header action, cwd tooltips, persistence, archive, and layout boundaries satisfy the assertions above.
- **BLOCKED** - the IDE dev server, interactive profile, deterministic multi-project catalog, second disposable workspace, dirty-editor dialog fixture, or stable runtime selector is unavailable.
- **FAIL** - an Agent is selected without a Project, a task opens the wrong workspace/session, an unavailable cwd is opened, the default Agent preference changes, task metadata stores content, or Agentic changes Classic/IDE Layout behavior.

## Codegen Plan

- Keep the existing single-project history and restore Playwright coverage.
- Add `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts` only after the deterministic two-workspace catalog fixture and dirty-editor dialog fixture are available.
- Use accessible `New Task`, `Choose Project`, `Choose ACP Agent`, Project-label title, Task-row, and dialog locators; do not assert LLM-generated text or real-agent timing.
