# Agentic Task List Workbench Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Agentic Layout Agent Task List so it reads as a native OpenSumi workbench tree/list while preserving existing task behavior.

**Architecture:** Keep the current Agentic Task List data flow, registry calls, launch flow, archive flow, and resize behavior unchanged. Update only the direct presentation layer: Task List JSX markup for icon-only controls and single-line rows, plus the LESS module that maps those elements to OpenSumi workbench tree/list tokens. Existing Jest and Playwright coverage stays focused on behavior and accessibility, with a required runtime screenshot for visual acceptance.

**Tech Stack:** TypeScript, React, CSS Modules with LESS, OpenSumi codicon classes, Jest/jsdom, Playwright UI tests.

## Global Constraints

- This design changes only the visual presentation of the Agent Task List and its direct controls in Agentic Layout.
- It does not change Agent Task registry data, Project Catalog behavior, Task Launch behavior, Session-first Task Selection, ACP status semantics, chat message rendering, editor/file-tree layout, or IDE Layout lifecycle.
- The approved direction is OpenSumi workbench tree/list styling as the base, with a small amount of Agent status emphasis.
- The Task List should read like a native side-region list, close to Explorer, Open Editors, and tree-view rows, rather than a standalone task-management panel.
- Avoid card-like Task Rows, persistent text action buttons, large rounded containers, branded Agent rails, `AGENT` or `LIVE` labels, and decorative gradients.
- The Task List keeps its existing persistent, resizable left subregion inside the ACP Chat Slot.
- Project Group structure is disclosure chevron, Project Name, count, Project-group New Task action, Project Management action.
- Project Group row height is `24px`.
- Task Row structure is status point, Task Title, short right-side status or time text, unread marker.
- Task Row height is `25px`.
- Archive and Unarchive are icon-only row actions that appear on hover/focus and keep accessible names.
- No changes to Agent Task registry schema or migration.
- No changes to IDE Layout, file tree, editor, or shared workbench layout lifecycle.

---

## File Structure

- `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx` Owns Task List structure. Modify only presentational markup inside `TaskRow`, `ProjectGroup`, `ArchivedTaskGroups`, and the search/header controls.
- `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx` Owns the Project-group New Task button for the Task List variant. Change its visible `+` text to a codicon while preserving the same `data-testid`, `aria-label`, disabled state, and click behavior.
- `packages/ai-native/src/browser/acp/components/agentic-task-list.module.less` Owns the Task List visual system. Replace card-like row sizing and action styling with OpenSumi workbench tree/list tokens.
- `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx` Keeps focused jsdom behavior and accessibility coverage for icon-only actions, single-line Task Row content, and unchanged archive/unarchive behavior.
- `tools/playwright/src/tests/acp-chat-agentic-history.test.ts` Update assertions that currently expect `· ready` text inside a row or visible archive text.
- `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts` Update assertions that currently expect the Project-group launch button text to be `+`; keep the same visible/actionable behavior checks.

### Task 1: Convert Controls and Rows to Workbench Markup

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`
- Modify: `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx`
- Modify: `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`
- Modify: `tools/playwright/src/tests/acp-chat-agentic-history.test.ts`
- Modify: `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`

**Interfaces:**

- Consumes: existing `AgenticTaskRecord`, `AgenticProjectRecord`, `AgenticTaskLaunchMenuProps`, `data-testid` values, archive/unarchive callbacks.
- Produces: single-line Task Row DOM with `styles.task_meta`, icon-only archive/unarchive actions, icon-only Project-group launch action, and unchanged `data-testid`/`aria-label` contracts for tests and Playwright.

- [ ] **Step 1: Write the failing jsdom assertions**

  In `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`, update the Project-group launch assertion in `renders an empty manually managed Project Group with a contextual New Task action`:

  ```ts
  const launchButton = projectGroup?.querySelector('[data-testid="agentic-task-launch-button"]');
  expect(launchButton?.textContent).toBe('');
  expect(launchButton?.querySelector('.codicon.codicon-add')).not.toBeNull();
  expect(launchButton?.getAttribute('aria-label')).toBe('New Task for a');
  expect(projectGroup?.querySelector('[data-testid="agentic-task-agent-menu-button"]')).toBeNull();
  ```

  In `renders attention before status, archives eligible Tasks, and filters unavailable Projects`, add these assertions after the existing attention/unread expectations:

  ```ts
  const readyRow = container.querySelector('[data-testid="agentic-task-row-acp:ready"]');
  expect(readyRow?.textContent).toContain('Ready task');
  expect(readyRow?.textContent).toContain('ready');
  expect(readyRow?.textContent).not.toContain('agent-a');

  const archive = container.querySelector('[data-testid="agentic-task-archive-acp:ready"]');
  expect(archive?.textContent).toBe('');
  expect(archive?.getAttribute('aria-label')).toBe('Archive Ready task');
  expect(archive?.getAttribute('title')).toBe('Archive Ready task');
  expect(archive?.querySelector('.codicon.codicon-archive')).not.toBeNull();
  ```

  In `renders an accessible Unarchive action for an archived Task`, add these assertions before clicking the unarchive button:

  ```ts
  expect(unarchive?.textContent).toBe('');
  expect(unarchive?.getAttribute('aria-label')).toBe('Unarchive Archived ready Task');
  expect(unarchive?.getAttribute('title')).toBe('Unarchive Archived ready Task');
  expect(unarchive?.querySelector('.codicon.codicon-archive')).not.toBeNull();
  ```

- [ ] **Step 2: Run the focused jsdom test and verify it fails**

  Run:

  ```bash
  yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand
  ```

  Expected: FAIL because the Project-group launch button still renders `+`, Task Rows still render `agent-a`, and Archive/Unarchive buttons still render visible text without `title` or codicon content.

- [ ] **Step 3: Implement single-line row metadata and icon-only row actions**

  In `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`, add this helper below `TaskState`:

  ```tsx
  function getTaskRowMeta(task: AgenticTaskRecord): string {
    if (task.attention === 'permission') {
      return 'permission';
    }
    if (task.attention === 'input') {
      return 'input';
    }
    return task.status || '';
  }
  ```

  Replace the returned JSX inside `TaskRow` with this structure:

  ```tsx
  const archiveEligible = !!task.status && ARCHIVABLE_STATUSES.has(task.status) && !task.archived;
  const rowMeta = getTaskRowMeta(task);

  return (
    <div className={styles.task_row_wrap}>
      <button
        aria-current={active ? 'true' : undefined}
        className={`${styles.task_row} ${active ? styles.task_row_selected : ''}`}
        data-testid={`agentic-task-row-${task.sessionId}`}
        disabled={!projectAvailable}
        onClick={() => onActivate(task)}
        title={projectAvailable ? task.title : `${task.title} (Project unavailable)`}
        type='button'
      >
        <TaskState task={task} />
        <span className={styles.task_title}>{task.title}</span>
        {rowMeta && <span className={styles.task_meta}>{rowMeta}</span>}
        {task.unread && (
          <span aria-label='Unread' className={styles.unread} data-testid={`agentic-task-unread-${task.sessionId}`} />
        )}
      </button>
      {archiveEligible && (
        <button
          aria-label={`Archive ${task.title}`}
          className={styles.archive_button}
          data-testid={`agentic-task-archive-${task.sessionId}`}
          onClick={() => onArchive(task)}
          title={`Archive ${task.title}`}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-archive' />
        </button>
      )}
      {task.archived && onUnarchive && (
        <button
          aria-label={`Unarchive ${task.title}`}
          className={styles.archive_button}
          data-testid={`agentic-task-unarchive-${task.sessionId}`}
          onClick={() => onUnarchive(task)}
          title={`Unarchive ${task.title}`}
          type='button'
        >
          <span aria-hidden='true' className='codicon codicon-archive' />
        </button>
      )}
    </div>
  );
  ```

- [ ] **Step 4: Implement workbench icons for Project-group controls and search**

  In `ProjectGroup`, replace the Project label prefix and management button content with codicons:

  ```tsx
  <span aria-hidden='true' className={`${styles.project_chevron} codicon codicon-chevron-down`} />
  <span className={styles.project_label} title={group.project.workspacePath}>
    {projectLabel}
  </span>
  ```

  ```tsx
  <span aria-hidden='true' className='codicon codicon-ellipsis' />
  ```

  In `ArchivedTaskGroups`, replace the archived disclosure text prefix with:

  ```tsx
  <span
    aria-hidden='true'
    className={`codicon ${expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
  />
  <span>Archived Tasks</span>
  ```

  In the main Task List search label, replace the `⌕` span with:

  ```tsx
  <span aria-hidden='true' className='codicon codicon-search' />
  ```

  In the Task List header Project Addition button, replace visible `+` text with:

  ```tsx
  <span aria-hidden='true' className='codicon codicon-add' />
  ```

- [ ] **Step 5: Implement icon-only Project-group New Task**

  In `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx`, keep the existing task-list variant wrapper and button attributes, but replace the button child:

  ```tsx
  <span aria-hidden='true' className='codicon codicon-add' />
  ```

- [ ] **Step 6: Update Playwright expectations for icon-only controls**

  In `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`, replace:

  ```ts
  await expect(currentGroup.getByTestId('agentic-task-launch-button')).toHaveText('+');
  ```

  with:

  ```ts
  await expect(currentGroup.getByTestId('agentic-task-launch-button')).toHaveAccessibleName(
    'New Task for Project Current',
  );
  ```

  In `tools/playwright/src/tests/acp-chat-agentic-history.test.ts`, replace:

  ```ts
  await expect(page.getByTestId(`agentic-task-row-${newerTask.sessionId}`)).toContainText(/·\s*ready/);
  await expect(page.getByTestId(`agentic-task-archive-${newerTask.sessionId}`)).toBeVisible({ timeout: 30_000 });
  ```

  with:

  ```ts
  await expect(page.getByTestId(`agentic-task-row-${newerTask.sessionId}`)).toContainText(/ready/);
  const archiveNewerTask = page.getByTestId(`agentic-task-archive-${newerTask.sessionId}`);
  await page.getByTestId(`agentic-task-row-${newerTask.sessionId}`).hover();
  await expect(archiveNewerTask).toHaveCSS('pointer-events', 'auto', { timeout: 30_000 });
  await expect(archiveNewerTask).toHaveAccessibleName(`Archive ${newerTask.title}`);
  ```

- [ ] **Step 7: Run the focused jsdom test and verify it passes**

  Run:

  ```bash
  yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand
  ```

  Expected: PASS.

- [ ] **Step 8: Commit the markup and accessibility changes**

  ```bash
  git add packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx \
    packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx \
    packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx \
    tools/playwright/src/tests/acp-chat-agentic-history.test.ts \
    tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts
  git commit -m "feat(agentic): use workbench task list controls"
  ```

### Task 2: Apply Workbench Tree/List Styling

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/agentic-task-list.module.less`
- Test: `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`
- Verify: `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`

**Interfaces:**

- Consumes: Task 1 class names and DOM structure: `.project_chevron`, `.task_title`, `.task_meta`, icon-only `.archive_button`, codicon children.
- Produces: OpenSumi workbench tree/list visual treatment with `24px` Project Group rows, `25px` Task Rows, hover/focus row actions, semantic status points, and no card-like Task Row layout.

- [ ] **Step 1: Replace the Task List surface, header, search, and toolbar control styles**

  In `packages/ai-native/src/browser/acp/components/agentic-task-list.module.less`, update these blocks:

  ```less
  .task_list {
    position: relative;
    display: flex;
    flex: 0 0 var(--agentic-task-list-width, 244px);
    flex-direction: column;
    width: var(--agentic-task-list-width, 244px);
    min-width: 208px;
    max-width: var(--agentic-task-list-max-width, 480px);
    min-height: 0;
    overflow: hidden;
    border-right: 1px solid var(--panel-border);
    background: var(--panel-background);
    color: var(--foreground);
  }

  .task_list_header {
    display: flex;
    align-items: center;
    min-height: 36px;
    padding: 0 8px 0 12px;
    border-bottom: 1px solid var(--panel-border);
    background: var(--editorGroupHeader-tabsBackground);

    h2 {
      margin: 0;
      color: var(--foreground);
      font-size: 12px;
      font-weight: 600;
    }
  }

  .attention_count {
    margin-left: 6px;
    color: var(--editorWarning-foreground, #cca700);
    font-size: 11px;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 28px;
    margin: 7px 7px 5px;
    padding: 0 8px;
    border: 1px solid var(--input-border, var(--panel-border));
    border-radius: 4px;
    background: var(--input-background, var(--editor-background));
    color: var(--input-placeholderForeground);
    font-size: 12px;

    &:focus-within {
      border-color: var(--focusBorder);
    }

    input {
      min-width: 0;
      flex: 1;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--input-foreground, var(--foreground));
      font: inherit;

      &::placeholder {
        color: var(--input-placeholderForeground);
      }
    }
  }
  ```

  Update toolbar-style buttons:

  ```less
  .project_add,
  .project_rename,
  .project_manage,
  .project_new_task {
    display: flex;
    flex: 0 0 22px;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--icon-foreground);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;

    &:hover:not(:disabled),
    &:focus-visible {
      outline: none;
      background: var(--toolbar-hoverBackground, var(--list-hoverBackground));
      color: var(--foreground);
    }

    &:disabled {
      cursor: default;
      color: var(--disabledForeground);
    }
  }
  ```

- [ ] **Step 2: Replace Project Group and Archived Area styles**

  Update the group and archived blocks:

  ```less
  .project_group,
  .archived_project_group {
    margin: 4px 5px 0;
  }

  .project_header {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
    height: 24px;
    padding: 0 6px;
    color: var(--descriptionForeground);
    font-size: 11px;
    font-weight: 600;
  }

  .project_chevron {
    flex: 0 0 14px;
    width: 14px;
    color: var(--descriptionForeground);
    font-size: 13px;
  }

  .project_label {
    min-width: 0;
    overflow: hidden;
    color: var(--descriptionForeground);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project_count {
    margin-left: 6px;
    color: var(--disabledForeground);
    font-size: 10px;
    font-weight: 400;
  }

  .project_new_task {
    margin-left: auto;
    opacity: 0.72;
  }

  .project_manage {
    margin-left: 2px;
    opacity: 0.72;
  }

  .project_header:hover .project_new_task,
  .project_header:focus-within .project_new_task,
  .project_header:hover .project_manage,
  .project_header:focus-within .project_manage {
    opacity: 1;
  }

  .archived_area {
    flex: none;
    margin: 8px 0 0;
    border-top: 1px solid var(--panel-border);
  }

  .archived_toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 30px;
    padding: 0 10px;
    background: transparent;
    color: var(--descriptionForeground);
    cursor: pointer;
    font-size: 11px;
    text-align: left;

    &:hover,
    &:focus-visible {
      outline: none;
      color: var(--foreground);
      background: var(--kt-tree-hoverBackground, var(--list-hoverBackground));
    }
  }
  ```

- [ ] **Step 3: Replace Task Row, status point, and action styles**

  Replace the current `.task_row_wrap`, `.task_row`, `.task_row_selected`, `.task_state`, title/meta/unread, and `.archive_button` blocks:

  ```less
  .task_row_wrap {
    position: relative;
    margin: 0 5px;
  }

  .task_row {
    position: relative;
    display: grid;
    grid-template-columns: 14px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 25px;
    min-height: 25px;
    padding: 0 6px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    font-size: 12px;
    text-align: left;

    &::before {
      position: absolute;
      top: 4px;
      bottom: 4px;
      left: 0;
      display: none;
      width: 2px;
      border-radius: 2px;
      background: var(--focusBorder);
      content: '';
    }

    &:hover:not(:disabled),
    &:focus-visible {
      outline: none;
      background: var(--kt-tree-hoverBackground, var(--list-hoverBackground));
      color: var(--kt-tree-hoverForeground, var(--foreground));
    }

    &:disabled {
      cursor: default;
      opacity: 0.55;
    }
  }

  .task_row_selected {
    outline: 1px solid var(--list-focusOutline, var(--focusBorder));
    outline-offset: -1px;
    background: var(--kt-tree-inactiveSelectionBackground, var(--list-activeSelectionBackground));
    color: var(--kt-tree-inactiveSelectionForeground, var(--list-activeSelectionForeground));

    &::before {
      display: block;
    }
  }

  .task_state {
    position: relative;
    width: 12px;
    height: 12px;

    &::after {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--descriptionForeground);
      content: '';
    }
  }

  .task_attention_permission::after,
  .task_attention_input::after {
    top: 2px;
    left: 2px;
    width: 7px;
    height: 7px;
    background: var(--editorWarning-foreground, #cca700);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--editorWarning-foreground, #cca700) 14%, transparent);
  }

  .task_status_running::after {
    background: var(--focusBorder);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--focusBorder) 14%, transparent);
  }

  .task_status_ready::after {
    background: var(--testing-iconPassed, #73c991);
  }

  .task_status_error::after {
    background: var(--errorForeground);
  }

  .task_title,
  .task_meta {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task_title {
    color: inherit;
    font-size: 12px;
    line-height: 25px;
  }

  .task_meta {
    max-width: 72px;
    color: var(--descriptionForeground);
    font-size: 11px;
    line-height: 25px;
  }

  .unread {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--focusBorder);
  }

  .archive_button {
    position: absolute;
    z-index: 1;
    top: 50%;
    right: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    transform: translateY(-50%);
    border-radius: 4px;
    background: var(--panel-background);
    color: var(--icon-foreground);
    cursor: pointer;
    font-size: 14px;
    opacity: 0;
    pointer-events: none;

    &:hover,
    &:focus-visible {
      opacity: 1;
      pointer-events: auto;
      outline: none;
      background: var(--toolbar-hoverBackground, var(--list-hoverBackground));
      color: var(--foreground);
    }
  }

  .task_row_wrap:hover .archive_button,
  .task_row_wrap:focus-within .archive_button {
    opacity: 1;
    pointer-events: auto;
  }
  ```

  Delete the obsolete `.task_copy`, `.task_subtitle`, and duplicate text-button archive declarations after replacing these blocks.

- [ ] **Step 4: Run focused tests and whitespace check**

  Run:

  ```bash
  yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand
  git diff --check -- packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx \
    packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx \
    packages/ai-native/src/browser/acp/components/agentic-task-list.module.less \
    packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx \
    tools/playwright/src/tests/acp-chat-agentic-history.test.ts \
    tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts
  ```

  Expected: Jest PASS and `git diff --check` prints no output.

- [ ] **Step 5: Run focused Playwright contract for archive/unarchive and workbench layout**

  Run:

  ```bash
  yarn test:ui tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts
  ```

  Expected: PASS. This contract covers Task List visibility beside conversation/editor/Explorer, Project-group launch actions, archive/unarchive hover actions, and unchanged Agentic/Classic layout boundaries.

- [ ] **Step 6: Capture a runtime screenshot for visual acceptance**

  After the focused Playwright contract passes, keep or start the same Agentic Layout profile and capture a desktop screenshot that shows Task List, conversation header, editor, and Explorer together. Save it under `output/playwright/agentic-task-list-workbench-style-after.png`.

  If using Playwright CLI against the running page, run:

  ```bash
  npx playwright screenshot --viewport-size=1440,900 --wait-for-selector='[data-testid="agentic-task-list"]' \
    http://127.0.0.1:8080 output/playwright/agentic-task-list-workbench-style-after.png
  ```

  Expected: The Task List uses a flat workbench surface, Project Groups are compact section rows, Task Rows are single-line native list rows, Archive/Unarchive controls are icon-only on hover/focus, and there is no branded Agent rail or card-like Task Row.

- [ ] **Step 7: Commit the workbench styling changes**

  ```bash
  git add packages/ai-native/src/browser/acp/components/agentic-task-list.module.less
  git commit -m "style(agentic): align task list with workbench"
  ```

## Final Verification

- [ ] Run:

  ```bash
  yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand
  git diff --check
  ```

- [ ] Confirm the screenshot at `output/playwright/agentic-task-list-workbench-style-after.png` matches the approved direction from `docs/superpowers/specs/2026-07-15-agentic-task-list-workbench-style-design.md`.

- [ ] Report any skipped Playwright or screenshot validation explicitly, including the blocking command output.
