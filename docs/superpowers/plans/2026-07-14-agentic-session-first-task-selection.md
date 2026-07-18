# Agentic Session-first Task Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore and launch Agent Tasks for any known Project without navigating or reloading the IDE workspace.

**Architecture:** Keep the IDE workspace lifecycle untouched. Add an ACP-only task-session activation operation that is atomic, preserves the current chat on failure, and ignores superseded asynchronous selections. Make `AgenticWorkspaceSwitchService` a Task launch/selection coordinator rather than a workspace navigator, then have the Agentic header derive its launch target and context label from the active Task.

**Tech Stack:** TypeScript, React, OpenSumi DI, Jest, Playwright BDD.

## Global Constraints

- Change only Agentic Layout ACP code; do not alter IDE Layout or shared editor/file-tree lifecycle.
- A Task's `workspacePath` remains the ACP Agent working directory, even when it differs from the current IDE workspace.
- Task activation and Project-group Task launch must not call `IWindowService.openWorkspace`, `IWorkspaceService.open`, or dirty-editor confirmation code.
- The latest selection wins; a failed selection preserves the previously active ACP session and does not clear the candidate Task's unread marker.
- Cross-project diff/file navigation is out of scope.

---

### Task 1: Make ACP task-session activation atomic

**Files:**

- Modify: `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts:774-803`
- Test: `packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts`

**Interfaces:**

- Produces: `AcpChatInternalService.activateAgenticTaskSession(sessionId: string): Promise<boolean>`.
- Consumes: `AcpChatManagerService.loadSession(sessionId)` and `getSession(sessionId)`.
- Preserves: `activateSession(sessionId)` retains its existing generic fallback-to-draft behavior for non-Task callers.

- [x] **Step 1: Write the failing ACP selection tests**

```ts
it('keeps the active ACP session when an Agentic Task session cannot load', async () => {
  const { chatManagerService, service } = createService({ sessionModel: currentModel });
  chatManagerService.loadSession.mockRejectedValueOnce(new Error('Session not found'));

  await expect(service.activateAgenticTaskSession('acp:missing')).resolves.toBe(false);

  expect(service.sessionModel).toBe(currentModel);
});

it('activates only the latest overlapping Agentic Task selection', async () => {
  const { chatManagerService, service } = createService({ sessionModel: currentModel });
  let resolveFirst!: () => void;
  let resolveSecond!: () => void;
  const firstLoad = new Promise<void>((resolve) => (resolveFirst = resolve));
  const secondLoad = new Promise<void>((resolve) => (resolveSecond = resolve));
  chatManagerService.loadSession.mockImplementation((id) => (id === 'acp:first' ? firstLoad : secondLoad));

  const firstActivation = service.activateAgenticTaskSession('acp:first');
  const secondActivation = service.activateAgenticTaskSession('acp:second');
  resolveSecond();
  await secondActivation;
  resolveFirst();

  await expect(firstActivation).resolves.toBe(false);
  expect(service.sessionModel?.sessionId).toBe('acp:second');
});
```

- [x] **Step 2: Run the focused test to verify RED**

Run: `yarn jest packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand`

Expected: failure because `activateAgenticTaskSession` does not exist.

- [x] **Step 3: Implement the ACP-only activation path**

```ts
async activateAgenticTaskSession(sessionId: string): Promise<boolean> {
  const selectionVersion = ++this.agenticTaskSelectionVersion;
  this._onSessionLoadingChange.fire(true);
  try {
    await (this.chatManagerService as AcpChatManagerService).loadSession(sessionId);
    const session = this.chatManagerService.getSession(sessionId);
    if (selectionVersion !== this.agenticTaskSelectionVersion || !session) {
      return false;
    }
    this.applyActivatedSession(sessionId, session);
    return true;
  } catch (error) {
    if (selectionVersion === this.agenticTaskSelectionVersion) {
      this.messageService.info(formatAcpLoadSessionFallbackMessage(error));
    }
    return false;
  } finally {
    if (selectionVersion === this.agenticTaskSelectionVersion) {
      this._onSessionLoadingChange.fire(false);
    }
  }
}
```

Extract shared successful-session notification into a private helper so generic `activateSession` retains its current behavior without duplicating state publication.

- [x] **Step 4: Run the focused test to verify GREEN**

Run: `yarn jest packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand`

Expected: PASS.

### Task 2: Remove workspace navigation from Task selection and launch

**Files:**

- Modify: `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts:1-190`
- Test: `packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts`

**Interfaces:**

- Consumes: `activateAgenticTaskSession(sessionId): Promise<boolean>` from Task 1.
- Produces: `activateTask(task): Promise<boolean>` and `launchTask(project, agentId): Promise<boolean>` with no workspace navigation side effects.

- [x] **Step 1: Replace cross-workspace tests with failing session-first assertions**

```ts
it('activates a foreign-project Task without prompting or opening a Workspace', async () => {
  registry.getProject.mockResolvedValue(projectB);
  aiChatService.activateAgenticTaskSession.mockResolvedValue(true);

  await expect(switcher.activateTask(taskFor('/work/b'))).resolves.toBe(true);

  expect(aiChatService.activateAgenticTaskSession).toHaveBeenCalledWith('acp:b');
  expect(registry.markUnread).toHaveBeenCalledWith('acp:b', false);
  expect(windowService.openWorkspace).not.toHaveBeenCalled();
  expect(dialogService.warning).not.toHaveBeenCalled();
});

it('launches a foreign Project draft without workspace navigation', async () => {
  registry.getProject.mockResolvedValue(projectB);

  await expect(switcher.launchTask(projectB, 'agent-b')).resolves.toBe(true);

  expect(aiChatService.enterAgenticTaskDraft).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' });
  expect(registry.preparePendingLaunch).toHaveBeenCalledWith({ projectId: projectB.id, agentId: 'agent-b' });
  expect(windowService.openWorkspace).not.toHaveBeenCalled();
  expect(dialogService.warning).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run the focused test to verify RED**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts --runInBand`

Expected: failure because the service currently opens the foreign workspace and has no ACP task activation method.

- [x] **Step 3: Simplify the coordinator**

Remove `IWindowService`, `WorkbenchEditorService`, `IDialogService`, the save/discard constants, and dirty-editor helpers. For available registered Projects, call the ACP-only activation path and mark unread only on `true`. For launches, retain Project validation, pending-launch registration, and Agent Recall; immediately call `enterAgenticTaskDraft({ agentId, cwd: targetProject.workspacePath })` for both current and foreign Projects.

- [x] **Step 4: Run the focused test to verify GREEN**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts --runInBand`

Expected: PASS.

### Task 3: Make Task List and Header reflect the selected Task context

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx:628-638`
- Modify: `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx:72-136`
- Modify: `packages/ai-native/src/browser/chat/chat.module.less`
- Test: `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`
- Test: `packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx`

**Interfaces:**

- Consumes: `activateTask(task): Promise<boolean>` from Task 2 and `AgenticTaskRegistryService.getTask/getProject`.
- Produces: a Task Row becomes active only after a successful current selection; Header `+` targets the active Task's Project; `agentic-task-execution-context` renders only for a foreign target.

- [x] **Step 1: Write failing component tests**

```tsx
it('does not replace the active Task Row when the requested Task session fails to activate', async () => {
  services.workspaceSwitch.activateTask.mockResolvedValue(false);
  await clickTaskRow('acp:ready');

  expect(container.querySelector('[data-testid="agentic-task-row-acp:ready"]')).not.toHaveAttribute(
    'aria-current',
    'true',
  );
});

it('uses the active Task Project for Header New Task and displays a foreign execution context', async () => {
  registry.getTask.mockResolvedValue({ sessionId: 'acp:other', projectId: otherProject.id, agentId: 'agent-b' });
  registry.getProject.mockImplementation((id) =>
    Promise.resolve(id === otherProject.id ? otherProject : currentProject),
  );

  renderHeader(otherSessionModel);

  expect(screen.getByTestId('agentic-task-execution-context')).toHaveAttribute('title', otherProject.workspacePath);
  expect(launchMenuProps.project).toEqual(otherProject);
});
```

- [x] **Step 2: Run component tests to verify RED**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx --runInBand`

Expected: failure because Task List commits selection before activation and Header always resolves the IDE workspace Project.

- [x] **Step 3: Implement current-context UI behavior**

Await `activateTask` in `AgenticTaskList` and guard its completion with an incrementing React ref so only the most recent successful request updates `activeSessionId`. In the Header, resolve `activeTask.projectId` before falling back to the current workspace Project, then render the labelled, full-path-tooltip execution-context element only when the two paths differ. Keep the Header `+` and maximize action ordering unchanged.

- [x] **Step 4: Run component tests to verify GREEN**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx --runInBand`

Expected: PASS.

### Task 4: Update behavior specifications and runtime regression coverage

**Files:**

- Modify: `test/bdd/acp-chat-agentic-history.scenario.md`
- Modify: `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`
- Modify: `docs/superpowers/specs/2026-07-13-agentic-task-list-usability-design.md`
- Modify: `packages/ai-native/CONTEXT.md`
- Modify: `docs/adr/0003-launch-tasks-only-for-known-workspace-targets.md`
- Modify: `docs/adr/0017-switch-workspace-with-the-selected-agent-task.md`
- Create: `docs/adr/0020-keep-agent-task-selection-session-first.md`

**Interfaces:**

- Consumes: visible Task Row, ACP session state, browser URL, and Header context test IDs from Tasks 1-3.
- Produces: executable BDD evidence that foreign Task selection and Project-group launch keep the current workbench URL and workspace intact.

- [ ] **Step 1: Rewrite the BDD expectation before changing the runtime test**

Replace the cross-project dirty-editor switch section with assertions that `Other ready` activates in place, preserves the current workspace URL/cwd, clears unread after success, and never displays a save/discard dialog. Update Project-group `+` and Header `+` assertions to use the selected Task Project's path without navigation.

- [ ] **Step 2: Run the BDD scenario to verify RED**

Run: `OPENSUMI_BDD_EVIDENCE=1 yarn workspace @opensumi/playwright exec playwright test acp-chat-agentic-task-workbench --config ./configs/playwright.config.ts --reporter=line`

Expected: failure at the old workspace-navigation expectation.

- [ ] **Step 3: Update Playwright assertions and evidence**

```ts
const urlBeforeSelection = page.url();
await selectTask(otherReadySessionId);
await expectSession(otherReadySessionId);
expect(page.url()).toBe(urlBeforeSelection);
await expect(page.getByTestId('agentic-task-execution-context')).toHaveAttribute('title', otherWorkspaceDir);

const urlBeforeLaunch = page.url();
await otherGroup.getByTestId('agentic-task-launch-button').click();
await expect(page.getByTestId('acp-chat-input')).toBeVisible();
expect(page.url()).toBe(urlBeforeLaunch);
```

Keep fixture setup navigation isolated from the behavior under test. Do not add cross-project file-navigation coverage.

- [ ] **Step 4: Run focused verification**

Run:

```sh
yarn jest packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx --runInBand
yarn tsc --build configs/ts/references/tsconfig.ai-native.json configs/ts/references/tsconfig.playwright.json --pretty false
OPENSUMI_BDD_EVIDENCE=1 yarn workspace @opensumi/playwright exec playwright test acp-chat-agentic-task-workbench --config ./configs/playwright.config.ts --reporter=line
git diff --check
```

Expected: all focused tests, TypeScript builds, runtime BDD, and diff checks pass.

### Task 5: Persist a newly prompted Task under its Agent target Project

**Files:**

- Modify: `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts:424-461`
- Test: `packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts`
- Test: `tools/playwright/src/tests/acp-chat-agentic-task-workbench.test.ts`

**Interfaces:**

- Consumes: `agenticTaskTargets.get(sessionId): { agentId: string; cwd: string }` created by `doStartSessionModel`.
- Produces: `AgenticTaskRegistryService.registerFirstPrompt` receives the target Project identified by that `cwd`, rather than the current IDE Workspace, for an Agent-bound draft.

- [ ] **Step 1: Write the failing project-binding regression test**

```ts
it('registers the first prompt under an Agentic draft target instead of the current IDE workspace', async () => {
  const { registry, service } = createService();
  service.agenticTaskTargets.set('acp:foreign', { agentId: 'agent-b', cwd: '/work/other' });
  workspaceService.workspace = { uri: URI.file('/work/current').toString() };

  await service.registerFirstAgenticPrompt(requestFor('acp:foreign', 'agent-b'), 'acp:foreign');

  expect(registry.registerFirstPrompt).toHaveBeenCalledWith(
    expect.objectContaining({ project: expect.objectContaining({ workspacePath: '/work/other' }) }),
  );
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `yarn jest packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand`

Expected: failure because `registerFirstAgenticPrompt` currently derives the Project from `workspaceService.workspace` and `getCachedWorkspaceDir()`.

- [ ] **Step 3: Preserve target Project identity during first-prompt registration**

```ts
const target = this.agenticTaskTargets.get(sessionId);
const project = target
  ? {
      workspaceUri: URI.file(target.cwd).toString(),
      workspacePath: target.cwd,
      joinedAt: Date.now(),
      availability: 'available' as const,
    }
  : currentWorkspaceProject;
```

Retain the current-workspace fallback for ordinary Header drafts without an explicit Agentic target. Use the resolved target Agent ID, register the Project, register the first prompt, and only then clear `agenticTaskTargets`.

- [ ] **Step 4: Run focused unit and runtime verification**

Run:

```sh
yarn jest packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand
OPENSUMI_BDD_EVIDENCE=1 yarn workspace @opensumi/playwright exec playwright test acp-chat-agentic-task-workbench --config ./configs/playwright.config.ts --reporter=line
```

Expected: the Project Other draft receives a Task Row in Project Other while the URL, current IDE workspace, and dirty editor remain unchanged.
