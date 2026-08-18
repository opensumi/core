import {
  AgenticProjectRecord,
  AgenticTaskRegistryService,
} from '../../../src/browser/acp/agentic-task-registry.service';

jest.mock('@opensumi/di', () => {
  const actual = jest.requireActual('@opensumi/di');
  const noopDecorator = () => () => {};
  return {
    ...actual,
    Injectable: () => (cls: any) => cls,
    Autowired: noopDecorator,
  };
});

describe('AgenticTaskRegistryService', () => {
  let registry: AgenticTaskRegistryService;
  let storage: {
    get: jest.Mock;
    set: jest.Mock;
  };
  let project: AgenticProjectRecord;

  beforeEach(() => {
    storage = {
      get: jest.fn().mockReturnValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    registry = new AgenticTaskRegistryService();
    Object.defineProperty(registry, 'storageProvider', {
      value: jest.fn().mockResolvedValue(storage),
      writable: true,
    });
    window.sessionStorage.clear();
    project = {
      id: 'file:///workspace/project-a',
      workspaceUri: 'file:///workspace/project-a',
      workspacePath: '/workspace/project-a',
      label: 'Project A',
      joinedAt: 1,
      availability: 'available',
    };
  });

  it('stores a Project reference and immutable title but not prompt, permission, or message content', async () => {
    const projectWithPrivateContent = {
      ...project,
      prompt: 'private prompt body',
      permission: 'permission request content',
      messages: 'message history content',
    };
    await registry.registerFirstPrompt({
      sessionId: 'acp:a',
      agentId: 'agent-a',
      project: projectWithPrivateContent,
      firstPrompt: 'Fix list\nprivate prompt body',
      createdAt: 1,
    });
    await registry.registerFirstPrompt({
      sessionId: 'acp:a',
      agentId: 'agent-b',
      project,
      firstPrompt: 'Replace title\nprivate replacement body',
      createdAt: 2,
    });

    expect(await registry.getTask('acp:a')).toMatchObject({
      projectId: project.id,
      agentId: 'agent-a',
      title: 'Fix list',
      createdAt: 1,
    });
    const [key, serialized] = storage.set.mock.calls[storage.set.mock.calls.length - 1];
    expect(key).toBe('agentic.task-registry.v2');
    expect(serialized).toContain('Fix list');
    expect(serialized).not.toContain('private prompt body');
    expect(serialized).not.toContain('private replacement body');
    expect(serialized).not.toContain('permission request content');
    expect(serialized).not.toContain('message history content');
    expect(JSON.parse(serialized)).toEqual({
      version: 3,
      projects: [{ ...project, lastAgentId: 'agent-a' }],
      tasks: [
        {
          sessionId: 'acp:a',
          projectId: project.id,
          agentId: 'agent-a',
          title: 'Fix list',
          createdAt: 1,
          archived: false,
          unread: false,
        },
      ],
    });
  });

  it('preserves the first project join time and exposes the ordered Project catalog', async () => {
    const projectB: AgenticProjectRecord = {
      ...project,
      id: 'file:///workspace/project-b',
      workspaceUri: 'file:///workspace/project-b',
      workspacePath: '/workspace/project-b',
      label: 'Project B',
      joinedAt: 2,
    };

    await registry.registerProject(project);
    await registry.registerProject({ ...project, label: 'Renamed Project A', joinedAt: 9 });
    await registry.registerFirstPrompt({
      sessionId: 'acp:a-old',
      agentId: 'agent-a',
      project,
      firstPrompt: 'Older task',
      createdAt: 3,
    });
    await registry.registerFirstPrompt({
      sessionId: 'acp:a-new',
      agentId: 'agent-a',
      project,
      firstPrompt: 'Newer task',
      createdAt: 5,
    });
    await registry.registerFirstPrompt({
      sessionId: 'acp:b',
      agentId: 'agent-b',
      project: projectB,
      firstPrompt: 'Project B task',
      createdAt: 4,
    });

    expect(await registry.getProject(project.id)).toMatchObject({ joinedAt: 1, label: 'Project A' });
    expect(await registry.listProjects()).toEqual([
      { ...projectB, lastAgentId: 'agent-b' },
      { ...project, lastAgentId: 'agent-a' },
    ]);
    expect(await registry.listActiveGroups()).toEqual([
      { project: { ...projectB, lastAgentId: 'agent-b' }, tasks: [expect.objectContaining({ sessionId: 'acp:b' })] },
      {
        project: { ...project, lastAgentId: 'agent-a' },
        tasks: [
          expect.objectContaining({ sessionId: 'acp:a-new' }),
          expect.objectContaining({ sessionId: 'acp:a-old' }),
        ],
      },
    ]);
  });

  it('keeps a manually managed Project visible without Tasks and removes it when it has no history', async () => {
    const projectManagementRegistry = registry as unknown as {
      registerManagedProject: (project: AgenticProjectRecord) => Promise<AgenticProjectRecord>;
      removeManagedProject: (projectId: string) => Promise<boolean>;
    };

    await projectManagementRegistry.registerManagedProject(project);

    await expect(registry.listActiveGroups()).resolves.toEqual([
      {
        project: expect.objectContaining({ id: project.id, managed: true }),
        tasks: [],
      },
    ]);
    await expect(projectManagementRegistry.removeManagedProject(project.id)).resolves.toBe(true);
    await expect(registry.listProjects()).resolves.toEqual([]);
  });

  it('retains unavailable Project history without exposing its active, archived, or searched Task groups', async () => {
    const unavailableProject: AgenticProjectRecord = {
      ...project,
      id: 'file:///workspace/missing',
      workspaceUri: 'file:///workspace/missing',
      workspacePath: '/workspace/missing',
      label: 'Missing Project',
      availability: 'unavailable',
    };
    await registry.registerFirstPrompt({
      sessionId: 'acp:missing-active',
      agentId: 'agent-a',
      project: unavailableProject,
      firstPrompt: 'Missing active Task',
      createdAt: 1,
    });
    await registry.registerFirstPrompt({
      sessionId: 'acp:missing-archived',
      agentId: 'agent-a',
      project: unavailableProject,
      firstPrompt: 'Missing archived Task',
      createdAt: 2,
    });
    await registry.updateStatus('acp:missing-archived', 'ready');
    await registry.archive('acp:missing-archived');

    await expect(registry.listProjects()).resolves.toEqual([
      expect.objectContaining({ id: unavailableProject.id, availability: 'unavailable' }),
    ]);
    await expect(registry.listActiveGroups()).resolves.toEqual([]);
    await expect(registry.listActiveGroups('missing active')).resolves.toEqual([]);
    await expect(registry.listArchivedGroups()).resolves.toEqual([]);
    await expect(registry.listArchivedGroups('missing archived')).resolves.toEqual([]);
  });

  it('revalidates an existing Project when the same directory is manually added again', async () => {
    const projectManagementRegistry = registry as unknown as {
      registerManagedProject: (project: AgenticProjectRecord) => Promise<AgenticProjectRecord>;
    };
    await registry.registerProject({ ...project, availability: 'unavailable' });

    await expect(projectManagementRegistry.registerManagedProject(project)).resolves.toMatchObject({
      availability: 'available',
      managed: true,
    });
  });

  it('drops legacy MRU-only Projects but retains task history and Project Agent recall', async () => {
    const mruOnlyProject = {
      ...project,
      id: 'file:///workspace/mru-only',
      workspaceUri: 'file:///workspace/mru-only',
      workspacePath: '/workspace/mru-only',
      label: undefined,
    };
    const taskProject = { ...project, label: undefined };
    storage.get.mockReturnValue({
      version: 3,
      projects: [mruOnlyProject, taskProject],
      tasks: [
        {
          sessionId: 'acp:retained',
          projectId: taskProject.id,
          agentId: 'agent-a',
          title: 'Retained task',
          createdAt: 1,
          archived: false,
          unread: false,
        },
      ],
    });
    const projectManagementRegistry = registry as unknown as {
      rememberProjectAgent: (projectId: string, agentId: string) => Promise<AgenticProjectRecord | undefined>;
    };

    await expect(registry.listProjects()).resolves.toEqual([taskProject]);
    await expect(projectManagementRegistry.rememberProjectAgent(taskProject.id, 'agent-b')).resolves.toMatchObject({
      lastAgentId: 'agent-b',
    });
    await expect(registry.getProject(taskProject.id)).resolves.toMatchObject({ lastAgentId: 'agent-b' });
  });

  it('preserves a legacy v3 custom Project name as explicit Project management', async () => {
    storage.get.mockReturnValue({ version: 3, projects: [{ ...project, label: 'Payments' }], tasks: [] });

    await expect(registry.getProject(project.id)).resolves.toMatchObject({ label: 'Payments', managed: true });

    const registryWithRename = registry as unknown as {
      renameProject: (projectId: string, label: string) => Promise<AgenticProjectRecord | undefined>;
    };

    await expect(registryWithRename.renameProject(project.id, '  Billing  ')).resolves.toMatchObject({
      id: project.id,
      label: 'Billing',
    });
    expect(await registry.getProject(project.id)).toMatchObject({ id: project.id, label: 'Billing', managed: true });

    await expect(registryWithRename.renameProject(project.id, '   ')).resolves.toMatchObject({ id: project.id });
    expect((await registry.getProject(project.id))?.label).toBeUndefined();
    expect(JSON.parse(storage.set.mock.calls.at(-1)?.[1])).toMatchObject({
      version: 3,
      projects: [expect.any(Object)],
    });
  });

  it('searches immutable task titles only and separates ready tasks from running tasks', async () => {
    await registry.registerFirstPrompt({
      sessionId: 'acp:active',
      agentId: 'agent-a',
      project,
      firstPrompt: 'Match this title',
      createdAt: 1,
    });
    await registry.registerFirstPrompt({
      sessionId: 'acp:archived',
      agentId: 'agent-a',
      project,
      firstPrompt: 'Another title',
      createdAt: 2,
    });

    await registry.updateStatus('acp:active', 'running');
    await registry.updateStatus('acp:archived', 'ready');
    await registry.updateAttention('acp:active', 'permission');
    await registry.markUnread('acp:active');

    expect(await registry.archive('acp:active')).toBe(false);
    expect(await registry.archive('acp:archived')).toBe(true);
    expect(await registry.listActiveGroups('project a')).toEqual([]);
    expect(await registry.listActiveGroups('match')).toEqual([
      {
        project: { ...project, lastAgentId: 'agent-a' },
        tasks: [
          expect.objectContaining({
            sessionId: 'acp:active',
            unread: true,
            status: 'running',
            attention: 'permission',
          }),
        ],
      },
    ]);
    expect(await registry.listArchivedGroups()).toEqual([
      {
        project: { ...project, lastAgentId: 'agent-a' },
        tasks: [expect.objectContaining({ sessionId: 'acp:archived' })],
      },
    ]);
    expect(await registry.unarchive('acp:archived')).toBe(true);
    expect(await registry.markProjectAvailability(project.id, 'unavailable')).toMatchObject({
      availability: 'unavailable',
    });
  });

  it('does not persist or emit a change when Project availability is unchanged', async () => {
    const onDidChange = jest.fn();
    const disposable = registry.onDidChange(onDidChange);
    await registry.registerProject(project);
    storage.set.mockClear();
    onDidChange.mockClear();

    await expect(registry.markProjectAvailability(project.id, 'available')).resolves.toEqual(project);

    expect(storage.set).not.toHaveBeenCalled();
    expect(onDidChange).not.toHaveBeenCalled();
    disposable.dispose();
  });

  it.each(['ready', 'stopped', 'error'])('retains loaded %s tasks and permits archiving them', async (status) => {
    storage.get.mockReturnValue({
      version: 2,
      projects: [project],
      tasks: [
        {
          sessionId: 'acp:loaded',
          projectId: project.id,
          agentId: 'agent-a',
          title: 'Loaded task',
          createdAt: 1,
          archived: false,
          unread: false,
          status,
        },
      ],
    });

    await expect(registry.getTask('acp:loaded')).resolves.toMatchObject({ status });
    await expect(registry.archive('acp:loaded')).resolves.toBe(true);
  });

  it.each([undefined, 'running', 'stopping', 'other'])('rejects archiving tasks with %s status', async (status) => {
    const task = {
      sessionId: 'acp:loaded',
      projectId: project.id,
      agentId: 'agent-a',
      title: 'Loaded task',
      createdAt: 1,
      archived: false,
      unread: false,
      ...(status === undefined ? {} : { status }),
    };
    storage.get.mockReturnValue({ version: 2, projects: [project], tasks: [task] });

    await expect(registry.archive('acp:loaded')).resolves.toBe(false);
  });

  it('retains a loaded stopping task as non-archivable last-known state', async () => {
    storage.get.mockReturnValue({
      version: 3,
      projects: [project],
      tasks: [
        {
          sessionId: 'acp:stopping',
          projectId: project.id,
          agentId: 'agent-a',
          title: 'Stopping task',
          createdAt: 1,
          archived: false,
          unread: false,
          status: 'stopping',
        },
      ],
    });

    await expect(registry.getTask('acp:stopping')).resolves.toMatchObject({ status: 'stopping' });
    await expect(registry.archive('acp:stopping')).resolves.toBe(false);
  });

  it('archives an unavailable Task without changing its last-known ACP status', async () => {
    storage.get.mockReturnValue({
      version: 3,
      projects: [project],
      tasks: [
        {
          sessionId: 'acp:unavailable',
          projectId: project.id,
          agentId: 'agent-a',
          title: 'Unavailable task',
          createdAt: 1,
          archived: false,
          unread: false,
          status: 'running',
        },
      ],
    });

    await expect(registry.archiveUnavailable('acp:unavailable')).resolves.toBe(true);
    await expect(registry.getTask('acp:unavailable')).resolves.toMatchObject({
      archived: true,
      status: 'running',
    });
  });

  it('consumes prompt-free pending activation and launch state once', () => {
    const launchWithPrivateContent = {
      projectId: 'project-b',
      agentId: 'agent-b',
      firstPrompt: 'private launch prompt',
      message: 'private launch message',
    };
    registry.preparePendingActivation({ sessionId: 'acp:a' });
    registry.preparePendingLaunch(launchWithPrivateContent);

    expect(window.sessionStorage.getItem('agentic.pending-task-activation.v2')).toBe('{"sessionId":"acp:a"}');
    expect(window.sessionStorage.getItem('agentic.pending-task-launch.v2')).toBe(
      '{"projectId":"project-b","agentId":"agent-b"}',
    );
    expect(registry.consumePendingActivation()).toEqual({ sessionId: 'acp:a' });
    expect(registry.consumePendingActivation()).toBeUndefined();
    expect(registry.consumePendingLaunch()).toEqual({ projectId: 'project-b', agentId: 'agent-b' });
    expect(registry.consumePendingLaunch()).toBeUndefined();
  });

  it('keeps the last active Task session across repeated reads', () => {
    registry.rememberActiveTaskSession('acp:active');

    expect(window.sessionStorage.getItem('agentic.active-task-session.v1')).toBe('{"sessionId":"acp:active"}');
    expect(registry.getRememberedActiveTaskSession()).toEqual({ sessionId: 'acp:active' });
    expect(registry.getRememberedActiveTaskSession()).toEqual({ sessionId: 'acp:active' });

    registry.clearRememberedActiveTaskSession('acp:other');
    expect(registry.getRememberedActiveTaskSession()).toEqual({ sessionId: 'acp:active' });

    registry.clearRememberedActiveTaskSession('acp:active');
    expect(registry.getRememberedActiveTaskSession()).toBeUndefined();
  });
});
