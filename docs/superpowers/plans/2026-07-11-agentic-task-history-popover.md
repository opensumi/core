# Superseded: Agentic Task History Popover Implementation Plan

> Superseded on 2026-07-12 by the accepted persistent Task List design. Do not execute this plan: its header-popover architecture conflicts with [the current design](../specs/2026-07-12-agentic-layout-task-manager-design.md) and ADR 0019. A replacement implementation plan must compose the Task List inside the existing ACP Chat Slot.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Extend Agentic Layout with an anchored cross-project ACP Task History popover that switches the current Workspace and restores the selected ACP session without changing IDE Layout behavior.

**Architecture:** Persist sanitized Agentic Task metadata in global storage and keep the current-tab activation id in session storage. A target-aware ACP configuration path reloads a Task using its stored Agent id and project path. Agentic Layout renders new popover and launch components; classic chat continues to render the existing AcpChatHistory component unchanged.

**Tech Stack:** TypeScript, React, OpenSumi DI, StorageProvider, ACP session provider, Jest/jsdom, Playwright, BDD Markdown.

## Global Constraints

- Modify Agentic Layout and ACP code only. Do not change IDE Layout lifecycle, Workspace implementation, or shared layout interactions.
- Use new Agentic-only components for Task UI. Only reuse stable primitives: StorageProvider, WorkspaceService, WorkbenchEditorService, Popover, QuickPickService.
- Every Task has exactly one ACP session and one Workspace Target.
- ACP owns task status, attention requests, and executable actions. The UI must not infer completion or add Stop/Retry controls.
- Store only session id, agent id, project URI/path/label, joined/created timestamps, immutable title, unread/archive flags, and ACP status/attention summary. Never store prompt bodies, messages, permissions, commands, environment variables, or credentials.
- Titles derive from the first line of the first user prompt, are truncated to 100 characters, and are never editable.
- Archive replaces deletion. Only ready, stopped, and error Tasks can be archived.
- Selecting another project reuses the current page. If editors are dirty, offer Save All and Switch, Discard Changes and Switch, or Cancel.
- Keep ADR 0016, ADR 0017, and ADR 0018 authoritative.

---

## Task 1: Add target-aware ACP configuration

**Files:**

- Modify: packages/core-common/src/types/ai-native/agent-types.ts:123-142
- Modify: packages/ai-native/src/browser/chat/default-acp-config-provider.ts:31-64
- Test: Create packages/ai-native/**test**/browser/chat/default-acp-config-provider.test.ts

**Interfaces:**

- Produces AcpTargetConfigRequest and optional IACPConfigProvider.resolveConfigForTarget.
- ACPSessionProvider consumes this in Task 3.

- [ ] **Step 1: Write the failing tests**

  it('builds a config for the stored agent and project path', async () => { const provider = createProvider({ defaultAgentId: 'agent-a', configuredAgents: { 'agent-b': { command: 'agent-binary', args: ['serve'], env: { MODE: 'task' } }, }, });

      await expect(
        provider.resolveConfigForTarget({ agentId: 'agent-b', cwd: '/work/project-b' }),
      ).resolves.toMatchObject({
        agentId: 'agent-b',
        command: 'agent-binary',
        args: ['serve'],
        cwd: '/work/project-b',
        env: [{ name: 'MODE', value: 'task' }],
      });

  });

  it('does not change default current-workspace resolution', async () => { const provider = createProvider({ defaultAgentId: 'agent-a', workspaceDir: '/work/current' }); await expect(provider.resolveConfig()).resolves.toMatchObject({ agentId: 'agent-a', cwd: '/work/current', }); });

- [ ] **Step 2: Run the test to verify it fails**

Run: yarn jest packages/ai-native/**test**/browser/chat/default-acp-config-provider.test.ts --runInBand

Expected: FAIL because resolveConfigForTarget is undefined.

- [ ] **Step 3: Implement the optional contract and default provider method**

  export interface AcpTargetConfigRequest { agentId: string; cwd: string; }

  export interface IACPConfigProvider { resolveConfig(): Promise<AgentProcessConfig>; resolveConfigForTarget?(request: AcpTargetConfigRequest): Promise<AgentProcessConfig>; }

  async resolveConfigForTarget(request: AcpTargetConfigRequest): Promise<AgentProcessConfig> { const agentConfig = getAgentConfig(this.preferenceService, request.agentId); const mcpServers = await this.mcpConfigService.getACPServers(); const webMcpEnabled = await this.mcpConfigService.isBuiltinMCPEnabled(); return buildAcpAgentProcessConfig({ agentId: request.agentId, registration: { command: agentConfig.command, args: agentConfig.args, cwd: request.cwd }, userPreferences: { nodePath: this.preferenceService.get('ai-native.acp.nodePath', ''), agents: this.preferenceService.get('ai-native.acp.agents', {}), threadPoolSize: this.preferenceService.get( AINativeSettingSectionsId.AcpThreadPoolSize, DEFAULT_ACP_THREAD_POOL_SIZE, ), webMcpEnabled, }, mcpServers, }); }

Keep resolveConfig unchanged. The new method is optional, preserving external provider source compatibility.

- [ ] **Step 4: Run focused tests**

Run: yarn jest packages/ai-native/**test**/browser/chat/default-acp-config-provider.test.ts packages/ai-native/**test**/browser/acp/build-agent-process-config.test.ts --runInBand

Expected: PASS.

- [ ] **Step 5: Commit**

  git add packages/core-common/src/types/ai-native/agent-types.ts packages/ai-native/src/browser/chat/default-acp-config-provider.ts packages/ai-native/**test**/browser/chat/default-acp-config-provider.test.ts git commit -m "feat(acp): resolve config for a task target"

## Task 2: Persist sanitized Agentic Task and Project metadata

**Files:**

- Create: packages/ai-native/src/browser/acp/agentic-task-registry.service.ts
- Modify: packages/ai-native/src/browser/acp/index.ts
- Modify: packages/ai-native/src/browser/index.ts
- Test: Create packages/ai-native/**test**/browser/acp/agentic-task-registry.service.test.ts

**Interfaces:**

- Produces AgenticTaskRecord, AgenticProjectRecord, and AgenticTaskRegistryService.
- Consumed by the popover, launcher, session provider, and switch service.

- [ ] **Step 1: Write the failing registry tests**

  it('stores metadata but not the full first prompt', async () => { await registry.registerSentTask({ sessionId: 'acp:a', agentId: 'claude-agent-acp', workspaceUri: 'file:///work/a', workspacePath: '/work/a', projectLabel: 'a', firstPrompt: 'Fix layout\nThe remaining prompt must not persist', createdAt: 100, });

      expect((await registry.get('acp:a'))).toMatchObject({
        sessionId: 'acp:a',
        agentId: 'claude-agent-acp',
        workspacePath: '/work/a',
        title: 'Fix layout',
        archived: false,
        unread: false,
      });
      expect(storage.set).toHaveBeenCalledWith(
        'agentic.task-registry.v1',
        expect.not.stringContaining('remaining prompt'),
      );

  });

  it('keeps the first title immutable and archives only an eligible status', async () => { await registry.registerSentTask(taskInput({ firstPrompt: 'First title' })); await registry.registerSentTask(taskInput({ firstPrompt: 'Second title' })); await registry.archive('acp:a', 'ready');

      expect((await registry.get('acp:a')).title).toBe('First title');
      expect(await registry.listActive()).toEqual([]);
      expect((await registry.listArchived())[0].sessionId).toBe('acp:a');
      await expect(registry.archive('acp:a', 'running')).rejects.toThrow('cannot be archived');

  });

  it('consumes a reload activation only once in the current tab', () => { registry.preparePendingActivation('acp:a'); expect(registry.consumePendingActivation()).toBe('acp:a'); expect(registry.consumePendingActivation()).toBeUndefined(); });

- [ ] **Step 2: Run the test to verify it fails**

Run: yarn jest packages/ai-native/**test**/browser/acp/agentic-task-registry.service.test.ts --runInBand

Expected: FAIL because AgenticTaskRegistryService is missing.

- [ ] **Step 3: Implement the registry**

  export interface AgenticTaskRecord { sessionId: string; agentId: string; workspaceUri: string; workspacePath: string; projectLabel: string; projectJoinedAt: number; title: string; createdAt: number; archived: boolean; unread: boolean; status?: ThreadStatus; attention?: 'permission' | 'input'; unavailable?: boolean; }

  @Injectable() export class AgenticTaskRegistryService { private async read(): Promise<AgenticTaskRecord[]> { const storage = await this.storageProvider(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA); return storage.get<AgenticTaskRecord[]>('agentic.task-registry.v1', []); }

      private async write(tasks: AgenticTaskRecord[]): Promise<void> {
        const storage = await this.storageProvider(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA);
        await storage.set('agentic.task-registry.v1', tasks);
      }

      private async update(
        sessionId: string,
        mutate: (task: AgenticTaskRecord) => AgenticTaskRecord,
      ): Promise<void> {
        const tasks = await this.read();
        const index = tasks.findIndex((task) => task.sessionId === sessionId);
        if (index < 0) throw new Error('Unknown Agent Task ' + sessionId);
        tasks[index] = mutate(tasks[index]);
        await this.write(tasks);
      }

      async registerSentTask(input: RegisterSentTaskInput): Promise<AgenticTaskRecord> {
        const tasks = await this.read();
        const existing = tasks.find((task) => task.sessionId === input.sessionId);
        if (existing) return existing;
        const projectJoinedAt = tasks.find((task) => task.workspaceUri === input.workspaceUri)?.projectJoinedAt ?? input.createdAt;
        const task: AgenticTaskRecord = {
          sessionId: input.sessionId, agentId: input.agentId, workspaceUri: input.workspaceUri,
          workspacePath: input.workspacePath, projectLabel: input.projectLabel, projectJoinedAt,
          title: input.firstPrompt.split('\n')[0].trim().slice(0, 100), createdAt: input.createdAt,
          archived: false, unread: false,
        };
        tasks.push(task);
        await this.write(tasks);
        return task;
      }

      async get(sessionId: string): Promise<AgenticTaskRecord | undefined> {
        return (await this.read()).find((task) => task.sessionId === sessionId);
      }

      async listActive(): Promise<AgenticTaskRecord[]> {
        return (await this.read()).filter((task) => !task.archived).sort(compareTasks);
      }

      async listArchived(): Promise<AgenticTaskRecord[]> {
        return (await this.read()).filter((task) => task.archived).sort(compareTasks);
      }

      async markUnread(sessionId: string, unread: boolean): Promise<void> {
        await this.update(sessionId, (task) => ({ ...task, unread }));
      }

      async archive(sessionId: string, status: ThreadStatus): Promise<void> {
        if (!['ready', 'stopped', 'error'].includes(status)) throw new Error('Task cannot be archived while ' + status);
        await this.update(sessionId, (task) => ({ ...task, archived: true, unread: false }));
      }

      async unarchive(sessionId: string): Promise<void> {
        await this.update(sessionId, (task) => ({ ...task, archived: false }));
      }

      preparePendingActivation(sessionId: string): void {
        window.sessionStorage.setItem('agentic.pending-task-activation.v1', sessionId);
      }

      consumePendingActivation(): string | undefined {
        const sessionId = window.sessionStorage.getItem('agentic.pending-task-activation.v1') || undefined;
        window.sessionStorage.removeItem('agentic.pending-task-activation.v1');
        return sessionId;
      }

  }

  function compareTasks(left: AgenticTaskRecord, right: AgenticTaskRecord): number { return right.projectJoinedAt - left.projectJoinedAt || right.createdAt - left.createdAt; }

Use StorageProvider(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA) and the key agentic.task-registry.v1. Keep the reload-only id in window.sessionStorage under agentic.pending-task-activation.v1. The service must not create a new storage namespace or modify WorkspaceService.

Export the service from acp/index.ts and register it in AINativeModule.providers.

- [ ] **Step 4: Run focused tests**

Run: yarn jest packages/ai-native/**test**/browser/acp/agentic-task-registry.service.test.ts --runInBand

Expected: PASS.

- [ ] **Step 5: Commit**

  git add packages/ai-native/src/browser/acp/agentic-task-registry.service.ts packages/ai-native/src/browser/acp/index.ts packages/ai-native/src/browser/index.ts packages/ai-native/**test**/browser/acp/agentic-task-registry.service.test.ts git commit -m "feat(agentic): persist task metadata by project"

## Task 3: Load and register Agentic Tasks through ACP

**Files:**

- Modify: packages/ai-native/src/browser/chat/acp-session-provider.ts:53-240
- Modify: packages/ai-native/src/browser/chat/chat.internal.service.acp.ts:181-245
- Test: Modify packages/ai-native/**test**/browser/chat/acp-chat-manager.service.test.ts:180-260
- Test: Modify packages/ai-native/**test**/browser/chat/acp-chat-internal.service.test.ts

**Interfaces:**

- Consumes AgenticTaskRegistryService and IACPConfigProvider.resolveConfigForTarget.
- Produces ChatModels restored using their stored Agent id and cwd.

- [ ] **Step 1: Write failing provider tests**

  it('loads a registry-backed session with the stored target config', async () => { registry.get.mockResolvedValue({ sessionId: 'acp:b', agentId: 'agent-b', workspacePath: '/work/b', }); configProvider.resolveConfigForTarget.mockResolvedValue({ agentId: 'agent-b', cwd: '/work/b' }); aiBackService.loadAgentSession.mockResolvedValue(sessionPayload('b'));

      await provider.loadSession('acp:b');

      expect(configProvider.resolveConfigForTarget).toHaveBeenCalledWith({
        agentId: 'agent-b',
        cwd: '/work/b',
      });
      expect(aiBackService.loadAgentSession).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-b', cwd: '/work/b' }),
        'b',
      );

  });

  it('fails closed when a custom provider cannot resolve the Task target', async () => { registry.get.mockResolvedValue({ sessionId: 'acp:b', agentId: 'agent-b', workspacePath: '/work/b' }); delete configProvider.resolveConfigForTarget;

      await expect(provider.loadSession('acp:b')).rejects.toThrow('cannot resolve its stored ACP target');
      expect(aiBackService.loadAgentSession).not.toHaveBeenCalled();

  });

  it('registers the first accepted Agentic request and marks background messages unread', async () => { await service.sendRequest(requestFor('Fix layout', 'claude-agent-acp')); expect(registry.registerSentTask).toHaveBeenCalledWith( expect.objectContaining({ sessionId: 'acp:a', agentId: 'claude-agent-acp', firstPrompt: 'Fix layout' }), );

      backgroundSession.history.onMessageChange.mock.calls[0][0]();
      expect(registry.markUnread).toHaveBeenCalledWith('acp:background', true);

  });

- [ ] **Step 2: Run the test to verify it fails**

Run: yarn jest packages/ai-native/**test**/browser/chat/acp-chat-manager.service.test.ts packages/ai-native/**test**/browser/chat/acp-chat-internal.service.test.ts --runInBand

Expected: FAIL because ACP loading always uses resolveConfig() and no Task registry is called.

- [ ] **Step 3: Implement exact-target resolution and Agentic-only registration**

  private async resolveSessionConfig(sessionId: string): Promise<AgentProcessConfig> { const task = await this.agenticTaskRegistry.get(sessionId); if (!task) { return this.configProvider.resolveConfig(); } if (!this.configProvider.resolveConfigForTarget) { throw new Error('Agent Task cannot resolve its stored ACP target'); } return this.configProvider.resolveConfigForTarget({ agentId: task.agentId, cwd: task.workspacePath, }); }

Call resolveSessionConfig(sessionId) in ACPSessionProvider.loadSession. Do not change ACPSessionProvider.loadSessions behavior.

In AcpChatInternalService.sendRequest, guard registry writes with panelLayoutService.getLayoutMode() === 'agentic'. After the request has been accepted, register session id, request.message.agentId, current Workspace URI, getCachedWorkspaceDir(), current Workspace label, first prompt, and session createdAt. Subscribe only to actual ChatModel message/status events: update unread for non-active Task messages and update status from onThreadStatusChange. Do not derive completion from a message boundary.

- [ ] **Step 4: Run focused tests**

Run: yarn jest packages/ai-native/**test**/browser/chat/acp-chat-manager.service.test.ts packages/ai-native/**test**/browser/chat/acp-chat-internal.service.test.ts --runInBand

Expected: PASS.

- [ ] **Step 5: Commit**

  git add packages/ai-native/src/browser/chat/acp-session-provider.ts packages/ai-native/src/browser/chat/chat.internal.service.acp.ts packages/ai-native/**test**/browser/chat/acp-chat-manager.service.test.ts packages/ai-native/**test**/browser/chat/acp-chat-internal.service.test.ts git commit -m "feat(agentic): bind ACP sessions to project tasks"

## Task 4: Add guarded, in-page Workspace switching

**Files:**

- Create: packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts
- Modify: packages/ai-native/src/browser/acp/index.ts
- Modify: packages/ai-native/src/browser/index.ts
- Test: Create packages/ai-native/**test**/browser/acp/agentic-workspace-switch.service.test.ts

**Interfaces:**

- Consumes AgenticTaskRegistryService, IWorkspaceService, WorkbenchEditorService, AcpChatInternalService.
- Produces activateTask(task), launchTask(project, agentId), and restorePendingTask().

- [ ] **Step 1: Write failing switch tests**

  it('activates a current-workspace Task without opening another Workspace', async () => { await switcher.activateTask(task('/work/a')); expect(aiChatService.activateSession).toHaveBeenCalledWith('acp:a'); expect(workspaceService.open).not.toHaveBeenCalled(); });

  it('cancels a different-project switch when dirty-editor confirmation returns Cancel', async () => { editorService.getAllOpenedDocuments.mockResolvedValue([{ dirty: true }]); messageService.pick.mockResolvedValue('Cancel');

      await switcher.activateTask(task('/work/b'));

      expect(registry.preparePendingActivation).not.toHaveBeenCalled();
      expect(workspaceService.open).not.toHaveBeenCalled();

  });

  it('saves, records pending activation, and reloads the selected Workspace', async () => { editorService.getAllOpenedDocuments.mockResolvedValue([{ dirty: true }]); messageService.pick.mockResolvedValue('Save All and Switch');

      await switcher.activateTask(task('/work/b'));

      expect(editorService.saveAll).toHaveBeenCalledWith(true);
      expect(registry.preparePendingActivation).toHaveBeenCalledWith('acp:b');
      expect(workspaceService.open).toHaveBeenCalledWith(URI.file('/work/b'), { preserveWindow: true });

  });

- [ ] **Step 2: Run the test to verify it fails**

Run: yarn jest packages/ai-native/**test**/browser/acp/agentic-workspace-switch.service.test.ts --runInBand

Expected: FAIL because AgenticWorkspaceSwitchService is missing.

- [ ] **Step 3: Implement switching without IDE Layout changes**

  async activateTask(task: AgenticTaskRecord): Promise<void> { if (task.workspaceUri === this.currentWorkspaceUri()) { await this.aiChatService.activateSession(task.sessionId); await this.registry.markUnread(task.sessionId, false); return; } if (!(await this.confirmDirtyEditors())) { return; } this.registry.preparePendingActivation(task.sessionId); await this.workspaceService.open(URI.file(task.workspacePath), { preserveWindow: true }); }

  async restorePendingTask(): Promise<void> { const sessionId = this.registry.consumePendingActivation(); if (!sessionId) { return; } const task = await this.registry.get(sessionId); if (task) { await this.aiChatService.activateSession(task.sessionId); } }

confirmDirtyEditors must inspect await editorService.getAllOpenedDocuments(). If any document has dirty true, show exactly Save All and Switch, Discard Changes and Switch, and Cancel. Save calls editorService.saveAll(true), then rechecks dirty documents. Discard calls editorService.closeAll(undefined, true) only after explicit selection; the imminent Workspace reload follows immediately. The service must not edit WorkspaceService, AIPanelLayoutService, or any IDE Layout file.

launchTask must create a pending launch record with selected project and Agent id, then follow the same guard/open path. On reload it calls aiChatService.enterDraftSession({ force: true }) only after the target Workspace is active.

- [ ] **Step 4: Run focused tests**

Run: yarn jest packages/ai-native/**test**/browser/acp/agentic-workspace-switch.service.test.ts --runInBand

Expected: PASS.

- [ ] **Step 5: Commit**

  git add packages/ai-native/src/browser/acp/agentic-workspace-switch.service.ts packages/ai-native/src/browser/acp/index.ts packages/ai-native/src/browser/index.ts packages/ai-native/**test**/browser/acp/agentic-workspace-switch.service.test.ts git commit -m "feat(agentic): switch workspace for selected tasks"

## Task 5: Build the Agentic-only anchored Task History popover

**Files:**

- Create: packages/ai-native/src/browser/acp/components/AgentTaskHistoryPopover.tsx
- Create: packages/ai-native/src/browser/acp/components/agent-task-history-popover.module.less
- Test: Create packages/ai-native/**test**/browser/acp/agent-task-history-popover.test.tsx

**Interfaces:**

- Consumes AgenticTaskRegistryService, AgenticWorkspaceSwitchService, AcpPermissionBridgeService.
- Produces data-testid values agentic-task-history-button, agentic-task-history-popover, agentic-task-project-group, and agentic-task-row-<session-id>.

- [ ] **Step 1: Write failing UI tests**

  it('sorts Project groups and Task rows newest first and filters only by immutable title', async () => { registry.listActive.mockResolvedValue([ task({ sessionId: 'acp:old', projectLabel: 'Project A', projectJoinedAt: 1, createdAt: 1, title: 'Old Task' }), task({ sessionId: 'acp:new', projectLabel: 'Project B', projectJoinedAt: 2, createdAt: 2, title: 'Fix layout' }), ]);

      render(<AgentTaskHistoryPopover activeSessionId="acp:current" />);
      await user.click(screen.getByTestId('agentic-task-history-button'));

      expect(screen.getAllByTestId('agentic-task-project-group').map((node) => node.textContent)).toEqual([
        'Project B',
        'Project A',
      ]);
      await user.type(screen.getByPlaceholderText('Search agent tasks'), 'layout');
      expect(screen.getByText('Fix layout')).toBeVisible();
      expect(screen.queryByText('Old Task')).toBeNull();

  });

  it('counts only another Task pending permission in the trigger badge', async () => { registry.listActive.mockResolvedValue([task({ sessionId: 'acp:other', status: 'ready' })]); permissionBridge.hasPendingForSession.mockImplementation((id) => id === 'acp:other');

      render(<AgentTaskHistoryPopover activeSessionId="acp:current" />);

      expect(screen.getByTestId('agentic-task-history-attention-badge')).toHaveTextContent('1');

  });

  it('archives ready tasks and blocks unavailable Project rows', async () => { registry.listActive.mockResolvedValue([ task({ sessionId: 'acp:ready', status: 'ready' }), task({ sessionId: 'acp:gone', unavailable: true }), ]); render(<AgentTaskHistoryPopover />); await user.click(screen.getByTestId('agentic-task-history-button'));

      await user.click(screen.getByLabelText('Archive Fix layout'));
      expect(registry.archive).toHaveBeenCalledWith('acp:ready', 'ready');
      await user.click(screen.getByTestId('agentic-task-row-acp:gone'));
      expect(workspaceSwitch.activateTask).not.toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'acp:gone' }),
      );

  });

- [ ] **Step 2: Run the test to verify it fails**

Run: yarn jest packages/ai-native/**test**/browser/acp/agent-task-history-popover.test.tsx --runInBand

Expected: FAIL because the popover component is missing.

- [ ] **Step 3: Implement the popover**

  export const AgentTaskHistoryPopover: React.FC<{ activeSessionId?: string }> = ({ activeSessionId }) => { const [query, setQuery] = React.useState(''); const [tasks, setTasks] = React.useState<AgenticTaskRecord[]>([]);

      const refresh = React.useCallback(async () => {
        setTasks(await registry.listActive());
      }, [registry]);

      const groups = groupByProject(tasks).filter((group) =>
        group.tasks.some((task) => task.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
      );

      return (
        <Popover content={renderTaskGroups(groups)} onVisibleChange={(visible) => visible && void refresh()}>
          <button aria-label="Agent Tasks" data-testid="agentic-task-history-button" type="button">
            <span className="codicon codicon-history" />
          </button>
        </Popover>
      );

  };

Use a new LESS module. Render Project groups, status or attention icon, immutable titles, creation time, unread mark, archive action for eligible status, collapsed archived area, disabled unavailable groups, and a trigger-only count for pending permission/input in non-active Tasks. The component calls workspaceSwitch.activateTask(task) for enabled rows. Do not import, modify, or wrap AcpChatHistory.

- [ ] **Step 4: Run focused tests**

Run: yarn jest packages/ai-native/**test**/browser/acp/agent-task-history-popover.test.tsx --runInBand

Expected: PASS.

- [ ] **Step 5: Commit**

  git add packages/ai-native/src/browser/acp/components/AgentTaskHistoryPopover.tsx packages/ai-native/src/browser/acp/components/agent-task-history-popover.module.less packages/ai-native/**test**/browser/acp/agent-task-history-popover.test.tsx git commit -m "feat(agentic): add anchored task history popover"

## Task 6: Integrate the popover and Project-first launcher only in Agentic Layout

**Files:**

- Create: packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx
- Create: packages/ai-native/src/browser/acp/components/agentic-task-launch-menu.module.less
- Modify: packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx:49-320
- Modify: packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx:67-213
- Test: Modify packages/ai-native/**test**/browser/acp-chat-view-header.test.tsx

**Interfaces:**

- Consumes AgenticTaskRegistryService and AgenticWorkspaceSwitchService.
- Produces an agentic-task-launch-button and preserves the classic header.

- [ ] **Step 1: Write failing integration tests**

  it('renders the Task popover instead of inline ACP history only in Agentic Layout', async () => { renderHeader({ panelLayout: 'agentic' }); expect(screen.getByTestId('agentic-task-history-button')).toBeVisible(); expect(screen.queryByTestId('acp-chat-history')).toBeNull(); });

  it('preserves the existing classic ACP history popover', async () => { renderHeader({ panelLayout: 'classic' }); expect(screen.getByTestId('acp-chat-history')).toHaveAttribute('data-variant', 'popover'); expect(screen.queryByTestId('agentic-task-history-button')).toBeNull(); });

  it('selects a Project before launching a new Agentic Task', async () => { render(<AgenticTaskLaunchMenu />); await user.click(screen.getByTestId('agentic-task-launch-button')); await user.click(screen.getByText('Project B')); await user.click(screen.getByText('Claude ACP'));

      expect(workspaceSwitch.launchTask).toHaveBeenCalledWith(
        expect.objectContaining({ workspacePath: '/work/b', agentId: 'claude-agent-acp' }),
      );

  });

- [ ] **Step 2: Run the test to verify it fails**

Run: yarn jest packages/ai-native/**test**/browser/acp-chat-view-header.test.tsx --runInBand

Expected: FAIL because the Agentic-only branch is absent.

- [ ] **Step 3: Implement the Agentic-only branch**

  return isAgenticLayout ? ( <div className={cls(styles.header, styles.header_agentic)}> <AgentTaskHistoryPopover activeSessionId={aiChatService.sessionModel?.sessionId} /> {switchWorkspaceDirAction} </div> ) : ( <div className={styles.header}> <AcpChatHistory className={styles.chat_history} currentId={aiChatService.sessionModel?.sessionId} title={currentTitle || localize('aiNative.chat.ai.assistant.name')} historyList={historyList} variant="popover" historyLoading={historyLoading} disabled={sessionSwitching} pendingPermissionBadge={pendingPermissionBadge} onNewChat={handleNewChat} onHistoryItemSelect={handleHistoryItemSelect} onHistoryItemChange={handleHistoryItemChange} onHistoryPopoverVisibleChange={handleHistoryPopoverVisibleChange} /> {switchWorkspaceDirAction} {closeAction} </div> );

Replace AgenticChatHeaderNewSessionMenu in AgenticChatPanelHeader with AgenticTaskLaunchMenu. The launcher reads only known Projects: the current Workspace, persisted Project records, and WorkspaceService.getMostRecentlyUsedWorkspaces(). It must never accept arbitrary filesystem text, clone repositories, or alter the default Agent preference for a one-off Task.

- [ ] **Step 4: Run focused tests**

Run: yarn jest packages/ai-native/**test**/browser/acp-chat-view-header.test.tsx packages/ai-native/**test**/browser/acp/agent-task-history-popover.test.tsx --runInBand

Expected: PASS.

- [ ] **Step 5: Commit**

  git add packages/ai-native/src/browser/acp/components/AgenticTaskLaunchMenu.tsx packages/ai-native/src/browser/acp/components/agentic-task-launch-menu.module.less packages/ai-native/src/browser/acp/components/AcpChatViewHeader.tsx packages/ai-native/src/browser/chat/AgenticChatPanelHeader.tsx packages/ai-native/**test**/browser/acp-chat-view-header.test.tsx git commit -m "feat(agentic): launch and select project tasks"

## Task 7: Harden BDD, Playwright, and package verification

**Files:**

- Modify: test/bdd/acp-chat-agentic-history.scenario.md
- Modify: tools/playwright/src/tests/acp-chat-agentic-history.test.ts
- Modify: tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts
- Test: packages/ai-native/**test**/browser/acp-chat-view-wrapper.test.tsx
- Test: packages/ai-native/**test**/node/acp-agent.service.test.ts

- [ ] **Step 1: Update the BDD scenario**

Replace Agentic inline-history assertions with these deterministic steps:

    1. Open agentic-task-history-button and assert agentic-task-history-popover is visible.
    2. Assert Project groups are ordered by joined time descending and Task rows by createdAt descending.
    3. Search by immutable title and assert non-matching rows are absent.
    4. Select a current-Workspace Task and assert acp_chat_get_session_state reports its session id.
    5. Assert the trigger badge counts a non-active pending ACP permission without exposing permission content.
    6. Archive a ready Task, verify it in the collapsed archived area, and unarchive it.
    7. Reload after preparing a pending activation and assert the same Task id is restored.

- [ ] **Step 2: Update Playwright helpers and assertions**

  async function openTaskHistoryPopover() { await page.getByTestId('agentic-task-history-button').click(); await expect(page.getByTestId('agentic-task-history-popover')).toBeVisible(); }

  async function selectTask(sessionId: string) { await page.getByTestId('agentic-task-row-' + sessionId).click(); await expect.poll(async () => (await getSessionState()).session?.sessionId).toBe(sessionId); }

Keep the existing metadata-only checks. Serialized evidence must not contain BDD prompt, assistant, thought, tool-result, or permission-content sentinels.

- [ ] **Step 3: Run focused checks**

Run: yarn jest packages/ai-native/**test**/browser/acp-chat-view-wrapper.test.tsx packages/ai-native/**test**/browser/acp-chat-view-header.test.tsx packages/ai-native/**test**/node/acp-agent.service.test.ts --runInBand

Expected: PASS.

Run: yarn playwright test tools/playwright/src/tests/acp-chat-agentic-history.test.ts tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts

Expected: PASS with the deterministic history fixture. If the local IDE server or fixture profile is unavailable, save its output and report runtime validation as pending.

- [ ] **Step 4: Audit scope and formatting**

Run:

    git diff --check
    git diff --name-only

Expected: no whitespace errors and no modified file under packages/ide-layout/, packages/main-layout/, or packages/ai-native/src/browser/layout/.

- [ ] **Step 5: Commit**

  git add test/bdd/acp-chat-agentic-history.scenario.md tools/playwright/src/tests/acp-chat-agentic-history.test.ts tools/playwright/src/tests/acp-chat-agentic-rich-history-restore.test.ts git commit -m "test(agentic): cover task history popover workflow"
