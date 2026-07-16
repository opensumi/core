# Scenario: Agentic Task Workbench - Contextual Launch, Project Management, and Safe Restore

**Trigger:** `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx`, `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx`, `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts`, `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** A deterministic ACP `history` fixture with at least two named agents; the default workspace; a second existing workspace; fixture-local registry state containing (a) a current-workspace Project with two Tasks, (b) a second existing Project with one Task, and (c) an unavailable Project whose cwd does not exist. **Workspace mutation:** Fixture setup may populate the disposable Project workspaces, then returns to the default workspace before the behavior under test. The runtime assertions must not navigate away from that workspace. It must not delete or mutate a user workspace. **Automation status:** Current-workspace lifecycle and persistence are converted in `tools/playwright/src/tests/acp-chat-agentic-history.test.ts` and `tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts`. The deterministic Task Workbench fixture covers cross-project in-place session activation and Project-group launch in `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`.

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
   - It shows an `Add Project` directory action, not a global Project picker.
   - It includes `Project Current` and `Project Other` only.
   - It does not render `Project Missing`, its Task count, or `Missing ready` in either active or archived Task List content.
   - A Task Row has no leading ACP status or attention dot. Its immutable title is followed by right-aligned status or attention text; the independent unread marker remains a trailing dot only when unread.
2. Observe every rendered active and archived Project label.
   - A custom Project name is rendered exactly as entered. Otherwise, the visible label is the final segment of the normalized cwd, or `/` for a filesystem root.
   - When two available unnamed Projects share that final segment, each label includes the shortest parent-path suffix that distinguishes the set. Search filtering does not change these labels; they recompute only after a Project becomes available or unavailable, is added, or is removed.
   - Hovering the label exposes the complete workspace cwd, even when its visible text is ellipsized.
3. Search for `Current older`.
   - Only matching immutable Task titles remain visible.
   - Searching does not reorder Tasks or change their stored titles.

### B. Contextual New Task launch and Agent selection

4. Observe the chat-panel action area.
   - The compact `New Task` icon is immediately left of the fullscreen/restore action.
   - It has an accessible `New Task` label and is visually equivalent in size to the existing header action.
5. Click `New Task`.
   - It opens an ACP Agent dropdown anchored to the header action; hover does not open it and it never renders `Choose Project`.
   - The menu contains `Agent A`, `Agent B`, a check mark for the Agent resolved for the next Task, and `Agent Configuration`.
   - Choosing an Agent opens an Agent-bound draft for the selected durable Task's Project when a Task is selected; otherwise it uses the current IDE workspace. The target supplies the Agent working directory without navigating the IDE. The draft receives a Task List row only after its first prompt is sent.
   - Choosing an Agent updates that Project's Agent Recall without changing the user default Agent preference.
   - Opening the current workspace alone does not add it to the persisted Project Catalog.
6. Observe a Project Group.
   - Its only Task creation control is an icon-only `+`; it does not render a `New Task` label or Agent override arrow.
   - Its `+` opens an Agent-bound draft using that Project's resolved Agent Recall and its Project path as the Agent working directory. It does not navigate, reload the workbench, or invoke a dirty-editor guard when the Project differs from the current IDE workspace.
   - Its `…` menu contains Rename and contains Remove Project only for a manually added Project without retained Tasks.
7. When no ACP Agent is available, the header `New Task` action remains enabled and its menu exposes `Agent Configuration`; every Project Group `+` is disabled while `Add Project` remains available.
8. Click `Add Project` and select one directory.
   - The existing directory picker is used; the IDE editor and file tree do not navigate.
   - The Project appears as an empty Project Group. Selecting an existing directory revalidates the existing Project instead of creating a duplicate.

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

### D. Cross-Project in-place activation and launch

11. With a dirty editor in `Project Current`, click `Other ready`.
    - `acp_chat_get_session_state({})` activates the `Other ready` ACP session in place and clears its unread marker only after activation succeeds.
    - The browser URL, IDE workspace cwd, file tree, and dirty editor remain unchanged.
    - No `Save All and Switch`, `Discard Changes and Switch`, or `Cancel` dialog appears.
    - The Agentic Chat View header exposes the `Agent working directory` indicator for `Project Other`; its hover title is the complete `Project Other` cwd.
12. Click the `Project Other` Project-group `+` while the IDE remains in `Project Current`.
    - It opens an Agent-bound draft whose working directory is `Project Other`.
    - The browser URL and IDE workspace cwd remain unchanged, the dirty editor remains open, and no save/discard dialog appears.
    - The Header `New Task` action while that foreign Task is selected also targets `Project Other` without navigation.

### E. Unavailable Project filtering and task safety

13. Observe `Project Missing`.
    - Its Project and Tasks remain in the persisted registry for future recovery.
    - Its Project header, Task rows, archived entries, and search results are filtered out of the Task List by default.
    - It does not contribute a visible Task count or attention count.
14. Observe task creation with `Project Missing` present.
    - The missing Project has no visible Project Group, `+`, or Agent selection entry.
    - A missing cwd never triggers `workspaceService.open`.

### F. Archive, Classic Layout, and boundaries

15. Archive then unarchive a ready Task.
    - Ready, stopped, and error Tasks expose an icon-only Archive action with an accessible name; running and missing-status Tasks do not.
    - Before an action is revealed, the Task Row shows its right-aligned status or attention text and no leading state dot.
    - Hovering an actionable Task Row or moving keyboard focus into it reveals Archive or Unarchive and visually hides the state text without shifting the row; the state text remains available to assistive technology.
    - Moving hover and focus away restores the visible state text. A non-actionable Task Row keeps its state text visible on hover and focus.
    - Unarchive returns the Task to its original Project group without losing title, Project reference, or status.
    - Permission or input attention replaces the ordinary status text; the independent unread marker is unchanged.
16. Switch Agentic -> Classic -> Agentic.
    - Classic retains its own ACP history popover/button behavior.
    - Agentic restores the Task List and header `New Task` action.
    - This scenario does not alter IDE Layout behavior outside the Agentic surface.

## Pass / Blocked Judgment

- **PASS** - every enabled Project can open and activate through its contextual launch action without changing the current workbench URL or workspace; the header uses its Agent dropdown for the selected Task Project or current workspace, each Project-group `+` supplies its group's working directory directly, Agent Recall and explicit selection follow their declared order without changing the user default, unavailable Projects are filtered, and the header action, cwd tooltips, persistence, archive, and layout boundaries satisfy the assertions above.
- **BLOCKED** - the IDE dev server, interactive profile, deterministic multi-project catalog, second disposable workspace, or stable runtime selector is unavailable.
- **FAIL** - a contextual launch renders a Project picker, a Task selection or Project-group launch navigates the workbench or opens a save/discard dialog, a task opens the wrong session or Agent working directory, an unavailable cwd is opened, the default Agent preference changes, task metadata stores content, or Agentic changes Classic/IDE Layout behavior.

## Codegen Plan

- Keep the existing single-project history and restore Playwright coverage.
- Use `agentic-task-row-*`, `agentic-task-launch-button`, `agentic-task-execution-context`, the visible `.AI-Chat-slot [contenteditable="true"]` draft composer, and Project-label title locators to prove cross-project selection and launch retain the URL and current workspace; do not assert LLM-generated text or real-agent timing.
