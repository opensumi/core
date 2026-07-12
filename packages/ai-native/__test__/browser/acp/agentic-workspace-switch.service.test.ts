import { URI } from '@opensumi/ide-core-common';

import {
  AgenticProjectRecord,
  AgenticTaskRecord,
} from '../../../src/browser/acp/agentic-task-registry.service';
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
  let messageService: any;
  let registry: any;
  let switcher: AgenticWorkspaceSwitchService;
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
      activateSession: jest.fn().mockResolvedValue(undefined),
      enterAgenticTaskDraft: jest.fn(),
    };
    editorService = {
      closeAll: jest.fn().mockResolvedValue(undefined),
      getAllOpenedDocuments: jest.fn().mockResolvedValue([]),
      saveAll: jest.fn().mockResolvedValue(undefined),
    };
    fileService = {
      getFileStat: jest.fn().mockResolvedValue(undefined),
    };
    messageService = {
      warning: jest.fn().mockResolvedValue('Cancel'),
    };
    registry = {
      consumePendingActivation: jest.fn(),
      consumePendingLaunch: jest.fn(),
      getProject: jest.fn(),
      markProjectAvailability: jest.fn().mockResolvedValue(undefined),
      markUnread: jest.fn().mockResolvedValue(undefined),
      preparePendingActivation: jest.fn(),
      preparePendingLaunch: jest.fn(),
      registerProject: jest.fn().mockResolvedValue(undefined),
    };
    workspaceService = {
      getMostRecentlyUsedWorkspaces: jest.fn().mockResolvedValue([]),
      getWorkspaceName: jest.fn((uri: URI) => uri.codeUri.fsPath.split('/').pop()),
      open: jest.fn().mockResolvedValue(undefined),
      whenReady: Promise.resolve(),
      workspace: { uri: projectA.workspaceUri },
    };
    switcher = new AgenticWorkspaceSwitchService();
    Object.defineProperties(switcher, {
      aiChatService: { value: aiChatService },
      editorService: { value: editorService },
      fileService: { value: fileService },
      messageService: { value: messageService },
      registry: { value: registry },
      workspaceService: { value: workspaceService },
    });
  });

  it('activates a current-project Task and clears unread without opening a Workspace', async () => {
    registry.getProject.mockResolvedValue(projectA);

    await switcher.activateTask(taskFor('/work/a'));

    expect(aiChatService.activateSession).toHaveBeenCalledWith('acp:a');
    expect(registry.markUnread).toHaveBeenCalledWith('acp:a', false);
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('stops a save switch when documents remain dirty and stores no activation', async () => {
    registry.getProject.mockResolvedValue(projectB);
    editorService.getAllOpenedDocuments
      .mockResolvedValueOnce([{ dirty: true }])
      .mockResolvedValueOnce([{ dirty: true }]);
    messageService.warning.mockResolvedValue('Save All and Switch');

    await switcher.activateTask(taskFor('/work/b'));

    expect(editorService.saveAll).toHaveBeenCalledWith(true);
    expect(workspaceService.open).not.toHaveBeenCalled();
    expect(registry.preparePendingActivation).not.toHaveBeenCalled();
  });

  it('stores only project and Agent before launching in another Workspace', async () => {
    registry.getProject.mockResolvedValue(projectB);

    await switcher.launchTask(projectB, 'agent-b');

    expect(registry.preparePendingLaunch).toHaveBeenCalledWith({ projectId: projectB.id, agentId: 'agent-b' });
    expect(workspaceService.open).toHaveBeenCalledWith(URI.file('/work/b'), { preserveWindow: true });
  });

  it('does not launch into another Workspace when dirty-editor switching is cancelled', async () => {
    registry.getProject.mockResolvedValue(projectB);
    editorService.getAllOpenedDocuments.mockResolvedValue([{ dirty: true }]);

    await switcher.launchTask(projectB, 'agent-b');

    expect(messageService.warning).toHaveBeenCalledWith(
      expect.any(String),
      ['Save All and Switch', 'Discard Changes and Switch', 'Cancel'],
    );
    expect(registry.preparePendingLaunch).not.toHaveBeenCalled();
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('creates a target draft immediately in the current Project', async () => {
    registry.getProject.mockResolvedValue(projectA);

    await switcher.launchTask(projectA, 'agent-a');

    expect(aiChatService.enterAgenticTaskDraft).toHaveBeenCalledWith({ agentId: 'agent-a', cwd: '/work/a' });
    expect(registry.preparePendingLaunch).not.toHaveBeenCalled();
    expect(workspaceService.open).not.toHaveBeenCalled();
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

  it('does not switch to an unavailable Project', async () => {
    registry.getProject.mockResolvedValue({ ...projectB, availability: 'unavailable' });

    await switcher.activateTask(taskFor('/work/b'));

    expect(messageService.warning).not.toHaveBeenCalled();
    expect(registry.preparePendingActivation).not.toHaveBeenCalled();
    expect(workspaceService.open).not.toHaveBeenCalled();
  });

  it('restores a pending Task activation before consuming a pending launch', async () => {
    registry.consumePendingActivation.mockReturnValue({ sessionId: 'acp:a' });

    await switcher.restorePendingWork();

    expect(aiChatService.activateSession).toHaveBeenCalledWith('acp:a');
    expect(registry.markUnread).toHaveBeenCalledWith('acp:a', false);
    expect(registry.consumePendingLaunch).not.toHaveBeenCalled();
  });

  it('consumes a pending launch only after no activation is available', async () => {
    registry.consumePendingLaunch.mockReturnValue({ projectId: projectB.id, agentId: 'agent-b' });
    registry.getProject.mockResolvedValue(projectB);

    await switcher.restorePendingWork();

    expect(aiChatService.enterAgenticTaskDraft).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' });
  });

  it('clears a failed cross-workspace Task activation so restore cannot activate it later', async () => {
    let pendingActivation: { sessionId: string } | undefined;
    registry.getProject.mockResolvedValue(projectB);
    registry.preparePendingActivation.mockImplementation((activation: { sessionId: string }) => {
      pendingActivation = activation;
    });
    registry.consumePendingActivation.mockImplementation(() => {
      const activation = pendingActivation;
      pendingActivation = undefined;
      return activation;
    });
    workspaceService.open.mockRejectedValue(new Error('workspace open failed'));

    await expect(switcher.activateTask(taskFor('/work/b'))).rejects.toThrow('workspace open failed');
    await switcher.restorePendingWork();

    expect(aiChatService.activateSession).not.toHaveBeenCalled();
  });

  it('keeps a newer same-Task activation pending when an older workspace open rejects', async () => {
    let pendingActivation: { sessionId: string } | undefined;
    registry.getProject.mockResolvedValue(projectB);
    registry.preparePendingActivation.mockImplementation((activation: { sessionId: string }) => {
      pendingActivation = activation;
    });
    registry.consumePendingActivation.mockImplementation(() => {
      const activation = pendingActivation;
      pendingActivation = undefined;
      return activation;
    });
    workspaceService.open.mockImplementationOnce(async () => {
      await switcher.activateTask(taskFor('/work/b'));
      throw new Error('older workspace open failed');
    });

    await expect(switcher.activateTask(taskFor('/work/b'))).rejects.toThrow('older workspace open failed');
    await switcher.restorePendingWork();

    expect(registry.preparePendingActivation).toHaveBeenCalledTimes(2);
    expect(aiChatService.activateSession).toHaveBeenCalledWith('acp:b');
  });

  it('clears a failed cross-workspace Task launch so restore cannot enter its draft later', async () => {
    let pendingLaunch: { projectId: string; agentId: string } | undefined;
    registry.getProject.mockResolvedValue(projectB);
    registry.preparePendingLaunch.mockImplementation((launch: { projectId: string; agentId: string }) => {
      pendingLaunch = launch;
    });
    registry.consumePendingLaunch.mockImplementation(() => {
      const launch = pendingLaunch;
      pendingLaunch = undefined;
      return launch;
    });
    workspaceService.open.mockRejectedValue(new Error('workspace open failed'));

    await expect(switcher.launchTask(projectB, 'agent-b')).rejects.toThrow('workspace open failed');
    await switcher.restorePendingWork();

    expect(aiChatService.enterAgenticTaskDraft).not.toHaveBeenCalled();
  });

  it('keeps a newer same-Task launch pending when an older workspace open rejects', async () => {
    let pendingLaunch: { projectId: string; agentId: string } | undefined;
    registry.getProject.mockResolvedValue(projectB);
    registry.preparePendingLaunch.mockImplementation((launch: { projectId: string; agentId: string }) => {
      pendingLaunch = launch;
    });
    registry.consumePendingLaunch.mockImplementation(() => {
      const launch = pendingLaunch;
      pendingLaunch = undefined;
      return launch;
    });
    workspaceService.open.mockImplementationOnce(async () => {
      await switcher.launchTask(projectB, 'agent-b');
      throw new Error('older workspace open failed');
    });

    await expect(switcher.launchTask(projectB, 'agent-b')).rejects.toThrow('older workspace open failed');
    await switcher.restorePendingWork();

    expect(registry.preparePendingLaunch).toHaveBeenCalledTimes(2);
    expect(aiChatService.enterAgenticTaskDraft).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' });
  });

  it('seeds the current Workspace and validated MRU Workspaces as canonical Projects', async () => {
    const projectCUri = URI.file('/work/c');
    workspaceService.getMostRecentlyUsedWorkspaces.mockResolvedValue([
      projectCUri.toString(),
      '/not-an-mru-uri',
    ]);
    fileService.getFileStat.mockResolvedValue({ uri: projectCUri.toString() });

    await switcher.seedProjectCatalog();

    expect(registry.registerProject).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceUri: projectA.workspaceUri,
        workspacePath: '/work/a',
        label: 'a',
        availability: 'available',
      }),
    );
    expect(fileService.getFileStat).toHaveBeenCalledWith(projectCUri.toString(), false);
    expect(fileService.getFileStat).not.toHaveBeenCalledWith('/not-an-mru-uri', false);
    expect(registry.registerProject).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceUri: projectCUri.toString(),
        workspacePath: '/work/c',
        label: 'c',
        availability: 'available',
      }),
    );
  });

  it('marks Projects unavailable when their Workspace cannot be accessed', async () => {
    fileService.getFileStat.mockResolvedValue(undefined);

    await switcher.refreshProjectAvailability(projectB);

    expect(fileService.getFileStat).toHaveBeenCalledWith(projectB.workspaceUri, false);
    expect(registry.markProjectAvailability).toHaveBeenCalledWith(projectB.id, 'unavailable');
  });
});
