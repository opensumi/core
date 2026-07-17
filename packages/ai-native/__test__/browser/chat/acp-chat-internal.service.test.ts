import { Emitter, URI } from '@opensumi/ide-core-common';

import { ChatModel } from '../../../src/browser/chat/chat-model';
import { ChatFeatureRegistry } from '../../../src/browser/chat/chat.feature.registry';
import {
  AcpChatInternalService,
  formatAcpLoadSessionFallbackMessage,
} from '../../../src/browser/chat/chat.internal.service.acp';

const disposable = () => ({ dispose: jest.fn() });

describe('AcpChatInternalService', () => {
  it('restores the latest Classic ACP session when agent mode is not enabled', async () => {
    const service = new AcpChatInternalService() as any;
    const model = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:bootstrap' });
    const loadSession = jest.fn().mockResolvedValue(undefined);
    let onStorageInit: (() => Promise<void>) | undefined;

    Object.defineProperties(service, {
      agenticTaskRegistry: { value: { consumePendingLaunch: jest.fn() } },
      aiNativeConfigService: { value: { capabilities: { supportsAgentMode: false } } },
      chatManagerService: {
        value: {
          getAvailableCommands: jest.fn(() => []),
          getSession: jest.fn(() => model),
          getSessions: jest.fn(() => [model]),
          loadSession,
          onStorageInit: jest.fn((listener) => {
            onStorageInit = listener;
            return disposable();
          }),
        },
      },
      logger: { value: { error: jest.fn(), log: jest.fn(), warn: jest.fn() } },
      messageService: { value: { error: jest.fn() } },
      panelLayoutService: { value: { getLayoutMode: jest.fn(() => 'classic') } },
      permissionBridgeService: { value: { setActiveSession: jest.fn() } },
    });

    service.init();
    await onStorageInit?.();

    expect(loadSession).toHaveBeenCalledWith('acp:bootstrap');
    expect(service.sessionModel).toBe(model);
  });

  it('notifies current session model and mode listeners when ACP session state changes', () => {
    const service = new AcpChatInternalService() as any;
    const stateEmitter = new Emitter<any>();
    const model = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:sess-1',
      currentModeId: 'code',
    });
    const sessionModelChanges: any[] = [];
    const modeChanges: string[] = [];

    Object.defineProperty(service, 'chatManagerService', {
      value: {
        onDidApplySessionState: stateEmitter.event,
        onStorageInit: jest.fn(() => ({ dispose: jest.fn() })),
      },
    });
    Object.defineProperty(service, 'aiNativeConfigService', {
      value: { capabilities: { supportsAgentMode: true } },
    });
    service._sessionModel = model;
    service.onSessionModelChange((sessionModel) => sessionModelChanges.push(sessionModel));
    service.onModeChange((modeId) => modeChanges.push(modeId));

    service.init();
    stateEmitter.fire({
      sessionId: 'acp:sess-1',
      model,
      previousModeId: 'plan',
      currentModeId: 'code',
    });

    expect(sessionModelChanges).toEqual([model]);
    expect(modeChanges).toEqual(['code']);
  });

  it('notifies session model listeners for non-mode ACP session state changes', () => {
    const service = new AcpChatInternalService() as any;
    const stateEmitter = new Emitter<any>();
    const model = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:sess-1',
      currentModeId: 'code',
    });
    const sessionModelChanges: any[] = [];
    const modeChanges: string[] = [];

    Object.defineProperty(service, 'chatManagerService', {
      value: {
        onDidApplySessionState: stateEmitter.event,
        onStorageInit: jest.fn(() => ({ dispose: jest.fn() })),
      },
    });
    Object.defineProperty(service, 'aiNativeConfigService', {
      value: { capabilities: { supportsAgentMode: true } },
    });
    service._sessionModel = model;
    service.onSessionModelChange((sessionModel) => sessionModelChanges.push(sessionModel));
    service.onModeChange((modeId) => modeChanges.push(modeId));

    service.init();
    stateEmitter.fire({
      sessionId: 'acp:sess-1',
      model,
      previousModeId: 'code',
      currentModeId: 'code',
    });

    expect(sessionModelChanges).toEqual([model]);
    expect(modeChanges).toEqual([]);
  });

  it('notifies available command listeners for active ACP session state changes', () => {
    const service = new AcpChatInternalService() as any;
    const stateEmitter = new Emitter<any>();
    const model = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:sess-1',
      currentModeId: 'code',
    });
    const availableCommands = [{ name: 'help', description: 'Show help' }];
    const availableCommandsChanges: any[] = [];

    Object.defineProperty(service, 'chatManagerService', {
      value: {
        onDidApplySessionState: stateEmitter.event,
        onStorageInit: jest.fn(() => ({ dispose: jest.fn() })),
      },
    });
    Object.defineProperty(service, 'aiNativeConfigService', {
      value: { capabilities: { supportsAgentMode: true } },
    });
    service._sessionModel = model;
    service.onAvailableCommandsChange((commands) => availableCommandsChanges.push(commands));

    service.init();
    stateEmitter.fire({
      sessionId: 'acp:sess-1',
      model,
      availableCommands,
    });

    expect(service.getAvailableCommands()).toEqual(availableCommands);
    expect(availableCommandsChanges).toEqual([availableCommands]);
  });

  describe('draft session lifecycle', () => {
    function createService() {
      const service = new AcpChatInternalService() as any;
      const model = new ChatModel(new ChatFeatureRegistry(), {
        sessionId: 'acp:sess-1',
        modelId: 'model-a',
        agentModels: [
          {
            modelId: 'model-a',
            name: 'Model A',
          },
        ],
        agentModes: [
          {
            id: 'code',
            name: 'Code',
          },
        ],
        currentModeId: 'code',
        configOptions: [
          {
            id: 'approval',
            name: 'Approval',
            currentValue: 'default',
            options: [
              { value: 'default', label: 'Default' },
              { value: 'always', label: 'Always' },
            ],
          },
        ],
      });
      const stateEmitter = new Emitter<any>();
      const chatManagerService = {
        clearSession: jest.fn(),
        getAvailableCommands: jest.fn(() => [{ name: 'help', description: 'Help' }]),
        getSession: jest.fn(() => model),
        getSessions: jest.fn(() => [model]),
        loadSession: jest.fn(() => Promise.resolve()),
        onDidApplySessionState: stateEmitter.event,
        onStorageInit: jest.fn(() => disposable()),
        sendRequest: jest.fn(() => Promise.resolve()),
        startSession: jest.fn(() => Promise.resolve(model)),
      };
      const registry = {
        clearRememberedActiveTaskSession: jest.fn(),
        consumePendingLaunch: jest.fn(),
        getTask: jest.fn(),
        getProject: jest.fn(),
        markUnread: jest.fn().mockResolvedValue(undefined),
        rememberActiveTaskSession: jest.fn(),
        registerFirstPrompt: jest.fn().mockResolvedValue(undefined),
        registerProject: jest.fn().mockResolvedValue(undefined),
        updateAttention: jest.fn().mockResolvedValue(undefined),
        updateStatus: jest.fn().mockResolvedValue(undefined),
      };
      const permissionRequestEmitter = new Emitter<any>();
      const permissionResultEmitter = new Emitter<any>();
      const permissionBridgeService = {
        clearSessionDialogs: jest.fn(),
        onDidRequestPermission: permissionRequestEmitter.event,
        onDidReceivePermissionResult: permissionResultEmitter.event,
        setActiveSession: jest.fn(),
      };
      const messageService = {
        error: jest.fn(),
        info: jest.fn(),
      };
      const aiBackService = {
        setSessionConfigOption: jest.fn(() => Promise.resolve()),
        setSessionMode: jest.fn(() => Promise.resolve()),
        setSessionModel: jest.fn(() => Promise.resolve()),
      };

      Object.defineProperty(service, 'chatManagerService', {
        value: chatManagerService,
      });
      Object.defineProperty(service, 'permissionBridgeService', {
        value: permissionBridgeService,
      });
      Object.defineProperty(service, 'messageService', {
        value: messageService,
      });
      Object.defineProperty(service, 'aiBackService', {
        value: aiBackService,
      });
      Object.defineProperty(service, 'aiNativeConfigService', {
        value: { capabilities: { supportsAgentMode: true } },
      });
      Object.defineProperty(service, 'agenticTaskRegistry', {
        value: registry,
      });
      Object.defineProperty(service, 'panelLayoutService', {
        value: { getLayoutMode: jest.fn(() => 'agentic') },
      });
      Object.defineProperty(service, 'workspaceService', {
        value: {
          getWorkspaceName: jest.fn(() => 'Workspace A'),
          workspace: { uri: 'file:///work/a' },
        },
      });
      Object.defineProperty(service, 'logger', {
        value: { error: jest.fn(), log: jest.fn(), warn: jest.fn() },
      });

      return {
        chatManagerService,
        aiBackService,
        messageService,
        model,
        permissionBridgeService,
        permissionRequestEmitter,
        permissionResultEmitter,
        registry,
        service,
      };
    }

    it('reuses the active ACP session when ensuring a session model', async () => {
      const { chatManagerService, model, service } = createService();
      service._sessionModel = model;

      await expect(service.ensureSessionModel()).resolves.toBe(model);

      expect(chatManagerService.startSession).not.toHaveBeenCalled();
    });

    it('keeps an isolated copy of the unsent input draft across view remounts', () => {
      const { service } = createService();
      const draft = {
        message: 'preserve me',
        images: ['attachment'],
        agentId: 'agent-a',
        command: 'review',
      };

      service.updateInputDraft(draft);
      draft.images.push('mutated');

      expect(service.getInputDraft()).toEqual({
        message: 'preserve me',
        images: ['attachment'],
        agentId: 'agent-a',
        command: 'review',
      });
    });

    it('creates one bootstrap ACP session and exposes its footer metadata', async () => {
      const { chatManagerService, model, permissionBridgeService, service } = createService();

      await expect(service.ensureBootstrapSessionModel()).resolves.toBe(model);
      await expect(service.ensureBootstrapSessionModel()).resolves.toBe(model);

      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);
      expect(permissionBridgeService.setActiveSession).toHaveBeenCalledWith('sess-1');
      expect(service.sessionModel).toBe(model);
      expect(service.getAvailableCommands()).toEqual([{ name: 'help', description: 'Help' }]);
      expect(service.getDraftSessionState()).toEqual({
        agentModes: model.agentModes,
        currentModeId: 'code',
        agentModels: model.agentModels,
        modelId: 'model-a',
        configOptions: model.configOptions,
      });
    });

    it('reuses the bootstrap ACP session on first send instead of creating another session', async () => {
      const { chatManagerService, model, service } = createService();

      await expect(service.ensureBootstrapSessionModel()).resolves.toBe(model);
      await expect(service.ensureSessionModel()).resolves.toBe(model);

      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);
    });

    it('hides an unused bootstrap session from visible history until it receives user content', async () => {
      const { model, service } = createService();

      await service.ensureBootstrapSessionModel();

      expect(service.getSessions()).toEqual([model]);
      expect(service.getVisibleSessions()).toEqual([]);

      model.history.addUserMessage({
        content: 'hello',
        agentId: 'default-agent',
        agentCommand: '',
        images: [],
        relationId: 'request-1',
      });

      expect(service.getVisibleSessions()).toEqual([model]);
    });

    it('keeps an unused bootstrap session active when starting a new chat', async () => {
      const { chatManagerService, model, permissionBridgeService, service } = createService();

      await service.ensureBootstrapSessionModel();
      permissionBridgeService.setActiveSession.mockClear();

      service.enterDraftSession();

      expect(service.sessionModel).toBe(model);
      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);
      expect(permissionBridgeService.setActiveSession).not.toHaveBeenCalledWith(undefined);
    });

    it('keeps later new chat lazy after the bootstrap session has been used', async () => {
      const { chatManagerService, model, registry, service } = createService();
      const nextModel = new ChatModel(new ChatFeatureRegistry(), {
        sessionId: 'acp:sess-2',
      });
      chatManagerService.startSession.mockReset();
      chatManagerService.startSession.mockResolvedValueOnce(model).mockResolvedValueOnce(nextModel);

      await service.ensureBootstrapSessionModel();
      model.history.addUserMessage({
        content: 'hello',
        agentId: 'default-agent',
        agentCommand: '',
        images: [],
        relationId: 'request-1',
      });

      service.enterDraftSession();

      expect(registry.clearRememberedActiveTaskSession).toHaveBeenCalledWith(model.sessionId);
      expect(service.sessionModel).toBeUndefined();
      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);

      await expect(service.ensureSessionModel()).resolves.toBe(nextModel);
      expect(chatManagerService.startSession).toHaveBeenCalledTimes(2);
    });

    it('does not block first-send lazy session creation when bootstrap creation fails', async () => {
      const { chatManagerService, model, service } = createService();
      chatManagerService.startSession.mockReset();
      chatManagerService.startSession.mockRejectedValueOnce(new Error('session/new failed'));
      chatManagerService.startSession.mockResolvedValueOnce(model);

      await expect(service.ensureBootstrapSessionModel()).resolves.toBeUndefined();
      await expect(service.ensureSessionModel()).resolves.toBe(model);

      expect(chatManagerService.startSession).toHaveBeenCalledTimes(2);
    });

    it('creates the ACP session only when ensuring from draft', async () => {
      const { chatManagerService, model, permissionBridgeService, service } = createService();
      const sessionModelChanges: any[] = [];
      const availableCommandsChanges: any[] = [];
      const sessionChanges: string[] = [];
      const loadingChanges: boolean[] = [];

      service.onSessionModelChange((sessionModel) => sessionModelChanges.push(sessionModel));
      service.onAvailableCommandsChange((commands) => availableCommandsChanges.push(commands));
      service.onChangeSession((sessionId) => sessionChanges.push(sessionId));
      service.onSessionLoadingChange((loading) => loadingChanges.push(loading));

      await expect(service.ensureSessionModel()).resolves.toBe(model);

      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);
      expect(permissionBridgeService.setActiveSession).toHaveBeenCalledWith('sess-1');
      expect(sessionModelChanges).toEqual([model]);
      expect(availableCommandsChanges).toEqual([[{ name: 'help', description: 'Help' }]]);
      expect(sessionChanges).toEqual(['acp:sess-1']);
      expect(loadingChanges).toEqual([true, false]);
    });

    it('keeps the active ACP session and draft state after a failed create while notifying once', async () => {
      const { chatManagerService, messageService, model: currentModel, service } = createService();
      const loadingChanges: boolean[] = [];
      const saturationMessage =
        'ACP concurrent tasks have reached the configured limit. Switch to or stop an active task, then try again.';
      service._sessionModel = currentModel;
      service.draftSessionState = { currentModeId: 'code' };
      chatManagerService.startSession.mockRejectedValueOnce(new Error(saturationMessage));
      service.onSessionLoadingChange((loading) => loadingChanges.push(loading));

      await service.createSessionModel();

      expect(service.sessionModel).toBe(currentModel);
      expect(service.getDraftSessionState()).toEqual({ currentModeId: 'code' });
      expect(loadingChanges).toEqual([true, false]);
      expect(messageService.error).toHaveBeenCalledTimes(1);
      expect(messageService.error).toHaveBeenCalledWith(`Failed to create session. (${saturationMessage})`);
    });

    it('starts a one-off Agentic draft with its target without writing user preferences', async () => {
      const { chatManagerService, model, service } = createService();
      const preferenceService = { set: jest.fn() };
      Object.defineProperty(service, 'preferenceService', { value: preferenceService });

      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await service.ensureSessionModel();

      expect(chatManagerService.startSession).toHaveBeenCalledWith({
        acpTarget: { agentId: 'agent-b', cwd: '/work/b' },
      });
      expect(service.sessionModel).toBe(model);
      expect(preferenceService.set).not.toHaveBeenCalled();
    });

    it('stores the selected ACP Agent instead of the chat-agent message identity for a new Task', async () => {
      const { model, registry, service } = createService();
      service.enterAgenticTaskDraft({ agentId: 'claude-agent-acp', cwd: '/work/a' });
      await service.ensureSessionModel();
      const request = model.addRequest({
        prompt: 'Restore this Task',
        agentId: 'Default_Chat_Agent',
        command: '',
        images: [],
      });

      await service.sendRequest(request);

      expect(registry.registerFirstPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'acp:sess-1',
          agentId: 'claude-agent-acp',
        }),
      );
      expect(registry.rememberActiveTaskSession).toHaveBeenCalledWith(model.sessionId);
    });

    it('remembers the activated Agentic Task as the reload target', async () => {
      const { model, registry, service } = createService();
      registry.getTask.mockResolvedValue({ sessionId: model.sessionId });

      await expect(service.activateAgenticTaskSession(model.sessionId)).resolves.toBe(true);

      expect(registry.rememberActiveTaskSession).toHaveBeenCalledWith(model.sessionId);
    });

    it('uses pending Project and Agent metadata when the active chat service creates the Task session', async () => {
      const { chatManagerService, registry, service } = createService();
      registry.consumePendingLaunch.mockReturnValue({ projectId: 'project-b', agentId: 'agent-b' });
      registry.getProject.mockResolvedValue({ id: 'project-b', workspacePath: '/work/b' });

      await service.ensureSessionModel();

      expect(chatManagerService.startSession).toHaveBeenCalledWith({
        acpTarget: { agentId: 'agent-b', cwd: '/work/b' },
      });
    });

    it('registers the first accepted Agentic prompt and marks background Agent content unread', async () => {
      const { chatManagerService, model, registry, service } = createService();
      const backgroundModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:background' });
      chatManagerService.getSessions.mockReturnValue([model, backgroundModel]);
      registry.getTask.mockImplementation((sessionId: string) =>
        Promise.resolve(sessionId === 'acp:background' ? { sessionId } : undefined),
      );
      service._sessionModel = model;
      const request = model.addRequest({
        prompt: 'Fix list\nprivate text',
        agentId: 'agent-b',
        command: '',
        images: [],
      });

      await service.sendRequest(request);

      expect(registry.registerFirstPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'acp:sess-1',
          agentId: 'agent-b',
          firstPrompt: 'Fix list\nprivate text',
        }),
      );

      backgroundModel.history.addAssistantMessage({ content: 'background reply' });

      expect(registry.markUnread).toHaveBeenCalledWith('acp:background', true);
    });

    it('completes an unfinished response when sendRequest rejects before ACP request handling starts', async () => {
      const { chatManagerService, model, service } = createService();
      service._sessionModel = model;
      const error = new Error('request kickoff rejected');
      chatManagerService.sendRequest.mockRejectedValueOnce(error);
      const request = model.addRequest({
        prompt: 'Fix list',
        agentId: 'agent-b',
        command: '',
        images: [],
      });

      await expect(service.sendRequest(request)).resolves.toBeUndefined();

      expect(request.response.errorDetails).toEqual({ message: error.message });
      expect(request.response.isComplete).toBe(true);
    });

    it('completes an unfinished response before rethrowing a synchronous sendRequest failure', () => {
      const { chatManagerService, model, service } = createService();
      service._sessionModel = model;
      const error = new Error('request kickoff threw');
      chatManagerService.sendRequest.mockImplementationOnce(() => {
        throw error;
      });
      const request = model.addRequest({
        prompt: 'Fix list',
        agentId: 'agent-b',
        command: '',
        images: [],
      });

      expect(() => service.sendRequest(request)).toThrow(error);
      expect(request.response.errorDetails).toEqual({ message: error.message });
      expect(request.response.isComplete).toBe(true);
    });

    it('seeds the registered Task status from the model current ACP thread status', async () => {
      const { model, registry, service } = createService();
      service._sessionModel = model;
      model.setThreadStatus('working');
      const request = model.addRequest({
        prompt: 'Fix list',
        agentId: 'agent-b',
        command: '',
        images: [],
      });

      await service.sendRequest(request);

      expect(registry.updateStatus).toHaveBeenCalledWith('acp:sess-1', 'running');
    });

    it('records the active session before waiting for a long-running first prompt', () => {
      const { chatManagerService, model, registry, service } = createService();
      let resolveSend!: () => void;
      chatManagerService.sendRequest.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
      );
      service._sessionModel = model;
      const request = model.addRequest({
        prompt: 'Long task',
        agentId: 'agent-b',
        command: '',
        images: [],
      });

      const send = service.sendRequest(request);

      expect(registry.rememberActiveTaskSession).toHaveBeenCalledWith(model.sessionId);
      resolveSend();
      return send;
    });

    it('does not infer input attention from a generic background assistant component', async () => {
      const { chatManagerService, model, registry, service } = createService();
      const backgroundModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:background' });
      chatManagerService.getSessions.mockReturnValue([model, backgroundModel]);
      registry.getTask.mockImplementation((sessionId: string) =>
        Promise.resolve(sessionId === 'acp:background' ? { sessionId } : undefined),
      );
      service._sessionModel = model;
      const request = model.addRequest({
        prompt: 'Fix list',
        agentId: 'agent-b',
        command: '',
        images: [],
      });

      await service.sendRequest(request);
      backgroundModel.history.addAssistantMessage({ content: 'rendered component', type: 'component' });

      expect(registry.markUnread).toHaveBeenCalledWith('acp:background', true);
      expect(registry.updateAttention).not.toHaveBeenCalledWith('acp:background', 'input');
    });

    it('maps ACP thread statuses and background permission attention only for registered Agentic Tasks', async () => {
      const { chatManagerService, model, permissionRequestEmitter, registry, service } = createService();
      const backgroundModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:background' });
      chatManagerService.getSessions.mockReturnValue([model, backgroundModel]);
      registry.getTask.mockImplementation((sessionId: string) =>
        Promise.resolve(sessionId === 'acp:background' ? { sessionId } : undefined),
      );
      service._sessionModel = model;
      const request = model.addRequest({
        prompt: 'Fix list',
        agentId: 'agent-b',
        command: '',
        images: [],
      });
      await service.sendRequest(request);

      backgroundModel.setThreadStatus('working');
      permissionRequestEmitter.fire({ sessionId: 'background' });

      expect(registry.updateStatus).toHaveBeenCalledWith('acp:background', 'running');
      expect(registry.updateAttention).toHaveBeenCalledWith('acp:background', 'permission');
      expect(registry.markUnread).toHaveBeenCalledWith('acp:background', true);
    });

    it('clears background permission attention when the ACP permission request resolves', async () => {
      const { chatManagerService, model, permissionRequestEmitter, permissionResultEmitter, registry, service } =
        createService();
      const backgroundModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:background' });
      chatManagerService.getSessions.mockReturnValue([model, backgroundModel]);
      registry.getTask.mockImplementation((sessionId: string) =>
        Promise.resolve(sessionId === 'acp:background' ? { sessionId } : undefined),
      );
      service._sessionModel = model;
      const request = model.addRequest({
        prompt: 'Fix list',
        agentId: 'agent-b',
        command: '',
        images: [],
      });
      await service.sendRequest(request);

      permissionRequestEmitter.fire({ requestId: 'permission-1', sessionId: 'background' });
      permissionResultEmitter.fire({ requestId: 'permission-1', decision: { type: 'allow' } });

      expect(registry.updateAttention).toHaveBeenNthCalledWith(1, 'acp:background', 'permission');
      expect(registry.updateAttention).toHaveBeenLastCalledWith('acp:background', undefined);
    });

    it('reuses the in-flight ACP session creation request', async () => {
      const { chatManagerService, model, service } = createService();
      const sessionModelChanges: any[] = [];
      const loadingChanges: boolean[] = [];
      let resolveStartSession!: (model: ChatModel) => void;

      chatManagerService.startSession.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStartSession = resolve;
          }),
      );
      service.onSessionModelChange((sessionModel) => sessionModelChanges.push(sessionModel));
      service.onSessionLoadingChange((loading) => loadingChanges.push(loading));

      const first = service.ensureSessionModel();
      const second = service.ensureSessionModel();

      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);

      resolveStartSession(model);

      await expect(Promise.all([first, second])).resolves.toEqual([model, model]);
      expect(sessionModelChanges).toEqual([model]);
      expect(loadingChanges).toEqual([true, false]);
    });

    it('deduplicates concurrent ACP createSessionModel calls', async () => {
      const { chatManagerService, model, service } = createService();
      const sessionModelChanges: any[] = [];
      const loadingChanges: boolean[] = [];
      let resolveStartSession!: (model: ChatModel) => void;

      chatManagerService.startSession.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStartSession = resolve;
          }),
      );
      service.onSessionModelChange((sessionModel) => sessionModelChanges.push(sessionModel));
      service.onSessionLoadingChange((loading) => loadingChanges.push(loading));

      const first = service.createSessionModel();
      const second = service.createSessionModel();

      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);

      resolveStartSession(model);
      await Promise.all([first, second]);

      expect(sessionModelChanges).toEqual([model]);
      expect(loadingChanges).toEqual([true, false]);
    });

    it('enters draft and preserves ACP footer state for the next input', () => {
      const { model, permissionBridgeService, service } = createService();
      const sessionModelChanges: any[] = [];
      const availableCommandsChanges: any[] = [];
      const modeChanges: string[] = [];
      const sessionChanges: string[] = [];
      service._sessionModel = model;
      service.setAvailableCommands([{ name: 'help', description: 'Help' }]);

      service.onSessionModelChange((sessionModel) => sessionModelChanges.push(sessionModel));
      service.onAvailableCommandsChange((commands) => availableCommandsChanges.push(commands));
      service.onModeChange((modeId) => modeChanges.push(modeId));
      service.onChangeSession((sessionId) => sessionChanges.push(sessionId));

      service.enterDraftSession();

      expect(service.sessionModel).toBeUndefined();
      expect(service.getDraftSessionState()).toEqual({
        agentModes: model.agentModes,
        currentModeId: 'code',
        agentModels: model.agentModels,
        modelId: 'model-a',
        configOptions: model.configOptions,
      });
      expect(service.getAvailableCommands()).toEqual([{ name: 'help', description: 'Help' }]);
      expect(permissionBridgeService.setActiveSession).toHaveBeenCalledWith(undefined);
      expect(sessionModelChanges).toEqual([undefined]);
      expect(availableCommandsChanges).toEqual([]);
      expect(modeChanges).toEqual(['']);
      expect(sessionChanges).toEqual(['']);
    });

    it('stores draft config option changes and applies them to the first created ACP session', async () => {
      const { aiBackService, model, service } = createService();
      service._sessionModel = model;
      service.enterDraftSession();

      await service.setSessionConfigOption('approval', 'always');

      expect(aiBackService.setSessionConfigOption).not.toHaveBeenCalled();
      expect(service.getDraftSessionState().configOptions[0].currentValue).toBe('always');

      await expect(service.ensureSessionModel()).resolves.toBe(model);

      expect(aiBackService.setSessionConfigOption).toHaveBeenCalledWith('sess-1', 'approval', 'always');
      expect(service.sessionModel.configOptions[0].currentValue).toBe('always');
    });

    it('clears the current ACP session into draft without creating another session', async () => {
      const { chatManagerService, model, permissionBridgeService, service } = createService();
      service._sessionModel = model;

      await service.clearSessionModel();

      expect(chatManagerService.clearSession).toHaveBeenCalledWith('acp:sess-1');
      expect(chatManagerService.startSession).not.toHaveBeenCalled();
      expect(permissionBridgeService.clearSessionDialogs).toHaveBeenCalledWith('sess-1');
      expect(service.sessionModel).toBeUndefined();
    });

    it('registers an Agentic draft first prompt under its target Project instead of the IDE workspace', async () => {
      const { model, registry, service } = createService();
      service.agenticTaskTargets.set(model.sessionId, { agentId: 'agent-b', cwd: '/work/other' });

      await service.registerFirstAgenticPrompt(
        {
          message: {
            agentId: 'agent-b',
            prompt: 'Work in the other Project',
          },
        },
        model.sessionId,
      );

      expect(registry.registerProject).toHaveBeenCalledWith(
        expect.objectContaining({
          workspacePath: '/work/other',
          workspaceUri: URI.file('/work/other').toString(),
        }),
      );
      expect(registry.registerFirstPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-b',
          project: expect.objectContaining({ workspacePath: '/work/other' }),
        }),
      );
    });

    it('falls back to draft when loading an ACP session fails', async () => {
      const { chatManagerService, messageService, service } = createService();
      chatManagerService.loadSession.mockRejectedValueOnce(new Error('Session not found'));

      await service.activateSession('acp:missing');

      expect(chatManagerService.startSession).not.toHaveBeenCalled();
      expect(messageService.info).toHaveBeenCalledWith(
        'This chat history is no longer available. A new chat draft is ready, and a session will be created when you send a message.',
      );
      expect(service.sessionModel).toBeUndefined();
    });

    it('keeps the active ACP session when an Agentic Task session cannot load', async () => {
      const { chatManagerService, model: currentModel, service } = createService();
      service._sessionModel = currentModel;
      chatManagerService.loadSession.mockRejectedValueOnce(new Error('Session not found'));

      await expect(service.activateAgenticTaskSession('acp:missing')).resolves.toBe(false);

      expect(service.sessionModel).toBe(currentModel);
    });

    it('keeps the active ACP session and reports missing history when ACP load returns no session', async () => {
      const { chatManagerService, messageService, model: currentModel, service } = createService();
      service._sessionModel = currentModel;
      chatManagerService.getSession.mockReturnValue(undefined);

      await expect(service.activateAgenticTaskSession('acp:missing')).resolves.toBe(false);

      expect(service.sessionModel).toBe(currentModel);
      expect(messageService.info).toHaveBeenCalledWith(
        'This chat history is no longer available. A new chat draft is ready, and a session will be created when you send a message.',
      );
    });

    it('activates only the latest overlapping Agentic Task selection', async () => {
      const { chatManagerService, service } = createService();
      const firstModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:first' });
      const secondModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:second' });
      let resolveFirst!: () => void;
      let resolveSecond!: () => void;
      const firstLoad = new Promise<void>((resolve) => (resolveFirst = resolve));
      const secondLoad = new Promise<void>((resolve) => (resolveSecond = resolve));
      chatManagerService.loadSession.mockImplementation((id: string) => (id === 'acp:first' ? firstLoad : secondLoad));
      chatManagerService.getSession.mockImplementation((id: string) => {
        if (id === 'acp:first') {
          return firstModel;
        }
        return id === 'acp:second' ? secondModel : undefined;
      });

      const firstActivation = service.activateAgenticTaskSession('acp:first');
      const secondActivation = service.activateAgenticTaskSession('acp:second');
      resolveSecond();
      await secondActivation;
      resolveFirst();

      await expect(firstActivation).resolves.toBe(false);
      expect(service.sessionModel?.sessionId).toBe('acp:second');
    });

    it('does not publish a stale Task selection after its task lookup overlaps a newer selection', async () => {
      const { chatManagerService, permissionBridgeService, registry, service } = createService();
      const firstModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:first' });
      const secondModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:second' });
      let resolveFirstTask!: () => void;
      let signalFirstTaskLookup!: () => void;
      const firstTask = new Promise<void>((resolve) => (resolveFirstTask = resolve));
      const firstTaskLookup = new Promise<void>((resolve) => (signalFirstTaskLookup = resolve));
      const sessionChanges: string[] = [];
      chatManagerService.getSession.mockImplementation((id: string) => {
        if (id === 'acp:first') {
          return firstModel;
        }
        return id === 'acp:second' ? secondModel : undefined;
      });
      registry.getTask.mockImplementation((sessionId: string) => {
        if (sessionId === 'acp:first') {
          signalFirstTaskLookup();
          return firstTask;
        }
        return Promise.resolve(undefined);
      });
      service.onChangeSession((sessionId: string) => sessionChanges.push(sessionId));
      permissionBridgeService.setActiveSession.mockClear();

      const firstActivation = service.activateAgenticTaskSession('acp:first');
      await firstTaskLookup;
      await expect(service.activateAgenticTaskSession('acp:second')).resolves.toBe(true);
      resolveFirstTask();

      await expect(firstActivation).resolves.toBe(false);
      expect(service.sessionModel).toBe(secondModel);
      expect(permissionBridgeService.setActiveSession).toHaveBeenCalledTimes(1);
      expect(permissionBridgeService.setActiveSession).toHaveBeenCalledWith('second');
      expect(sessionChanges).toEqual(['acp:second']);
    });

    it('does not publish a Task selection invalidated by a newer Task action', async () => {
      const { chatManagerService, model: currentModel, service } = createService();
      const selectedModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:selected' });
      let resolveLoad!: () => void;
      const load = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
      let shouldApply = true;
      chatManagerService.loadSession.mockReturnValue(load);
      chatManagerService.getSession.mockReturnValue(selectedModel);
      service._sessionModel = currentModel;

      const activation = service.activateAgenticTaskSession('acp:selected', () => shouldApply);
      shouldApply = false;
      resolveLoad();

      await expect(activation).resolves.toBe(false);
      expect(service.sessionModel).toBe(currentModel);
    });
  });

  describe('formatAcpLoadSessionFallbackMessage()', () => {
    it('returns a friendly fallback message for object-shaped errors', () => {
      expect(
        formatAcpLoadSessionFallbackMessage({
          code: -32603,
          data: {
            sessionId: 'a3e1d854-a698-463b-9492-10b8638f30e3',
          },
        }),
      ).toBe(
        'Unable to open this chat history. A new chat draft is ready, and a session will be created when you send a message.',
      );
    });

    it('returns a friendly not-found message when the session no longer exists', () => {
      expect(formatAcpLoadSessionFallbackMessage(new Error('Session not found'))).toBe(
        'This chat history is no longer available. A new chat draft is ready, and a session will be created when you send a message.',
      );
    });
  });
});
