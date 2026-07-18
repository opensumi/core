# Agentic Project Catalog Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute each task with a red-green-refactor test cycle. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Agentic New Task Project picker with contextual launch actions and make the Task List the explicit local Project-management surface.

**Architecture:** Keep all behavior in `packages/ai-native` Agentic ACP modules. The registry distinguishes manually managed and task-owned Projects, migrates legacy MRU-only records away, and retains per-Project Agent recall. The switch service owns directory validation and workspace-aware launch; React components only render the Task List controls, call the existing directory picker, and consume that service.

**Tech Stack:** TypeScript, React, OpenSumi DI, `IWindowDialogService`, `StorageProvider`, Jest/jsdom, Playwright BDD.

## Global Constraints

- Modify only Agentic Layout and ACP modules. Do not change `packages/ide-layout/`, `packages/main-layout/`, `packages/ai-native/src/browser/layout/`, `AgenticShell`, or `WorkspaceService`.
- Do not import IDE-layout components. Use the existing `IWindowDialogService` for directory selection.
- Project metadata remains user-local in `agentic.task-registry.v2`; prompts, messages, commands, credentials, and artifacts remain excluded.
- A Project picker must not be rendered by the Chat header or a Project Group New Task action.
- A multi-root workspace file is not a Project Addition target.

### Task 1: Model explicit Project membership and per-Project Agent recall

**Files:**

- Modify: `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`
- Modify: `packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts`

**Interfaces:** add `managed: boolean` and optional `lastAgentId` to `AgenticProjectRecord`; expose `registerManagedProject`, `removeManagedProject`, and `rememberProjectAgent`.

- [ ] **Step 1: Write failing registry tests**

```ts
it('shows manual Projects without Tasks and removes only a task-free manual Project', async () => {
  await registry.registerManagedProject(project);
  expect(await registry.listActiveGroups()).toEqual([
    { project: expect.objectContaining({ managed: true }), tasks: [] },
  ]);
  await expect(registry.removeManagedProject(project.id)).resolves.toBe(true);
});

it('migrates v3 MRU-only Projects away but retains task-owned Projects and Agent recall', async () => {
  storage.get.mockReturnValue({ version: 3, projects: [mruOnly, taskProject], tasks: [task] });
  expect(await registry.listProjects()).toEqual([expect.objectContaining({ id: taskProject.id, managed: false })]);
  await registry.rememberProjectAgent(taskProject.id, 'agent-b');
  expect(await registry.getProject(taskProject.id)).toMatchObject({ lastAgentId: 'agent-b' });
});
```

- [ ] **Step 2: Run the focused test and observe failure**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts --runInBand`

- [ ] **Step 3: Implement storage version 4 and migration**

Normalize v2/v3/v4 records to v4. Preserve a Project when `managed` is true or a retained Task references it; set `managed: false` for task-owned legacy records, discard legacy records with no Task, and preserve custom labels. `listActiveGroups` includes empty managed available groups only when no task-title search is active. `registerFirstPrompt` retains the Project and sets `lastAgentId`; removal rejects non-managed Projects and all Projects referenced by Tasks.

- [ ] **Step 4: Re-run the focused test and observe pass**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts --runInBand`

### Task 2: Stop MRU seeding and add directory-backed Project registration

**Files:**

- Modify: `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts`
- Modify: `packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts`

**Interfaces:** replace `seedProjectCatalog()` with refresh-only availability handling; add `addProject(uri: URI): Promise<AgenticProjectRecord | undefined>` and support direct current-workspace draft launch without requiring a pre-existing catalog record.

- [ ] **Step 1: Write failing switch-service tests**

```ts
it('does not register the current workspace or MRU entries while refreshing the catalog', async () => {
  await switcher.seedProjectCatalog();
  expect(registry.registerProject).not.toHaveBeenCalled();
});

it('registers one selected directory as a managed Project without opening a workspace', async () => {
  await switcher.addProject(URI.file('/work/b'));
  expect(registry.registerManagedProject).toHaveBeenCalledWith(expect.objectContaining({ workspacePath: '/work/b' }));
  expect(windowService.openWorkspace).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and observe failure**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts --runInBand`

- [ ] **Step 3: Implement only the validated directory paths**

Remove MRU enumeration. Refresh availability for stored Projects, validate an added `file:` directory through `IFileServiceClient`, and register it as managed. Launching the current workspace may enter a draft from its transient target; launching another Project remains registry-backed and preserves the existing dirty-editor guard. Persist Agent recall only after a successful launch.

- [ ] **Step 4: Re-run the focused test and observe pass**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts --runInBand`

### Task 3: Make the Task List the Project-management surface

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`
- Modify: `packages/ai-native/src/browser/acp/components/agentic-task-list.module.less`
- Modify: `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`

**Interfaces:** Task List injects `IWindowDialogService`, calls `showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false })`, and delegates the result to `addProject`.

- [ ] **Step 1: Write failing component tests**

```tsx
it('adds a selected directory without rendering a global New Task picker', async () => {
  await click('Add Project');
  expect(windowDialogService.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({ canSelectFolders: true }));
  expect(workspaceSwitch.addProject).toHaveBeenCalledWith(URI.file('/work/new'));
});

it('renders an empty manual Project Group with a New Task button and management menu', async () => {
  services.registry.listActiveGroups.mockResolvedValue([{ project: managedProject, tasks: [] }]);
  await renderTaskList(services);
  expect(container.textContent).toContain('/work/manual');
  expect(container.querySelector('[aria-label="New Task for /work/manual"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run the focused test and observe failure**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand`

- [ ] **Step 3: Implement the Agentic-only controls**

Add the header folder-add button. Keep a Project Group's visible `+` for launch; move Rename and conditional Remove into its overflow menu. Preserve full-path tooltips, hide unavailable groups, and do not place a general launcher in the Task List header.

- [ ] **Step 4: Re-run the focused test and observe pass**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand`

### Task 4: Launch directly for the contextual Project and override Agent in a modal

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx`
- Modify: `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx`
- Modify: `packages/ai-native/__test__/browser/acp/agentic-task-launch-menu.test.tsx`
- Modify or create: `packages/ai-native/__test__/browser/chat/agentic-chat-panel-header.test.tsx`

**Interfaces:** `AgenticTaskLaunchMenu` receives exactly one contextual Project target. Its primary button calls `launchTask(project, resolvedAgentId)`; its dropdown opens an ACP Agent selection `Modal`.

- [ ] **Step 1: Write failing launch tests**

```tsx
it('launches the supplied Project directly with its recalled Agent', async () => {
  root.render(<AgenticTaskLaunchMenu project={projectA} preferredAgentId='agent-a' />);
  await click('[data-testid="agentic-task-launch-button"]');
  expect(workspaceSwitch.launchTask).toHaveBeenCalledWith(projectA, 'agent-b');
  expect(container.textContent).not.toContain('Choose Project');
});

it('opens an Agent modal only from the override dropdown', async () => {
  await click('[data-testid="agentic-task-agent-menu-button"]');
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Choose ACP Agent');
});
```

- [ ] **Step 2: Run the focused test and observe failure**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-launch-menu.test.tsx --runInBand`

- [ ] **Step 3: Implement direct contextual launch**

Remove `projects` and Project-picker state from the launcher. Resolve Agent recall before the active conversation Agent and global default; disable only task-creation controls when no ACP Agent exists. The Chat header builds a transient current-workspace target when none is persisted, so opening a workspace alone never creates a catalog record.

- [ ] **Step 4: Re-run the focused test and observe pass**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-launch-menu.test.tsx --runInBand`

### Task 5: Update behavioral evidence and run the affected suite

**Files:**

- Modify: `test/bdd/acp-chat-agentic-history.scenario.md`
- Modify: `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`
- Modify as needed: `test/bdd/evidence/2026-07-14/acp-chat-agentic-project-catalog/report.md`

- [ ] **Step 1: Extend the scenario before its runtime test**

Cover: no MRU path picker in the Chat header; current-workspace direct launch; directory addition without IDE navigation; empty Project Group; Project Agent Recall; agent override modal; duplicate add; unavailable-project hiding; and no regression of cross-project dirty-editor switching.

- [ ] **Step 2: Run focused unit/component tests and type checks**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx packages/ai-native/__test__/browser/acp/agentic-task-launch-menu.test.tsx --runInBand`

Run: `yarn tsc --build configs/ts/references/tsconfig.ai-native.json --pretty false`

- [ ] **Step 3: Run BDD evidence and inspect the result**

Run: `OPENSUMI_BDD_EVIDENCE=1 yarn workspace @opensumi/playwright exec playwright test acp-chat-agentic-task-workbench acp-chat-agentic-history acp-chat-agentic-rich-history-restore --config ./configs/playwright.config.ts --reporter=line`

- [ ] **Step 4: Review and commit the scoped work**

Run: `git diff --check` and review the final diff against this plan before staging only the scoped files on `feat/0710`.
