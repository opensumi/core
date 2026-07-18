# Scenario: Agentic Task Workbench - Contextual Launch, Project Management, and Safe Restore

**Trigger:** `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx`, `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx`, `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts`, `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`, or `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts`

**Layer:** `runtime-ui` **Required profile:** `interactive` **Fixtures:** A deterministic ACP `history` fixture with at least two named agents; the default workspace; a second existing workspace; fixture-local registry state containing (a) a current-workspace Project with two Tasks, (b) a second existing Project with one Task, (c) an unavailable Project whose cwd does not exist, (d) ready/running/stopped/error and permission/input-attention Task records, and (e) deterministic failed and deferred Task activation seams for last-selection-wins checks. The Agentic Chat Slot must expose stable Task List resize geometry and the standard Project rename modal. **Workspace mutation:** Fixture setup may populate disposable Project workspaces and Project labels, then returns to the default workspace before the behavior under test. The runtime assertions must not navigate away from that workspace. It must not delete or mutate a user workspace. **Automation status:** Current-workspace lifecycle, persistence, and actionable Task Row state-text replacement on Archive/Unarchive reveal are converted in `tools/playwright/src/tests/acp-chat-agentic-history.test.ts`; rich restore is converted in `tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts`. The deterministic Task Workbench fixture covers cross-project in-place session activation and Project-group launch in `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`. Resize, rename, the complete status/attention matrix, failed activation, and last-selection-wins contracts are additionally hardened by focused component/service Jest suites; runtime conversion of non-actionable status rows and the other extended subcases remains pending stable fixture injection.

**Acceptance coverage:** `B-01` through `B-14` from `test/bdd/feat-0710-acceptance.md`.

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
   - It shows `Agent Tasks` and any attention count.
   - It shows an `Add Project` directory action, not a global Project picker.
   - It includes `Project Current` and `Project Other` only.
   - It does not render `Project Missing`, its Task count, or `Missing ready` in either active or archived Task List content.
2. Observe every rendered active and archived Project label.
   - A custom Project name is rendered exactly as entered. Otherwise, the visible label is the final segment of the normalized cwd, or `/` for a filesystem root.
   - When two available unnamed Projects share that final segment, each label includes the shortest parent-path suffix that distinguishes the set. Search filtering does not change these labels; they recompute only after a Project becomes available or unavailable, is added, or is removed.
   - Hovering the label exposes the complete workspace cwd, even when its visible text is ellipsized.
3. Search for `Current older`.
   - Only matching immutable Task titles remain visible.
   - Searching does not reorder Tasks or change their stored titles.

### A2. Workbench-native presentation, resizing, and rename

4. Inspect the Task List at a normal desktop width and keyboard-tab through its header, search, Project actions, Task rows, archive actions, and resize handle.
   - The Task List is a persistent left subregion inside the ACP Chat Slot while the Main Conversation Area, Explorer, and editor remain visible.
   - Project Groups and Tasks use flat OpenSumi tree/list rows, not card containers, decorative gradients, branded rails, permanent text action buttons, or a permanent second metadata line.
   - A default `ready` Task Row is undecorated: it has no status metadata element or `ready` text, and its immutable Task Title uses the reclaimed row width. Every non-default ACP status or pending attention state renders one semantic icon plus visible status text; attention replaces status. The independent unread marker remains the only standalone trailing dot.
   - Revealing Archive or Unarchive on hover or keyboard focus overlays the right-side action area without shifting the Task Title.
   - Icon-only actions expose accessible names, tooltips, and visible focus styles; truncated Project and Task text retains full accessible or hover detail.
5. Resize the Task List with mouse drag and keyboard controls, then narrow and widen the Agentic Chat Slot.
   - The default width is approximately `244px`, the minimum is `208px`, and the maximum is `min(480px, chatSlotWidth - 360px)`.
   - The Main Conversation Area retains at least `360px`; a previously stored wide value clamps after the Chat Slot narrows.
   - A drag continues when the pointer leaves the narrow handle, and a `ResizeObserver`-driven bound refresh applies before the next drag.
6. Open Rename from an active Project's management menu.
   - The standard OpenSumi Modal opens with a focused `Project name` input.
   - An unnamed Project starts with an empty value, uses its derived name as the placeholder, and shows the full cwd separately.
   - Save trims and persists a non-empty custom label; Cancel makes no change; saving whitespace-only input removes the custom label and restores the derived default.
   - Rename does not change Project identity, Task membership, ACP session identity, or ordering, and archived Projects expose no Rename action.

### A3. Project Group disclosure and visual baselines

7. Observe and operate a non-empty Project Group disclosure.
   - The Project label and count form one semantic disclosure button with `aria-expanded`; its full label remains its accessible name when the visible label truncates.
   - Clicking the disclosure collapses only that Project's Task rows. Focusing it and pressing `Enter` or `Space` toggles the same state without activating a Task.
   - The Project-group `+` and `…` remain independent sibling buttons. Clicking either action does not toggle the Project disclosure.
   - An empty Project Group keeps the same label/count alignment but renders no interactive disclosure or collapsed state.
8. Collapse `Project Current`, then search for `Current older` and clear the search.
   - A matching collapsed Project expands temporarily so the matching Task is visible during search.
   - Clearing search restores the Project's pre-search collapsed state; search never overwrites the user's stored disclosure choice.
   - Project disclosure states are independent, and filtering one Project does not collapse or expand a different Project.
9. Inspect computed Task List presentation at the normal desktop fixture size.
   - `Agent Tasks` is `12px` and weight `600`; the search control is `28px` high with `12px` text and a `16px` search codicon.
   - Project labels and counts are `12px`, with the label emphasized at weight `600`.
   - Task titles use the OpenSumi `13px` base font; status and attention metadata use `12px`.
   - Project headers, Task Rows, and the Archived toggle are `22px` high.
   - Disclosure, search, Add Project, New Task, Manage, Archive, and Unarchive codicons are `16px`; icon-only buttons are `22px` square.
   - The independent unread marker remains `6px` square. Keyboard focus has a visible theme-token focus treatment, and disclosure changes introduce no animation.

### B. Contextual New Task launch and Agent selection

4. Observe the chat-panel action area.
   - A compact split action is immediately left of the fullscreen/restore action: the primary `New Task` `+` and an always-visible `Choose Agent` dropdown.
   - The primary action names the recalled Agent and effective New Task shortcut in its accessible tooltip; both segments are visually equivalent in size to the existing header actions.
5. Click `New Task`.
   - The primary `+` immediately opens an Agent-bound Task Draft with the recalled Agent and never opens the Agent menu or renders `Choose Project`.
   - Clicking the adjacent dropdown opens a menu containing `Agent A`, `Agent B`, a check mark for the Agent resolved for the next Task, and `Agent Configuration`; hover does not open it.
   - Direct launch and explicit Agent choice use the selected durable Task's Project when a Task is selected; otherwise they use the current IDE workspace. The target supplies the Agent working directory without navigating the IDE. The draft receives a Task List row only after its first prompt is sent.
   - When the first prompt registers that Task, its new Task List row immediately becomes the active row and the previously selected row clears its active state.
   - Choosing an Agent launches immediately and updates that Project's Agent Recall without changing the user default Agent preference; a later primary launch uses the recalled Agent.
   - Opening the current workspace alone does not add it to the persisted Project Catalog.
6. Observe a Project Group.
   - Its only Task creation control is an icon-only `+`; it does not render a `New Task` label or Agent override arrow.
   - Its `+` opens an Agent-bound draft using that Project's resolved Agent Recall and its Project path as the Agent working directory. It does not navigate, reload the workbench, or invoke a dirty-editor guard when the Project differs from the current IDE workspace.
   - Its `…` menu contains Rename and contains Remove Project only for a manually added Project without retained Tasks.
7. When no ACP Agent is available, the header primary `New Task` action is disabled with an explanation while the adjacent dropdown remains enabled and exposes `Agent Configuration`; the shortcut shows one non-blocking recovery message, every Project Group `+` is disabled, and `Add Project` remains available.
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
11. Select a Task whose ACP session activation deterministically fails.
    - The previously active conversation and Task Row remain selected.
    - The failed target retains its unread marker and no unbound draft is opened.
12. Issue two Task activation requests rapidly, delaying the first request until after the second succeeds.
    - Only the most recently requested Task may become selected and clear its unread marker.
    - The older completion cannot overwrite the latest active session or visual selection.

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
    - Ready, stopped, and error Tasks expose an icon-only Archive action with an accessible name; running, unknown, and missing-status Tasks do not.
    - A ready Task Row remains undecorated before and after its action is revealed; it has no visible or assistive `ready` metadata.
    - Hovering an actionable Task Row or moving keyboard focus into it reveals Archive or Unarchive over the right-side area without shifting the row or title. Non-default status or attention metadata is visually hidden while the action is revealed and remains available to assistive technology.
    - Moving hover and focus away restores non-default status or attention metadata. A non-actionable Task Row keeps its metadata visible on hover and focus.
    - Unarchive returns the Task to its original Project group without losing title, Project reference, or status.
    - The Archived Area is collapsed by default, uses the same compact tree/list vocabulary, and exposes an icon-only accessible Unarchive action after expansion.
    - Permission or input attention replaces the ordinary status text and contributes to the visible attention count; unavailable Projects contribute neither rows nor attention.
16. Switch Agentic -> Classic -> Agentic.
    - Classic retains its own ACP history popover/button behavior.
    - Agentic restores the Task List and header `New Task` action.
    - This scenario does not alter IDE Layout behavior outside the Agentic surface.

## Pass / Blocked Judgment

- **PASS** - the workbench-native Task List presentation, resize bounds, Project naming, contextual launch, session-first activation, failure/race safety, status/attention, archive, persistence, and Classic/Agentic boundaries satisfy every assertion without changing the current workbench URL or workspace.
- **BLOCKED** - the IDE dev server, interactive profile, deterministic multi-project/status catalog, second disposable workspace, failed/deferred activation seam, rename modal, resize geometry, or stable runtime selector is unavailable.
- **FAIL** - Task List geometry or accessibility breaks, a contextual launch renders a Project picker, a Task selection or Project-group launch navigates the workbench or opens a save/discard dialog, activation failure/races corrupt selection, a task opens the wrong session or Agent working directory, an unavailable cwd is opened, archive/status rules drift, the default Agent preference changes, task metadata stores content, or Agentic changes Classic/IDE Layout behavior.

## Codegen Plan

- Keep the existing single-project history and restore Playwright coverage.
- Use `agentic-task-row-*`, `agentic-task-launch-button`, `agentic-task-execution-context`, the visible `.AI-Chat-slot [contenteditable="true"]` draft composer, and Project-label title locators to prove cross-project selection and launch retain the URL and current workspace; do not assert LLM-generated text or real-agent timing.
- Extend the existing Task Workbench spec, rather than creating a duplicate test file, when resize, rename, status-matrix, failed-activation, and deferred-selection fixtures become stable in the Playwright lane.
