import { URI } from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

import { AgenticProjectRecord, AgenticTaskRecord } from '../../../src/browser/acp/agentic-task-registry.service';
import { AgenticWorkspaceSwitchService } from '../../../src/browser/acp/agentic-workspace-switch.service';

jest.mock('@opensumi/di', () => {
  const actual = jest.requireActual('@opensumi/di');
  const noopDecorator = () => () => {};
  return {
    ...actual,
    Injectable: () => (cls: any) => cls,
    Autowired: noopDecorator,
  };
});

describe('AgenticWorkspaceSwitchService', () => {
  const projectA: AgenticProjectRecord = {
    id: URI.file('/work/a').toString(),
    workspaceUri: URI.file('/work/a').toString(),
    workspacePath: '/work/a',
    label: 'Project A',
    joinedAt: 1,
    availability: 'available',
  };
  const projectB: AgenticProjectRecord = {
    id: URI.file('/work/b').toString(),
    workspaceUri: URI.file('/work/b').toString(),
    workspacePath: '/work/b',
    label: 'Project B',
    joinedAt: 2,
    availability: 'available',
  };

  let aiChatService: any;
  let editorService: any;
  let fileService: any;
  let dialogService: any;
  let registry: any;
  let preferenceService: any;
  let switcher: AgenticWorkspaceSwitchService;
  let windowService: any;
  let workspaceService: any;

  const taskFor = (workspacePath: string): AgenticTaskRecord => ({
    sessionId: workspacePath === '/work/a' ? 'acp:a' : 'acp:b',
    projectId: URI.file(workspacePath).toString(),
    agentId: workspacePath === '/work/a' ? 'agent-a' : 'agent-b',
    title: 'Task',
    createdAt: 1,
    archived: false,
    unread: true,
  });

  beforeEach(() => {
    aiChatService = {
      activateAgenticTaskSession: jest.fn((_sessionId: string, shouldApply = () => true) =>
        Promise.resolve({ status: shouldApply() ? 'activated' : 'superseded' }),
      ),
      activateSession: jest.fn().mockResolvedValue(undefined),
      enterAgenticTaskDraft: jest.fn(),
      getActiveAgenticTaskAgentId: jest.fn(),
      getObservedAgenticTaskStatus: jest.fn(),
      isAgenticTaskSessionObserved: jest.fn(() => false),
      sessionModel: undefined,
      validateAgenticTaskSession: jest.fn().mockResolvedValue({ status: 'validated', taskStatus: 'ready' }),
    };
    editorService = {
      closeAll: jest.fn().mockResolvedValue(undefined),
      getAllOpenedDocuments: jest.fn().mockResolvedValue([]),
      saveAll: jest.fn().mockResolvedValue(undefined),
    };
    fileService = {
      getFileStat: jest.fn().mockResolvedValue({ uri: projectB.workspaceUri }),
    };
    dialogService = {
      warning: jest.fn().mockResolvedValue('Cancel'),
    };
    registry = {
      archive: jest.fn().mockResolvedValue(true),
      archiveUnavailable: jest.fn().mockResolvedValue(true),
      consumePendingActivation: jest.fn(),
      consumePendingLaunch: jest.fn(),
      getRememberedActiveTaskSession: jest.fn(),
      getProject: jest.fn(),
      getTask: jest.fn(),
      markProjectAvailability: jest.fn().mockResolvedValue(undefined),
      markUnread: jest.fn().mockResolvedValue(undefined),
      rememberProjectAgent: jest.fn().mockResolvedValue(undefined),
      preparePendingActivation: jest.fn(),
      preparePendingLaunch: jest.fn(),
      registerManagedProject: jest.fn().mockResolvedValue(projectB),
      registerProject: jest.fn().mockResolvedValue(undefined),
    };
    preferenceService = {
      get: jest.fn((preferenceId: string, fallback: unknown) => {
        if (preferenceId === AINativeSettingSectionsId.AgentConfigs) {
          return {
            'agent-a': { command: 'agent-a', description: 'Agent A' },
            'agent-b': { command: 'agent-b', description: 'Agent B' },
          };
        }
        if (preferenceId === AINativeSettingSectionsId.DefaultAgentType) {
          return 'agent-a';
        }
        return fallback;
      }),
    };
    workspaceService = {
      getMostRecentlyUsedWorkspaces: jest.fn().mockResolvedValue([]),
      getWorkspaceName: jest.fn((uri: URI) => uri.codeUri.fsPath.split('/').pop()),
      open: jest.fn().mockResolvedValue(undefined),
      whenReady: Promise.resolve(),
      workspace: { uri: projectA.workspaceUri },
    };
    windowService = {
      openWorkspace: jest.fn(),
    };
    switcher = new AgenticWorkspaceSwitchService();
    Object.defineProperties(switcher, {
      aiChatService: { value: aiChatService },
      editorService: { value: editorService },
      fileService: { value: fileService },
      preferenceService: { value: preferenceService },
      dialogService: { value: dialogService },
      registry: { value: registry },
      windowService: { value: windowService },
      workspaceService: { value: workspaceService },
    });
  });

  it('activates a foreign-project Task without prompting or opening a Workspace', async () => {
    registry.getProject.mockResolvedValue(projectB);

    await expect(switcher.activateTask(taskFor('/work/b'))).resolves.toEqual({ status: 'activated' });

    expect(aiChatService.activateAgenticTaskSession).toHaveBeenCalledWith('acp:b', expect.any(Function));
    expect(registry.markUnread).toHaveBeenCalledWith('acp:b', false);
    expect(windowService.openWorkspace).not.toHaveBeenCalled();
    expect(dialogService.warning).not.toHaveBeenCalled();
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('retains unread when ACP task session activation fails', async () => {
    registry.getProject.mockResolvedValue(projectB);
    aiChatService.activateAgenticTaskSession.mockResolvedValue({ status: 'failed' });

    await expect(switcher.activateTask(taskFor('/work/b'))).resolves.toEqual({ status: 'failed' });

    expect(aiChatService.activateAgenticTaskSession).toHaveBeenCalledWith('acp:b', expect.any(Function));
    expect(registry.markUnread).not.toHaveBeenCalled();
    expect(windowService.openWorkspace).not.toHaveBeenCalled();
    expect(dialogService.warning).not.toHaveBeenCalled();
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('keeps the latest Task selection when an older availability check finishes later', async () => {
    let resolveFirstAvailability!: (value: { uri: string }) => void;
    const firstAvailability = new Promise<{ uri: string }>((resolve) => {
      resolveFirstAvailability = resolve;
    });
    registry.getProject.mockImplementation((projectId: string) =>
      Promise.resolve(projectId === projectA.id ? projectA : projectB),
    );
    fileService.getFileStat.mockImplementation((workspaceUri: string) =>
      workspaceUri === projectA.workspaceUri ? firstAvailability : Promise.resolve({ uri: projectB.workspaceUri }),
    );

    const firstActivation = switcher.activateTask(taskFor('/work/a'));
    const secondActivation = switcher.activateTask(taskFor('/work/b'));

    await expect(secondActivation).resolves.toEqual({ status: 'activated' });
    resolveFirstAvailability({ uri: projectA.workspaceUri });
    await expect(firstActivation).resolves.toEqual({ status: 'superseded' });

    expect(aiChatService.activateAgenticTaskSession).toHaveBeenCalledTimes(1);
    expect(aiChatService.activateAgenticTaskSession).toHaveBeenCalledWith('acp:b', expect.any(Function));
    expect(registry.markUnread).toHaveBeenCalledWith('acp:b', false);
    expect(registry.markUnread).not.toHaveBeenCalledWith('acp:a', false);
  });

  it('keeps a Task visible but does not activate it when its originating Agent is unavailable', async () => {
    registry.getProject.mockResolvedValue(projectB);
    preferenceService.get.mockImplementation((preferenceId: string, fallback: unknown) => {
      if (preferenceId === AINativeSettingSectionsId.AgentConfigs) {
        return { 'agent-a': { command: 'agent-a', description: 'Agent A' } };
      }
      return fallback;
    });

    await expect(switcher.activateTask(taskFor('/work/b'))).resolves.toEqual({ status: 'agent-unavailable' });

    expect(aiChatService.activateAgenticTaskSession).not.toHaveBeenCalled();
    expect(registry.markUnread).not.toHaveBeenCalled();
  });

  it('validates an unobserved Task for archive without activating it', async () => {
    registry.getProject.mockResolvedValue(projectB);
    aiChatService.validateAgenticTaskSession.mockResolvedValue({ status: 'validated', taskStatus: 'running' });

    await expect(switcher.validateTaskSession(taskFor('/work/b'))).resolves.toEqual({
      status: 'validated',
      taskStatus: 'running',
    });

    expect(aiChatService.validateAgenticTaskSession).toHaveBeenCalledWith('acp:b', expect.any(Function));
    expect(aiChatService.activateAgenticTaskSession).not.toHaveBeenCalled();
    expect(registry.markUnread).not.toHaveBeenCalled();
  });

  it('validates Last-known status before archive and refuses a live running Task', async () => {
    registry.getProject.mockResolvedValue(projectB);
    aiChatService.validateAgenticTaskSession.mockResolvedValue({ status: 'validated', taskStatus: 'running' });

    await expect(switcher.archiveTask(taskFor('/work/b'), { conversationUnavailable: false })).resolves.toEqual({
      status: 'not-archivable',
    });

    expect(aiChatService.validateAgenticTaskSession).toHaveBeenCalledWith('acp:b', expect.any(Function));
    expect(registry.archive).not.toHaveBeenCalled();
    expect(registry.archiveUnavailable).not.toHaveBeenCalled();
  });

  it('archives an unavailable Task Conversation without rewriting its ACP status', async () => {
    registry.getProject.mockResolvedValue(projectB);
    aiChatService.validateAgenticTaskSession.mockResolvedValue({ status: 'conversation-unavailable' });

    await expect(switcher.archiveTask(taskFor('/work/b'), { conversationUnavailable: false })).resolves.toEqual({
      status: 'archived',
      availability: 'conversation-unavailable',
    });

    expect(registry.archiveUnavailable).toHaveBeenCalledWith('acp:b');
    expect(registry.archive).not.toHaveBeenCalled();
  });

  it('archives a retained Task directly when its originating Agent is absent from the Catalog', async () => {
    preferenceService.get.mockImplementation((preferenceId: string, fallback: unknown) => {
      if (preferenceId === AINativeSettingSectionsId.AgentConfigs) {
        return { 'agent-a': { command: 'agent-a', description: 'Agent A' } };
      }
      return fallback;
    });

    await expect(switcher.archiveTask(taskFor('/work/b'), { conversationUnavailable: false })).resolves.toEqual({
      status: 'archived',
      availability: 'agent-unavailable',
    });

    expect(registry.archiveUnavailable).toHaveBeenCalledWith('acp:b');
    expect(aiChatService.validateAgenticTaskSession).not.toHaveBeenCalled();
  });

  it('launches a foreign Project draft without workspace navigation', async () => {
    registry.getProject.mockResolvedValue(projectB);

    await expect(switcher.launchTask(projectB, 'agent-b')).resolves.toBe(true);

    expect(aiChatService.enterAgenticTaskDraft).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' });
    expect(registry.preparePendingLaunch).toHaveBeenCalledWith({ projectId: projectB.id, agentId: 'agent-b' });
    expect(windowService.openWorkspace).not.toHaveBeenCalled();
    expect(dialogService.warning).not.toHaveBeenCalled();
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('resolves Header Task Launch from the selected Task Project and Project Agent Recall', async () => {
    aiChatService.sessionModel = {
      sessionId: 'acp:b',
      requests: [{ message: { agentId: 'agent-a' } }],
    };
    registry.getTask.mockResolvedValue(taskFor('/work/b'));
    registry.getProject.mockImplementation((projectId: string) => {
      if (projectId === projectB.id) {
        return Promise.resolve({ ...projectB, lastAgentId: 'agent-b' });
      }
      return Promise.resolve(undefined);
    });

    await expect(switcher.resolveHeaderTaskLaunchContext()).resolves.toMatchObject({
      project: { id: projectB.id },
      preferredAgentId: 'agent-b',
      executionContext: { id: projectB.id },
    });
  });

  it('single-flights Task Launch and publishes its pending state', async () => {
    let resolveProject!: (project: AgenticProjectRecord) => void;
    registry.getProject.mockReturnValueOnce(
      new Promise<AgenticProjectRecord>((resolve) => {
        resolveProject = resolve;
      }),
    );
    const pendingStates: boolean[] = [];
    switcher.onDidChangeTaskLaunchPending((pending) => pendingStates.push(pending));

    const firstLaunch = switcher.launchTask(projectB, 'agent-b');

    expect(switcher.isTaskLaunchPending).toBe(true);
    await expect(switcher.launchTask(projectB, 'agent-b')).resolves.toBe(false);
    expect(registry.getProject).toHaveBeenCalledTimes(1);

    resolveProject(projectB);
    await expect(firstLaunch).resolves.toBe(true);
    expect(switcher.isTaskLaunchPending).toBe(false);
    expect(pendingStates).toEqual([true, false]);
  });

  it('rejects Header Task Launch when the selected Workspace Target is unavailable', async () => {
    aiChatService.sessionModel = { sessionId: 'acp:b', requests: [] };
    registry.getTask.mockResolvedValue(taskFor('/work/b'));
    registry.getProject.mockImplementation((projectId: string) =>
      Promise.resolve(projectId === projectB.id ? { ...projectB, availability: 'unavailable' } : projectA),
    );

    await expect(switcher.launchHeaderTask()).resolves.toEqual({ status: 'project-unavailable' });
    expect(aiChatService.enterAgenticTaskDraft).not.toHaveBeenCalled();
  });

  it('reports no Agent when the configured Agent catalog is empty', async () => {
    preferenceService.get.mockImplementation((preferenceId: string, fallback: unknown) =>
      preferenceId === AINativeSettingSectionsId.AgentConfigs ? {} : fallback,
    );
    registry.getProject.mockResolvedValue(projectA);

    await expect(switcher.launchHeaderTask()).resolves.toEqual({ status: 'no-agent' });
    expect(aiChatService.enterAgenticTaskDraft).not.toHaveBeenCalled();
  });

  it('preserves the active conversation when Header Task Launch fails', async () => {
    registry.getProject.mockResolvedValue(projectA);
    registry.rememberProjectAgent.mockRejectedValue(new Error('storage failed'));

    await expect(switcher.launchHeaderTask('agent-a')).resolves.toEqual({ status: 'failed' });
    expect(aiChatService.enterAgenticTaskDraft).not.toHaveBeenCalled();
  });

  it('creates a target draft immediately in the current Project', async () => {
    registry.getProject.mockResolvedValue(projectA);

    await switcher.launchTask(projectA, 'agent-a');

    expect(aiChatService.enterAgenticTaskDraft).toHaveBeenCalledWith({ agentId: 'agent-a', cwd: '/work/a' });
    expect(registry.preparePendingLaunch).toHaveBeenCalledWith({ projectId: projectA.id, agentId: 'agent-a' });
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('creates a current-workspace Header draft without admitting that Workspace to the Project catalog', async () => {
    registry.getProject.mockResolvedValue(undefined);

    await switcher.launchTask(projectA, 'agent-a');

    expect(aiChatService.enterAgenticTaskDraft).toHaveBeenCalledWith({ agentId: 'agent-a', cwd: '/work/a' });
    expect(registry.preparePendingLaunch).not.toHaveBeenCalled();
    expect(registry.rememberProjectAgent).not.toHaveBeenCalled();
    expect(windowService.openWorkspace).not.toHaveBeenCalled();
  });

  it('remembers the Agent after launching a registered Project', async () => {
    registry.getProject.mockResolvedValue(projectA);

    await switcher.launchTask(projectA, 'agent-a');

    expect(registry.rememberProjectAgent).toHaveBeenCalledWith(projectA.id, 'agent-a');
  });

  it('does not switch to a forged Project that is absent from the registry', async () => {
    const forgedProject = {
      ...projectB,
      workspacePath: '/arbitrary/caller/path',
      workspaceUri: URI.file('/arbitrary/caller/path').toString(),
    };
    registry.getProject.mockResolvedValue(undefined);

    await switcher.launchTask(forgedProject, 'agent-b');

    expect(registry.getProject).toHaveBeenCalledWith(projectB.id);
    expect(aiChatService.enterAgenticTaskDraft).not.toHaveBeenCalled();
    expect(registry.preparePendingLaunch).not.toHaveBeenCalled();
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('does not activate an unavailable Project', async () => {
    registry.getProject.mockResolvedValue({ ...projectB, availability: 'unavailable' });

    await expect(switcher.activateTask(taskFor('/work/b'))).resolves.toEqual({ status: 'project-unavailable' });

    expect(aiChatService.activateAgenticTaskSession).not.toHaveBeenCalled();
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('marks a stale Project unavailable before it can launch a draft', async () => {
    registry.getProject.mockResolvedValue(projectB);
    fileService.getFileStat.mockResolvedValue(undefined);

    await expect(switcher.launchTask(projectB, 'agent-b')).resolves.toBe(false);

    expect(registry.markProjectAvailability).toHaveBeenCalledWith(projectB.id, 'unavailable');
    expect(registry.preparePendingLaunch).not.toHaveBeenCalled();
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('restores a legacy pending Task activation before consuming a pending launch', async () => {
    registry.consumePendingActivation.mockReturnValue({ sessionId: 'acp:a' });
    registry.getTask.mockResolvedValue(taskFor('/work/a'));
    registry.getProject.mockResolvedValue(projectA);

    await switcher.restorePendingWork();

    expect(aiChatService.activateAgenticTaskSession).toHaveBeenCalledWith('acp:a', expect.any(Function));
    expect(registry.markUnread).toHaveBeenCalledWith('acp:a', false);
    expect(registry.consumePendingLaunch).not.toHaveBeenCalled();
  });

  it('consumes a pending launch only after no activation is available', async () => {
    registry.getRememberedActiveTaskSession.mockReturnValue({ sessionId: 'acp:a' });
    registry.consumePendingLaunch.mockReturnValue({ projectId: projectB.id, agentId: 'agent-b' });
    registry.getProject.mockResolvedValue(projectB);

    await switcher.restorePendingWork();

    expect(aiChatService.enterAgenticTaskDraft).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' });
    expect(aiChatService.activateAgenticTaskSession).not.toHaveBeenCalled();
  });

  it('restores the remembered active Task only when no pending activation or launch exists', async () => {
    registry.getRememberedActiveTaskSession.mockReturnValue({ sessionId: 'acp:a' });
    registry.getTask.mockResolvedValue(taskFor('/work/a'));
    registry.getProject.mockResolvedValue(projectA);

    await switcher.restorePendingWork();

    expect(aiChatService.activateAgenticTaskSession).toHaveBeenCalledWith('acp:a', expect.any(Function));
    expect(registry.markUnread).toHaveBeenCalledWith('acp:a', false);
  });

  it('does not restore a remembered session without its Agent Task binding', async () => {
    registry.getRememberedActiveTaskSession.mockReturnValue({ sessionId: 'acp:orphaned' });
    registry.getTask.mockResolvedValue(undefined);

    await switcher.restorePendingWork();

    expect(aiChatService.activateAgenticTaskSession).not.toHaveBeenCalled();
    expect(registry.markUnread).not.toHaveBeenCalled();
  });

  it('does not admit the current Workspace or MRU entries while refreshing the Project catalog', async () => {
    const projectCUri = URI.file('/work/c');
    workspaceService.getMostRecentlyUsedWorkspaces.mockResolvedValue([projectCUri.toString(), '/not-an-mru-uri']);
    fileService.getFileStat.mockResolvedValue({ uri: projectCUri.toString() });

    await switcher.seedProjectCatalog();

    expect(registry.registerProject).not.toHaveBeenCalled();
    expect(registry.registerManagedProject).not.toHaveBeenCalled();
    expect(workspaceService.getMostRecentlyUsedWorkspaces).not.toHaveBeenCalled();
    expect(fileService.getFileStat).not.toHaveBeenCalled();
  });

  it('registers a selected directory as a managed Project without changing the current Workspace', async () => {
    fileService.getFileStat.mockResolvedValue({ uri: projectB.workspaceUri, isDirectory: true });
    const switcherWithProjectAddition = switcher as unknown as {
      addProject: (uri: URI) => Promise<AgenticProjectRecord | undefined>;
    };

    await expect(switcherWithProjectAddition.addProject(URI.file('/work/b'))).resolves.toEqual(projectB);

    expect(registry.registerManagedProject).toHaveBeenCalledWith({
      workspaceUri: projectB.workspaceUri,
      workspacePath: '/work/b',
      joinedAt: expect.any(Number),
      availability: 'available',
    });
    expect(windowService.openWorkspace).not.toHaveBeenCalled();
  });

  it('marks Projects unavailable when their Workspace cannot be accessed', async () => {
    fileService.getFileStat.mockResolvedValue(undefined);

    await switcher.refreshProjectAvailability(projectB);

    expect(fileService.getFileStat).toHaveBeenCalledWith(projectB.workspaceUri, false);
    expect(registry.markProjectAvailability).toHaveBeenCalledWith(projectB.id, 'unavailable');
  });
});
