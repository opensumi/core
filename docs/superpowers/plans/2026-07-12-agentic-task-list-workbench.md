# Agentic Task List Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Project-grouped Agent Task List to the existing ACP Chat Slot in Agentic Layout, beside the selected ACP conversation and without changing the existing editor or file tree workbench.

**Architecture:** Keep `AgenticShell` unchanged. In Agentic mode only, replace the current inline `AcpChatHistory` with an Agentic-only Task List; the existing `#ai_chat_view:has(...)` flex layout remains the Chat Slot's left-list and main-conversation split. Persist a sanitized Project Catalog and Task Registry, use target-aware ACP configuration for Task creation and restore, and perform cross-project activation through an Agentic-only switch adapter.

**Tech Stack:** TypeScript, React, OpenSumi DI, StorageProvider, ACP session provider/manager, `IFileServiceClient`, `IWorkspaceService`, `WorkbenchEditorService`, Jest/jsdom, Playwright, BDD Markdown.

## Global Constraints

- Touch Agentic Layout and ACP code only. Do not modify `packages/ide-layout/`, `packages/main-layout/`, `packages/ai-native/src/browser/layout/`, `AgenticShell`, or `WorkspaceService`.
- The desktop composition is Task List | Main Conversation Area | existing editor | existing file tree. The Task List is inside the ACP Chat Slot, not a header popover or IDE sidebar.
- Create new Agentic-only components. Do not change or wrap `AcpChatHistory`; Classic ACP keeps its current history behavior.
- Default Task List width is 244px; minimum is 208px; maximum is 280px. This preserves the 360px Main Conversation Area inside the existing 640px ACP Chat Slot minimum.
- Every Task has one ACP session and one Project. ACP owns status, attention, permissions, and executable actions. The frontend adds no completion inference, Stop, Retry, or pin behavior.
- Persist only session/task id, project id/URI/path/label, Agent id, timestamps, immutable title, unread/archive flags, and ACP status/attention summary. Never persist prompts, messages, permission content, commands, environments, credentials, or artifacts.
- New Task chooses Project first, then ACP Agent. A one-off Agent choice must not modify the user default Agent preference.
- Archive is available only when ACP status is `ready`, `stopped`, or `error`. No permanent client-side deletion exists.
- A different-Workspace switch offers exactly **Save All and Switch**, **Discard Changes and Switch**, and **Cancel** when any document is dirty.

---

## Task 1: Add target-aware ACP session creation and loading

**Files:**

- Modify: `packages/core-common/src/types/ai-native/agent-types.ts:123-135`
- Modify: `packages/ai-native/src/browser/chat/session-provider.ts:61-95`
- Modify: `packages/ai-native/src/browser/chat/default-acp-config-provider.ts:42-68`
- Modify: `packages/ai-native/src/browser/chat/acp-session-provider.ts:37-177`
- Modify: `packages/ai-native/src/browser/chat/chat-manager.service.acp.ts:298-315`
- Test: Create `packages/ai-native/__test__/browser/chat/default-acp-config-provider.test.ts`
- Test: Modify `packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts`

**Interfaces:** Produces `AcpTargetConfigRequest` and `SessionCreationOptions`; later Tasks pass exactly one `AcpTargetConfigRequest` for a selected Agent and target working directory.

- [ ] **Step 1: Write failing tests**

```ts
it('builds a config for the stored Agent and project path', async () => {
  await expect(provider.resolveConfigForTarget?.({ agentId: 'agent-b', cwd: '/work/b' })).resolves.toMatchObject({
    agentId: 'agent-b',
    cwd: '/work/b',
  });
});

it('passes an explicit target only to ACP session creation', async () => {
  await manager.startSession({ acpTarget: { agentId: 'agent-b', cwd: '/work/b' } });
  expect(sessionProvider.createSession).toHaveBeenCalledWith({
    acpTarget: { agentId: 'agent-b', cwd: '/work/b' },
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest packages/ai-native/__test__/browser/chat/default-acp-config-provider.test.ts packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts --runInBand`

Expected: FAIL because target-aware contracts do not exist.

- [ ] **Step 3: Implement the contract and target path**

```ts
export interface AcpTargetConfigRequest {
  agentId: string;
  cwd: string;
}
export interface SessionCreationOptions {
  acpTarget?: AcpTargetConfigRequest;
}

export interface IACPConfigProvider {
  resolveConfig(): Promise<AgentProcessConfig>;
  resolveConfigForTarget?(request: AcpTargetConfigRequest): Promise<AgentProcessConfig>;
}
```

`DefaultACPConfigProvider.resolveConfigForTarget` reuses the existing MCP servers, WebMCP setting, Node path, configured Agent map, and thread pool, but takes `agentId` and registration `cwd` from the request. Extend `ISessionProvider.createSession`, `AcpChatManagerService.startSession`, and `ACPSessionProvider.createSession` with optional `SessionCreationOptions`; only ACP consumes `acpTarget`. Task 3 adds the registry-backed target resolution used by `ACPSessionProvider.loadSession`.

- [ ] **Step 4: Run the focused tests**

Run: `yarn jest packages/ai-native/__test__/browser/chat/default-acp-config-provider.test.ts packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core-common/src/types/ai-native/agent-types.ts packages/ai-native/src/browser/chat/session-provider.ts packages/ai-native/src/browser/chat/default-acp-config-provider.ts packages/ai-native/src/browser/chat/acp-session-provider.ts packages/ai-native/src/browser/chat/chat-manager.service.acp.ts packages/ai-native/__test__/browser/chat/default-acp-config-provider.test.ts packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts
git commit -m "feat(acp): create sessions for explicit task targets"
```

## Task 2: Persist the Project Catalog and sanitized Task Registry

**Files:**

- Create: `packages/ai-native/src/browser/acp/agentic-task-registry.service.ts`
- Modify: `packages/ai-native/src/browser/acp/index.ts`
- Modify: `packages/ai-native/src/browser/index.ts`
- Test: Create `packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts`

**Interfaces:** Produces `AgenticProjectRecord`, `AgenticTaskRecord`, `AgenticTaskGroup`, and `AgenticTaskRegistryService` for the switch service and Task List.

- [ ] **Step 1: Write failing tests**

```ts
it('stores a Project reference and immutable title but not the prompt body', async () => {
  await registry.registerFirstPrompt({
    sessionId: 'acp:a',
    agentId: 'agent-a',
    project,
    firstPrompt: 'Fix list\nprivate text',
    createdAt: 1,
  });
  expect(await registry.getTask('acp:a')).toMatchObject({ projectId: project.id, title: 'Fix list' });
  expect(storage.set).toHaveBeenCalledWith('agentic.task-registry.v2', expect.not.stringContaining('private text'));
});

it('orders Projects then Tasks and consumes a prompt-free pending launch once', async () => {
  registry.preparePendingLaunch({ projectId: 'project-b', agentId: 'agent-b' });
  expect(registry.consumePendingLaunch()).toEqual({ projectId: 'project-b', agentId: 'agent-b' });
  expect(registry.consumePendingLaunch()).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts --runInBand`

Expected: FAIL because the registry service does not exist.

- [ ] **Step 3: Implement catalog, task records, and pending state**

```ts
export interface AgenticProjectRecord {
  id: string;
  workspaceUri: string;
  workspacePath: string;
  label: string;
  joinedAt: number;
  availability: 'available' | 'unavailable';
}
export interface AgenticTaskRecord {
  sessionId: string;
  projectId: string;
  agentId: string;
  title: string;
  createdAt: number;
  archived: boolean;
  unread: boolean;
  status?: ThreadStatus;
  attention?: 'permission' | 'input';
}
export interface AgenticTaskGroup {
  project: AgenticProjectRecord;
  tasks: AgenticTaskRecord[];
}
export interface AgenticTaskRegistryState {
  version: 2;
  projects: AgenticProjectRecord[];
  tasks: AgenticTaskRecord[];
}
```

Use `StorageProvider(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA)` and `agentic.task-registry.v2`. Project id is the canonical Workspace URI; preserve the first `joinedAt`. Implement `registerProject`, `registerFirstPrompt`, `getProject`, `getTask`, `listActiveGroups(query?)`, `listArchivedGroups(query?)`, `markUnread`, `updateStatus`, `updateAttention`, `markProjectAvailability`, `archive`, and `unarchive`. Archive rejects non-eligible live statuses. Keep pending activation and pending launch in `window.sessionStorage` under `agentic.pending-task-activation.v2` and `agentic.pending-task-launch.v2`.

- [ ] **Step 4: Run the focused test**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-native/src/browser/acp/agentic-task-registry.service.ts packages/ai-native/src/browser/acp/index.ts packages/ai-native/src/browser/index.ts packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts
git commit -m "feat(agentic): persist projects and task metadata"
```

## Task 3: Bind ACP lifecycle to Tasks and Agentic drafts

**Files:**

- Modify: `packages/ai-native/src/browser/chat/acp-session-provider.ts:16-177`
- Modify: `packages/ai-native/src/browser/chat/chat.internal.service.acp.ts:105-590`
- Test: Modify `packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts`
- Test: Modify `packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts`

**Interfaces:** Consumes Tasks 1–2 and produces `AcpChatInternalService.enterAgenticTaskDraft(target)`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it('starts a one-off Agentic draft with its target without writing user preferences', async () => {
  service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
  await service.ensureSessionModel();
  expect(chatManager.startSession).toHaveBeenCalledWith({ acpTarget: { agentId: 'agent-b', cwd: '/work/b' } });
  expect(preferenceService.set).not.toHaveBeenCalled();
});

it('registers the first accepted Agentic prompt and marks background content unread', async () => {
  await service.sendRequest(requestFor('Fix list\nprivate text', 'agent-b'));
  expect(registry.registerFirstPrompt).toHaveBeenCalledWith(
    expect.objectContaining({ firstPrompt: 'Fix list\nprivate text' }),
  );
  backgroundModel.history.onMessageChange.mock.calls[0][0]();
  expect(registry.markUnread).toHaveBeenCalledWith('acp:background', true);
});

it('reloads a registered Task through its stored Agent and Project target', async () => {
  registry.getTask.mockResolvedValue({ sessionId: 'acp:b', projectId: 'project-b', agentId: 'agent-b' });
  registry.getProject.mockResolvedValue({ id: 'project-b', workspacePath: '/work/b' });
  await provider.loadSession('acp:b');
  expect(configProvider.resolveConfigForTarget).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand`

Expected: FAIL because target drafts and Task observation are absent.

- [ ] **Step 3: Implement Task draft and ACP event mapping**

```ts
private pendingAgenticTarget: AcpTargetConfigRequest | undefined;

enterAgenticTaskDraft(target: AcpTargetConfigRequest): void {
  this.pendingAgenticTarget = target;
  this.enterDraftSession({ force: true });
}

private async doStartSessionModel(): Promise<ChatModel> {
  const target = this.pendingAgenticTarget;
  this._sessionModel = await this.chatManagerService.startSession(target ? { acpTarget: target } : undefined);
  this.pendingAgenticTarget = undefined;
  // retain current draft options, permission bridge, commands, and session events
}
```

Add this `ACPSessionProvider` helper before `loadSession`:

```ts
private async resolveSessionConfig(sessionId: string): Promise<AgentProcessConfig> {
  const task = await this.agenticTaskRegistry.getTask(sessionId);
  if (!task) return this.configProvider.resolveConfig();
  const project = await this.agenticTaskRegistry.getProject(task.projectId);
  if (!project || !this.configProvider.resolveConfigForTarget) {
    throw new Error('Agent Task cannot resolve its stored ACP target');
  }
  return this.configProvider.resolveConfigForTarget({ agentId: task.agentId, cwd: project.workspacePath });
}
```

After `super.sendRequest` resolves, only in `agentic` layout, construct the current Project from the canonical Workspace URI, `getCachedWorkspaceDir()`, and `workspaceService.getWorkspaceName(URI.parse(uri))`; call `registerProject` followed by `registerFirstPrompt` with session id, Agent id, original prompt, and creation time. Add one disposable listener per registered `ChatModel` for thread status, message changes, and permission bridge changes. Update registry status and attention only from ACP-backed events; set unread only when a non-active Task receives Agent content, permission, or structured input.

- [ ] **Step 4: Run the focused test**

Run: `yarn jest packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-native/src/browser/chat/acp-session-provider.ts packages/ai-native/src/browser/chat/chat.internal.service.acp.ts packages/ai-native/__test__/browser/chat/acp-chat-manager.service.test.ts packages/ai-native/__test__/browser/chat/acp-chat-internal.service.test.ts
git commit -m "feat(agentic): bind ACP sessions to durable tasks"
```

## Task 4: Add guarded Workspace-aware Task switching

**Files:**

- Create: `packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts`
- Modify: `packages/ai-native/src/browser/acp/index.ts`
- Modify: `packages/ai-native/src/browser/index.ts`
- Test: Create `packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts`

**Interfaces:** Produces `activateTask`, `launchTask`, `restorePendingWork`, and `refreshProjectAvailability` for the Task List.

- [ ] **Step 1: Write failing switch tests**

```ts
it('activates a current-project Task and clears unread without opening a Workspace', async () => {
  await switcher.activateTask(taskFor('/work/a'));
  expect(aiChatService.activateSession).toHaveBeenCalledWith('acp:a');
  expect(registry.markUnread).toHaveBeenCalledWith('acp:a', false);
  expect(workspaceService.open).not.toHaveBeenCalled();
});

it('stops a save switch when documents remain dirty and stores no activation', async () => {
  editorService.getAllOpenedDocuments.mockResolvedValueOnce([{ dirty: true }]).mockResolvedValueOnce([{ dirty: true }]);
  messageService.pick.mockResolvedValue('Save All and Switch');
  await switcher.activateTask(taskFor('/work/b'));
  expect(workspaceService.open).not.toHaveBeenCalled();
});

it('stores only project and Agent before launching in another Workspace', async () => {
  await switcher.launchTask(projectB, 'agent-b');
  expect(registry.preparePendingLaunch).toHaveBeenCalledWith({ projectId: projectB.id, agentId: 'agent-b' });
  expect(workspaceService.open).toHaveBeenCalledWith(URI.file('/work/b'), { preserveWindow: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts --runInBand`

Expected: FAIL because the switch service does not exist.

- [ ] **Step 3: Implement current-page switch and restoration**

```ts
async activateTask(task: AgenticTaskRecord): Promise<void> {
  const project = await this.registry.getProject(task.projectId);
  if (!project || project.availability === 'unavailable') return;
  if (project.workspaceUri === this.currentWorkspaceUri()) {
    await this.aiChatService.activateSession(task.sessionId);
    return this.registry.markUnread(task.sessionId, false);
  }
  if (!(await this.confirmDirtyEditors())) return;
  this.registry.preparePendingActivation(task.sessionId);
  await this.workspaceService.open(URI.file(project.workspacePath), { preserveWindow: true });
}
```

`seedProjectCatalog` awaits `workspaceService.whenReady`, registers the current Workspace, then reads `getMostRecentlyUsedWorkspaces()`. It accepts an MRU URI only when `IFileServiceClient.getFileStat(uri, false)` resolves and registers the resulting canonical URI/path/label as a Project; it accepts no free-form path. `confirmDirtyEditors` checks `getAllOpenedDocuments()`. Save calls `saveAll(true)` then rechecks; it must not switch while anything remains dirty. Discard calls `closeAll(undefined, true)` only after explicit selection. `launchTask(project, agentId)` enters a target draft for the current Project, or stores only `{ projectId, agentId }` before opening another Project. `restorePendingWork` restores activation first; otherwise it consumes the launch and calls `enterAgenticTaskDraft`. Availability uses `IFileServiceClient.getFileStat(project.workspaceUri, false)` and disables inaccessible Projects.

- [ ] **Step 4: Run the focused test**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts packages/ai-native/src/browser/acp/index.ts packages/ai-native/src/browser/index.ts packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts
git commit -m "feat(agentic): switch workspaces for task selection"
```

## Task 5: Build Agentic-only Task List and launcher components

**Files:**

- Create: `packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx`
- Create: `packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx`
- Create: `packages/ai-native/src/browser/acp/components/agentic-task-list.module.less`
- Test: Create `packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx`
- Test: Create `packages/ai-native/__test__/browser/acp/agentic-task-launch-menu.test.tsx`

**Interfaces:** Produces `agentic-task-list`, `agentic-task-project-group`, `agentic-task-row-<session-id>`, `agentic-task-launch-button`, and `agentic-task-archive-<session-id>` test ids.

- [ ] **Step 1: Write failing UI tests**

```tsx
it('sorts Project Groups and Task Rows and filters immutable titles', async () => {
  registry.listActiveGroups.mockResolvedValue([groupB, groupA]);
  render(<AgenticTaskList />);
  await user.type(screen.getByPlaceholderText('Search tasks'), 'layout');
  expect(screen.getByText('Fix layout')).toBeVisible();
  expect(screen.queryByText('Old task')).toBeNull();
});

it('renders attention before status, archives eligible Tasks, and disables unavailable Projects', async () => {
  render(<AgenticTaskList />);
  expect(screen.getByTestId('agentic-task-attention-acp:permission')).toBeVisible();
  await user.click(screen.getByTestId('agentic-task-archive-acp:ready'));
  expect(registry.archive).toHaveBeenCalledWith('acp:ready', 'ready');
  await user.click(screen.getByTestId('agentic-task-row-acp:unavailable'));
  expect(workspaceSwitch.activateTask).not.toHaveBeenCalled();
});

it('selects Project before Agent and leaves the default Agent preference unchanged', async () => {
  render(<AgenticTaskLaunchMenu projects={[projectB]} />);
  await user.click(screen.getByTestId('agentic-task-launch-button'));
  await user.click(screen.getByText('Project B'));
  await user.click(screen.getByText('Agent B'));
  expect(workspaceSwitch.launchTask).toHaveBeenCalledWith(projectB, 'agent-b');
  expect(preferenceService.set).not.toHaveBeenCalled();
});

it('clamps local Task List resizing to the Agentic Chat Slot bounds', async () => {
  render(<AgenticTaskList />);
  await user.pointer([
    { target: screen.getByTestId('agentic-task-list-resize-handle'), keys: '[MouseLeft>]' },
    { coords: { x: 120, y: 0 } },
    { keys: '[/MouseLeft]' },
  ]);
  expect(document.querySelector('#ai_chat_view')?.style.getPropertyValue('--agentic-task-list-width')).toBe('280px');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx packages/ai-native/__test__/browser/acp/agentic-task-launch-menu.test.tsx --runInBand`

Expected: FAIL because the Agentic-only components do not exist.

- [ ] **Step 3: Implement the list and Project-first launcher**

```tsx
export function AgenticTaskList() {
  const [query, setQuery] = React.useState('');
  const [groups, setGroups] = React.useState<AgenticTaskGroup[]>([]);
  const resize = React.useCallback((width: number) => {
    document
      .querySelector('#ai_chat_view')
      ?.style.setProperty('--agentic-task-list-width', `${Math.max(208, Math.min(280, width))}px`);
  }, []);
  const refresh = React.useCallback(async () => {
    await workspaceSwitch.refreshProjectAvailability();
    setGroups(await registry.listActiveGroups(query));
  }, [query, registry, workspaceSwitch]);
  React.useEffect(() => void refresh(), [refresh]);
  return (
    <aside data-testid='agentic-task-list' className={styles.task_list}>
      <TaskListResizeHandle onResize={resize} />
      <AgenticTaskLaunchMenu />
      {groups.map((group) => (
        <ProjectGroup key={group.project.id} group={group} query={query} />
      ))}
      <ArchivedTaskGroups query={query} />
    </aside>
  );
}
```

Define `TaskListResizeHandle`, `ProjectGroup`, and `ArchivedTaskGroups` in the same module. `TaskListResizeHandle` uses pointer capture and calls `onResize(startWidth + event.clientX - startX)` on pointer move; it has `role='separator'`, `aria-orientation='vertical'`, and test id `agentic-task-list-resize-handle`. Render Task List header, attention total, title search, grouped rows, per-Project New Task control, and a collapsed Archived Area. A pending permission/input icon replaces the normal status icon; unread remains independent. Only eligible live statuses expose archive. `AgenticTaskLaunchMenu` selects an existing validated Project then an ACP Agent through existing picker primitives and calls `workspaceSwitch.launchTask(project, agentId)` without calling `PreferenceService.set`.

- [ ] **Step 4: Run the focused tests**

Run: `yarn jest packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx packages/ai-native/__test__/browser/acp/agentic-task-launch-menu.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-native/src/browser/acp/components/AgenticTaskList.tsx packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx packages/ai-native/src/browser/acp/components/agentic-task-list.module.less packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx packages/ai-native/__test__/browser/acp/agentic-task-launch-menu.test.tsx
git commit -m "feat(agentic): add persistent project task list"
```

## Task 6: Integrate the Task List into the current ACP Chat Slot

**Files:**

- Modify: `packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx:35-340`
- Modify: `packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx:67-220`
- Modify: `packages/ai-native/src/browser/chat/chat.module.less:523-616`
- Test: Modify `packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx`
- Test: Modify `packages/ai-native/__test__/browser/acp-chat-history.test.tsx`

**Interfaces:** Consumes Task 4 switch restoration and Task 5 UI while preserving `AcpChatHistory` in Classic mode.

- [ ] **Step 1: Write failing integration tests**

```tsx
it('renders the persistent Task List only in Agentic Layout', () => {
  renderHeader({ panelLayout: 'agentic' });
  expect(screen.getByTestId('agentic-task-list')).toBeVisible();
  expect(screen.queryByTestId('acp-chat-history-inline')).toBeNull();
});

it('keeps Classic ACP history and Agentic maximize behavior', () => {
  renderHeader({ panelLayout: 'classic' });
  expect(screen.getByTestId('acp-chat-history-button')).toBeVisible();
  render(<AgenticChatPanelHeader sessionModel={sessionModel} />);
  expect(screen.getByTestId('agentic-chat-panel-header-maximize')).toBeVisible();
  expect(screen.queryByTestId('agentic-chat-new-session-button')).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx packages/ai-native/__test__/browser/acp-chat-history.test.tsx --runInBand`

Expected: FAIL because Agentic mode still uses inline `AcpChatHistory` and the default-Agent New Session menu.

- [ ] **Step 3: Implement the narrow integration**

```tsx
return isAgenticLayout ? (
  <div className={cls(styles.header, styles.header_agentic)}>
    <AgenticTaskList />
  </div>
) : (
  <div className={styles.header}>
    <AcpChatHistory
      currentId={aiChatService.sessionModel?.sessionId}
      title={currentTitle}
      historyList={historyList}
      variant='popover'
      historyLoading={historyLoading}
      disabled={sessionSwitching}
      onNewChat={handleNewChat}
      onHistoryItemSelect={handleHistoryItemSelect}
      onHistoryItemChange={handleHistoryItemChange}
      onHistoryPopoverVisibleChange={handleHistoryPopoverVisibleChange}
    />
    {switchWorkspaceDirAction}
  </div>
);
```

Keep the existing Classic-only close action after this branch. Replace the selector `:has(.chat_history_agentic)` with `:has(.agentic_task_list)` in `chat.module.less`. Set only its Agentic header container to `clamp(208px, var(--agentic-task-list-width, 244px), 280px)` and retain its body-container and Agentic main conversation rules. Remove the Agentic history-collapse state. Remove `AgenticChatHeaderNewSessionMenu` from the rendered Agentic panel actions but retain `AgenticChatHeaderMaximizeAction`. On Agentic header mount, call `workspaceSwitch.restorePendingWork()` once after ACP initialization.

- [ ] **Step 4: Run the focused tests**

Run: `yarn jest packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx packages/ai-native/__test__/browser/acp-chat-history.test.tsx packages/ai-native/__test__/browser/acp/agentic-task-list.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx packages/ai-native/src/browser/chat/chat.module.less packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx packages/ai-native/__test__/browser/acp-chat-history.test.tsx
git commit -m "feat(agentic): compose task list inside chat slot"
```

## Task 7: Verify four-region behavior, reload, and data safety

**Files:**

- Modify: `test/bdd/acp-chat-agentic-history.scenario.md`
- Modify: `tools/playwright/src/tests/acp-chat-agentic-history.test.ts`
- Modify: `tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts`
- Test: Modify `packages/ai-native/__test__/browser/acp-chat-view-wrapper.test.tsx`
- Test: Modify `packages/ai-native/__test__/node/acp-agent.service.test.ts`

**Interfaces:** Validates the persisted registry, Task List, target restoration, and unchanged Agentic Workbench in a real IDE.

- [ ] **Step 1: Replace BDD popover assertions with Task List behavior**

```md
1. Open Agentic Layout and assert Task List, Main Conversation Area, editor, and file tree are visible together.
2. Assert Project Groups sort by joined time and Task Rows by creation time.
3. Search immutable task titles and assert nonmatching rows are absent.
4. Select a current-project row and assert the session id changes without Workspace reload.
5. Select a different-project row and cover Save All, Discard, and Cancel outcomes.
6. Archive and unarchive a ready Task; verify a background permission renders attention on its row.
7. Launch a cross-project Task and assert persisted evidence contains no prompt or permission sentinel.
```

- [ ] **Step 2: Add Playwright helpers and assertions**

```ts
async function expectAgenticFourRegions() {
  await expect(page.getByTestId('agentic-task-list')).toBeVisible();
  await expect(page.getByTestId('agentic-chat-panel-header')).toBeVisible();
  await expect(page.locator('#main-horizontal-agentic')).toBeVisible();
}
async function selectTask(sessionId: string) {
  await page.getByTestId(`agentic-task-row-${sessionId}`).click();
  await expect.poll(async () => (await getSessionState()).session?.sessionId).toBe(sessionId);
}
```

Assert storage evidence excludes prompt, assistant, thought, tool-result, and permission-content fixture sentinels. Assert `acp-chat-history-inline` is absent only in Agentic mode; retain its Classic regression coverage.

- [ ] **Step 3: Run focused Jest verification**

Run: `yarn jest packages/ai-native/__test__/browser/acp-chat-view-wrapper.test.tsx packages/ai-native/__test__/browser/acp-chat-view-header.test.tsx packages/ai-native/__test__/browser/acp/agentic-task-registry.service.test.ts packages/ai-native/__test__/browser/acp/agentic-workspace-switch.service.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 4: Run runtime verification and scope audit**

Run: `yarn playwright test tools/playwright/src/tests/acp-chat-agentic-history.test.ts tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts`

Expected: PASS with the deterministic ACP fixture.

Run: `git diff --check && git diff --name-only`

Expected: no whitespace errors and no implementation file under `packages/ide-layout/`, `packages/main-layout/`, or `packages/ai-native/src/browser/layout/`.

- [ ] **Step 5: Commit**

```bash
git add test/bdd/acp-chat-agentic-history.scenario.md tools/playwright/src/tests/acp-chat-agentic-history.test.ts tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts packages/ai-native/__test__/browser/acp-chat-view-wrapper.test.tsx packages/ai-native/__test__/node/acp-agent.service.test.ts
git commit -m "test(agentic): cover persistent task list workbench"
```

## Plan Self-Review

- **Spec coverage:** Tasks 5–6 implement the confirmed four-region workbench; Tasks 2 and 5 cover Project grouping, search, archive, attention, unread, disabled Projects, and Project-first launch; Tasks 1, 3, and 4 cover target creation/restoration and dirty-editor safety; Task 7 covers runtime layout and storage safety.
- **Isolation:** No Task modifies `AgenticShell`, `WorkspaceService`, IDE Layout files, or shared workbench composition. `AcpChatHistory` stays Classic-only; new behavior is under Agentic ACP components.
- **Contract consistency:** `AcpTargetConfigRequest` is the sole `{ agentId, cwd }` target contract. Every Task references `projectId`, which resolves through the catalog record and prevents ordering or availability drift.
- **Placeholder scan:** Each Task has exact files, a failing assertion, implementation API, command, expected result, and commit boundary.
