import { ACP_SESSION_NOT_FOUND_ERROR_NAME, Emitter, URI } from '@opensumi/ide-core-common';

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

  it('rebinds the active session when an attachment snapshot replaces its model', () => {
    const service = new AcpChatInternalService() as any;
    const stateEmitter = new Emitter<any>();
    const originalModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:sess-1' });
    const restoredModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:sess-1' });
    const sessionModelChanges: any[] = [];

    Object.defineProperties(service, {
      aiNativeConfigService: { value: { capabilities: { supportsAgentMode: true } } },
      chatManagerService: {
        value: {
          onDidApplySessionState: stateEmitter.event,
          onStorageInit: jest.fn(() => disposable()),
        },
      },
    });
    service._sessionModel = originalModel;
    service.onSessionModelChange((sessionModel) => sessionModelChanges.push(sessionModel));

    service.init();
    stateEmitter.fire({
      sessionId: originalModel.sessionId,
      model: restoredModel,
      modelReplaced: true,
    });

    expect(service.sessionModel).toBe(restoredModel);
    expect(sessionModelChanges).toEqual([restoredModel]);
  });

  it('does not treat lightweight Agentic session-list models as live observations on storage init', async () => {
    const service = new AcpChatInternalService() as any;
    const model = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:retained' });
    let onStorageInit: (() => Promise<void>) | undefined;
    const registry = {
      getTask: jest.fn().mockResolvedValue({ sessionId: model.sessionId }),
      updateStatus: jest.fn(),
    };

    Object.defineProperties(service, {
      agenticTaskRegistry: { value: registry },
      aiNativeConfigService: { value: { capabilities: { supportsAgentMode: true } } },
      chatManagerService: {
        value: {
          getSessions: jest.fn(() => [model]),
          onStorageInit: jest.fn((listener) => {
            onStorageInit = listener;
            return disposable();
          }),
          refreshAgentSessionCatalog: jest.fn().mockResolvedValue([]),
        },
      },
      panelLayoutService: { value: { getLayoutMode: jest.fn(() => 'agentic') } },
    });

    service.init();
    await onStorageInit?.();

    expect(service.isAgenticTaskSessionObserved(model.sessionId)).toBe(false);
    expect(registry.updateStatus).not.toHaveBeenCalled();
  });

  it('returns the refreshed Agent Session snapshot without stale local models in Agentic Layout', async () => {
    const service = new AcpChatInternalService() as any;
    const listed = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:listed' });
    const stale = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:stale' });
    const chatManagerService = {
      getAgentSessionCatalog: jest.fn(() => [
        {
          sessionId: listed.sessionId,
          agentSessionId: 'listed',
          agentId: 'agent-a',
          cwd: '/work/a',
        },
      ]),
      getSession: jest.fn((sessionId: string) => (sessionId === listed.sessionId ? listed : stale)),
      getSessions: jest.fn(() => [listed, stale]),
      refreshAgentSessionCatalog: jest.fn().mockResolvedValue(undefined),
    };
    Object.defineProperties(service, {
      chatManagerService: { value: chatManagerService },
      panelLayoutService: { value: { getLayoutMode: jest.fn(() => 'agentic') } },
    });

    await expect(service.getSessionsByAcp()).resolves.toEqual([listed]);
    expect(chatManagerService.refreshAgentSessionCatalog).toHaveBeenCalledTimes(1);
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
    function createService(acpTarget = { agentId: 'agent-b', cwd: '/work/a' }) {
      const service = new AcpChatInternalService() as any;
      const model = new ChatModel(new ChatFeatureRegistry(), {
        sessionId: 'acp:sess-1',
        acpTarget,
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
        cancelRequest: jest.fn(),
        clearSession: jest.fn(),
        disposeSession: jest.fn(() => Promise.resolve()),
        getAvailableCommands: jest.fn(() => [{ name: 'help', description: 'Help' }]),
        getSession: jest.fn(() => model),
        getSessions: jest.fn(() => [model]),
        loadSession: jest.fn(() => Promise.resolve()),
        onDidApplySessionState: stateEmitter.event,
        onStorageInit: jest.fn(() => disposable()),
        refreshAgentSessionCatalog: jest.fn().mockResolvedValue([]),
        sendRequest: jest.fn((_sessionId, _request, _regenerate, onRequestAccepted?: () => void) => {
          onRequestAccepted?.();
          return Promise.resolve();
        }),
        startSession: jest.fn(() => Promise.resolve(model)),
      };
      const registry = {
        clearPendingLaunch: jest.fn(),
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
        hasPendingForSession: jest.fn(() => false),
        onDidRequestPermission: permissionRequestEmitter.event,
        onDidReceivePermissionResult: permissionResultEmitter.event,
        setActiveSession: jest.fn(),
      };
      const messageService = {
        error: jest.fn(),
        info: jest.fn(),
      };
      const aiBackService = {
        cancelSessionCreation: jest.fn(() => Promise.resolve()),
        closeSession: jest.fn(() => Promise.resolve()),
        deleteSession: jest.fn(() => Promise.resolve()),
        getSessionCapabilities: jest.fn(() => Promise.resolve({ close: false, delete: false })),
        setAcpStandbyTarget: jest.fn(() => Promise.resolve()),
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
      Object.defineProperty(service, 'configProvider', {
        value: {
          resolveConfigForTarget: jest.fn(async (target) => ({
            ...target,
            command: 'agent-cli',
            args: [],
          })),
        },
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

    it('declares only the latest Task Draft standby target after 500 milliseconds', async () => {
      jest.useFakeTimers();
      const { aiBackService, service } = createService();

      service.enterAgenticTaskDraft({ agentId: 'agent-a', cwd: '/work/a' });
      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await jest.advanceTimersByTimeAsync(499);
      expect(aiBackService.setAcpStandbyTarget).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(aiBackService.setAcpStandbyTarget).toHaveBeenCalledTimes(1);
      expect(aiBackService.setAcpStandbyTarget).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-b', cwd: '/work/b' }),
      );
      jest.useRealTimers();
    });

    it('does not declare standby capacity after a Task Draft is discarded', async () => {
      jest.useFakeTimers();
      const { aiBackService, registry, service } = createService();

      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await service.discardAgenticTaskDraft();
      await jest.advanceTimersByTimeAsync(500);

      expect(aiBackService.setAcpStandbyTarget).not.toHaveBeenCalled();
      expect(registry.clearPendingLaunch).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('flushes the latest Task Draft standby target before foreground session creation', async () => {
      jest.useFakeTimers();
      const { aiBackService, chatManagerService, service } = createService();

      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await service.ensureSessionModel();

      expect(aiBackService.setAcpStandbyTarget).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-b', cwd: '/work/b' }),
      );
      expect(aiBackService.setAcpStandbyTarget.mock.invocationCallOrder[0]).toBeLessThan(
        chatManagerService.startSession.mock.invocationCallOrder[0],
      );
      await jest.runOnlyPendingTimersAsync();
      expect(aiBackService.setAcpStandbyTarget).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('does not create an unscoped bootstrap Session outside an explicit Agentic draft', async () => {
      const { chatManagerService, service } = createService();

      await expect(service.ensureBootstrapSessionModel()).resolves.toBeUndefined();

      expect(chatManagerService.startSession).not.toHaveBeenCalled();
    });

    it('creates one capability-gated draft-bound Session and exposes its Agent catalog', async () => {
      const { aiBackService, chatManagerService, model, permissionBridgeService, service } = createService();
      aiBackService.getSessionCapabilities.mockResolvedValue({ close: true, delete: true });

      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await expect(service.ensureSessionModel()).resolves.toBe(model);

      expect(aiBackService.getSessionCapabilities).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-b', cwd: '/work/b' }),
      );
      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);
      expect(permissionBridgeService.setActiveSession).toHaveBeenCalledWith('sess-1');
      expect(service.getAvailableCommands()).toEqual([{ name: 'help', description: 'Help' }]);
      expect(service.getSkillCatalogState()).toBe('ready');
      expect(service.getVisibleSessions()).toEqual([model]);
    });

    it('keeps first-Prompt creation lazy when standard Session closing is unavailable', async () => {
      const { aiBackService, chatManagerService, model, service } = createService();
      aiBackService.getSessionCapabilities.mockResolvedValue({ close: false, delete: false });

      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await Promise.resolve();
      await Promise.resolve();

      expect(chatManagerService.startSession).not.toHaveBeenCalled();
      expect(service.getSkillCatalogState()).toBe('unavailable');
      await expect(service.ensureSessionModel()).resolves.toBe(model);
      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);
    });

    it('keeps first-Prompt creation lazy when an unprompted Session cannot be deleted', async () => {
      const { aiBackService, chatManagerService, model, service } = createService();
      aiBackService.getSessionCapabilities.mockResolvedValue({ close: true, delete: false });

      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(chatManagerService.startSession).not.toHaveBeenCalled();
      expect(service.getSkillCatalogState()).toBe('unavailable');
      await expect(service.ensureSessionModel()).resolves.toBe(model);
      expect(chatManagerService.startSession).toHaveBeenCalledTimes(1);
    });

    it('closes and deletes only its unprompted draft-bound Session on discard', async () => {
      const { aiBackService, chatManagerService, model, service } = createService();
      aiBackService.getSessionCapabilities.mockResolvedValue({ close: true, delete: true });

      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await service.ensureSessionModel();
      await service.discardAgenticTaskDraft();

      expect(aiBackService.closeSession).toHaveBeenCalledWith('sess-1');
      expect(aiBackService.deleteSession).toHaveBeenCalledWith('sess-1');
      expect(chatManagerService.disposeSession).toHaveBeenCalledWith(model.sessionId);
      expect(service.sessionModel).toBeUndefined();
    });

    it('retains a draft-bound Session after its first Prompt is rejected so the draft can retry', async () => {
      const { aiBackService, chatManagerService, model, service } = createService();
      aiBackService.getSessionCapabilities.mockResolvedValue({ close: true, delete: true });
      chatManagerService.sendRequest.mockResolvedValue(undefined);

      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await service.ensureSessionModel();
      const request = model.addRequest({
        prompt: 'Try again',
        agentId: 'agent-b',
        command: '',
        images: [],
      });

      await service.sendRequest(request);

      expect(aiBackService.closeSession).not.toHaveBeenCalled();
      expect(aiBackService.deleteSession).not.toHaveBeenCalled();
      expect(chatManagerService.disposeSession).not.toHaveBeenCalled();
      expect(service.sessionModel).toBe(model);
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

      expect(chatManagerService.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          acpTarget: { agentId: 'agent-b', cwd: '/work/b' },
          operationId: expect.stringMatching(/^acp-launch-/),
        }),
      );
      expect(service.sessionModel).toBe(model);
      expect(preferenceService.set).not.toHaveBeenCalled();
    });

    it('uses the selected ACP target when registering the Project without creating a local Task', async () => {
      const { chatManagerService, model, registry, service } = createService({
        agentId: 'claude-agent-acp',
        cwd: '/work/a',
      });
      service.enterAgenticTaskDraft({ agentId: 'claude-agent-acp', cwd: '/work/a' });
      await service.ensureSessionModel();
      const request = model.addRequest({
        prompt: 'Restore this Task',
        agentId: 'Default_Chat_Agent',
        command: '',
        images: [],
      });

      await service.sendRequest(request);

      expect(registry.registerProject).toHaveBeenCalledWith(expect.objectContaining({ workspacePath: '/work/a' }));
      expect(registry.registerFirstPrompt).not.toHaveBeenCalled();
      expect(registry.rememberActiveTaskSession).not.toHaveBeenCalled();
      expect(chatManagerService.refreshAgentSessionCatalog).toHaveBeenCalledTimes(1);
    });

    it('does not persist an activated Agent session as a legacy Task reload target', async () => {
      const { model, registry, service } = createService();
      registry.getTask.mockResolvedValue({ sessionId: model.sessionId });

      await expect(service.activateAgenticTaskSession(model.sessionId)).resolves.toEqual({ status: 'activated' });

      expect(registry.rememberActiveTaskSession).not.toHaveBeenCalled();
    });

    it('commits an Agentic transcript before Live Ready and keeps submission loading active', async () => {
      const { chatManagerService, model, service } = createService();
      const loadingChanges: boolean[] = [];
      let resolveLiveReady!: (status: 'ready') => void;
      const liveReady = new Promise<'ready'>((resolve) => {
        resolveLiveReady = resolve;
      });
      chatManagerService.loadSession.mockResolvedValue({ liveReady });
      service.onSessionLoadingChange((loading) => loadingChanges.push(loading));

      await expect(service.activateAgenticTaskSession(model.sessionId)).resolves.toEqual({ status: 'activated' });

      expect(service.sessionModel).toBe(model);
      expect(service.isSessionLoading).toBe(true);
      expect(service.getAgenticSessionLiveReadyStatus(model.sessionId)).toBe('pending');
      expect(loadingChanges).toEqual([true]);

      resolveLiveReady('ready');
      await liveReady;
      await Promise.resolve();

      expect(service.isSessionLoading).toBe(false);
      expect(service.getAgenticSessionLiveReadyStatus(model.sessionId)).toBe('ready');
      expect(loadingChanges).toEqual([true, false]);
    });

    it('keeps a Transcript Ready Agentic session unsendable when Live Ready fails', async () => {
      const { chatManagerService, model, service } = createService();
      chatManagerService.loadSession.mockResolvedValue({ liveReady: Promise.resolve('failed') });

      await expect(service.activateAgenticTaskSession(model.sessionId)).resolves.toEqual({ status: 'activated' });
      await Promise.resolve();

      expect(service.isSessionLoading).toBe(false);
      expect(service.getAgenticSessionLiveReadyStatus(model.sessionId)).toBe('failed');
    });

    it('does not use a legacy persisted Task Draft when creating a Session', async () => {
      const { chatManagerService, registry, service } = createService();
      registry.consumePendingLaunch.mockReturnValue({ projectId: 'project-b', agentId: 'agent-b' });
      registry.getProject.mockResolvedValue({ id: 'project-b', workspacePath: '/work/b' });

      await service.ensureSessionModel();

      expect(chatManagerService.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          acpTarget: undefined,
          operationId: expect.stringMatching(/^acp-launch-/),
        }),
      );
      expect(registry.consumePendingLaunch).not.toHaveBeenCalled();
    });

    it('refreshes Agent sessions after the first accepted prompt without writing unread Task metadata', async () => {
      const { chatManagerService, model, registry, service } = createService();
      const backgroundModel = new ChatModel(new ChatFeatureRegistry(), {
        sessionId: 'acp:background',
        acpTarget: { agentId: 'agent-b', cwd: '/work/a' },
      });
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

      expect(registry.registerProject).toHaveBeenCalledWith(expect.objectContaining({ workspacePath: '/work/a' }));
      expect(registry.registerFirstPrompt).not.toHaveBeenCalled();
      expect(chatManagerService.refreshAgentSessionCatalog).toHaveBeenCalledTimes(1);

      backgroundModel.history.addAssistantMessage({ content: 'background reply' });

      expect(registry.markUnread).not.toHaveBeenCalled();
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

    it('completes and resolves synchronous sendRequest failures when Agentic Task registration is not required', async () => {
      const { chatManagerService, model, service } = createService();
      service.panelLayoutService.getLayoutMode.mockReturnValue('classic');
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

      await expect(service.sendRequest(request)).resolves.toBeUndefined();
      expect(request.response.errorDetails).toEqual({ message: error.message });
      expect(request.response.isComplete).toBe(true);
    });

    it('does not persist an Agentic Task when request kickoff fails before acceptance', async () => {
      const { chatManagerService, model, registry, service } = createService();
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

      await expect(service.sendRequest(request)).resolves.toBeUndefined();

      expect(registry.registerFirstPrompt).not.toHaveBeenCalled();
      expect(chatManagerService.disposeSession).toHaveBeenCalledWith(model.sessionId);
      expect(service.sessionModel).toBeUndefined();
      expect(request.response.errorDetails).toEqual({ message: error.message });
      expect(request.response.isComplete).toBe(true);
    });

    it('does not write legacy Task status, unread, attention, or active-session metadata', async () => {
      const { model, registry, service } = createService();
      const request = model.addRequest({
        prompt: 'Agent-owned session',
        agentId: 'agent-b',
        command: '',
        images: [],
      });

      await service.sendRequest(request);

      expect(registry.registerFirstPrompt).not.toHaveBeenCalled();
      expect(registry.rememberActiveTaskSession).not.toHaveBeenCalled();
      expect(registry.updateStatus).not.toHaveBeenCalled();
      expect(registry.updateAttention).not.toHaveBeenCalled();
      expect(registry.markUnread).not.toHaveBeenCalled();
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

    it('cancels a pending first-launch Session and ignores a late successful result', async () => {
      const { aiBackService, chatManagerService, model, service } = createService();
      let resolveStartSession!: (model: ChatModel) => void;
      chatManagerService.startSession.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStartSession = resolve;
          }),
      );

      const creation = service.ensureSessionModel();
      await Promise.resolve();
      const cancellation = service.cancelPendingSessionCreation();

      expect(aiBackService.cancelSessionCreation).toHaveBeenCalledWith(expect.stringMatching(/^acp-launch-/));
      resolveStartSession(model);
      await cancellation;

      await expect(creation).rejects.toMatchObject({ name: 'ACP_SESSION_CREATION_CANCELLED' });
      expect(chatManagerService.disposeSession).toHaveBeenCalledWith(model.sessionId);
      expect(service.sessionModel).toBeUndefined();
    });

    it('invalidates a pending draft capability lookup before Session acquisition', async () => {
      const { aiBackService, chatManagerService, registry, service } = createService();
      let resolveCapabilities!: (value: { close: boolean; delete: boolean }) => void;
      aiBackService.getSessionCapabilities.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCapabilities = resolve;
          }),
      );

      service.enterAgenticTaskDraft({ agentId: 'agent-b', cwd: '/work/b' });
      await Promise.resolve();
      const discard = service.discardAgenticTaskDraft();
      resolveCapabilities({ close: true, delete: true });
      await discard;
      await Promise.resolve();

      expect(chatManagerService.startSession).not.toHaveBeenCalled();
      expect(registry.clearPendingLaunch).toHaveBeenCalledTimes(1);
      expect(service.sessionModel).toBeUndefined();
    });

    it('releases a temporary first-launch Session when cancellation wins before request acceptance', async () => {
      const { chatManagerService, model, service } = createService();
      service._sessionModel = model;

      await service.cancelPendingSessionCreation();

      expect(chatManagerService.cancelRequest).toHaveBeenCalledWith(model.sessionId);
      expect(chatManagerService.disposeSession).toHaveBeenCalledWith(model.sessionId);
      expect(service.sessionModel).toBeUndefined();
    });

    it('keeps the remembered active Task when entering draft before a Session is established', () => {
      const { registry, service } = createService();

      service.enterDraftSession({ force: true });

      expect(registry.clearRememberedActiveTaskSession).not.toHaveBeenCalled();
    });

    it('enters draft without retaining the previous session slash commands', () => {
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
      expect(service.getAvailableCommands()).toEqual([]);
      expect(permissionBridgeService.setActiveSession).toHaveBeenCalledWith(undefined);
      expect(sessionModelChanges).toEqual([undefined]);
      expect(availableCommandsChanges).toEqual([[]]);
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

      expect(chatManagerService.disposeSession).toHaveBeenCalledWith('acp:sess-1');
      expect(chatManagerService.startSession).not.toHaveBeenCalled();
      expect(permissionBridgeService.clearSessionDialogs).toHaveBeenCalledWith('sess-1');
      expect(service.sessionModel).toBeUndefined();
    });

    it('clears local active state even when backend ACP session disposal fails', async () => {
      const { chatManagerService, model, permissionBridgeService, service } = createService();
      const error = new Error('backend dispose failed');
      chatManagerService.disposeSession = jest.fn().mockRejectedValue(error);
      service._sessionModel = model;

      await expect(service.clearSessionModel()).rejects.toThrow(error);

      expect(permissionBridgeService.clearSessionDialogs).toHaveBeenCalledWith('sess-1');
      expect(service.sessionModel).toBeUndefined();
    });

    it('registers an Agentic draft target Project instead of the IDE workspace', async () => {
      const { chatManagerService, model, registry, service } = createService({
        agentId: 'agent-b',
        cwd: '/work/other',
      });

      await service.refreshCatalogAfterFirstAgenticPrompt(model.sessionId);

      expect(registry.registerProject).toHaveBeenCalledWith(
        expect.objectContaining({
          workspacePath: '/work/other',
          workspaceUri: URI.file('/work/other').toString(),
        }),
      );
      expect(registry.registerFirstPrompt).not.toHaveBeenCalled();
      expect(chatManagerService.refreshAgentSessionCatalog).toHaveBeenCalledTimes(1);
    });

    it('falls back to draft when loading an ACP session fails', async () => {
      const { chatManagerService, messageService, service } = createService();
      const loadingChanges: boolean[] = [];
      const missingSessionError = new Error('Resource not found: acp:missing');
      missingSessionError.name = ACP_SESSION_NOT_FOUND_ERROR_NAME;
      chatManagerService.loadSession.mockRejectedValueOnce(missingSessionError);
      service.onSessionLoadingChange((loading) => loadingChanges.push(loading));

      await service.activateSession('acp:missing');

      expect(chatManagerService.startSession).not.toHaveBeenCalled();
      expect(messageService.info).toHaveBeenCalledWith(
        'This chat history is no longer available. A new chat draft is ready, and a session will be created when you send a message.',
      );
      expect(service.sessionModel).toBeUndefined();
      expect(loadingChanges).toEqual([true, false]);
    });

    it('keeps the active ACP session and composer state when an Agentic Task session cannot load', async () => {
      const { chatManagerService, messageService, model: currentModel, service } = createService();
      const loadingChanges: boolean[] = [];
      service._sessionModel = currentModel;
      const missingSessionError = new Error('Resource not found: acp:missing');
      missingSessionError.name = ACP_SESSION_NOT_FOUND_ERROR_NAME;
      chatManagerService.loadSession.mockRejectedValueOnce(missingSessionError);
      service.onSessionLoadingChange((loading) => loadingChanges.push(loading));

      await expect(service.activateAgenticTaskSession('acp:missing')).resolves.toEqual({
        status: 'conversation-unavailable',
      });

      expect(service.sessionModel).toBe(currentModel);
      expect(loadingChanges).toEqual([true, false]);
      expect(messageService.info).toHaveBeenCalledWith(
        'This task history is no longer available. The previous Task remains active.',
      );
    });

    it('keeps the active ACP session and reports missing history when ACP load returns no session', async () => {
      const { chatManagerService, messageService, model: currentModel, service } = createService();
      service._sessionModel = currentModel;
      chatManagerService.getSession.mockReturnValue(undefined);

      await expect(service.activateAgenticTaskSession('acp:missing')).resolves.toEqual({ status: 'failed' });

      expect(service.sessionModel).toBe(currentModel);
      expect(messageService.info).toHaveBeenCalledWith(
        'Unable to open this task history. The previous Task remains active.',
      );
    });

    it('does not infer a missing Task Conversation from legacy error text', async () => {
      const { chatManagerService, messageService, model: currentModel, service } = createService();
      service._sessionModel = currentModel;
      chatManagerService.loadSession.mockRejectedValueOnce(new Error('Session not found'));

      await expect(service.activateAgenticTaskSession('acp:missing')).resolves.toEqual({ status: 'failed' });

      expect(service.sessionModel).toBe(currentModel);
      expect(messageService.info).toHaveBeenCalledWith(
        'Unable to open this task history. The previous Task remains active.',
      );
    });

    it('validates an Agent session without changing the Active Session or recording Task metadata', async () => {
      const { chatManagerService, model: currentModel, registry, service } = createService();
      const validatedModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:validated' });
      validatedModel.setThreadStatus('working');
      service._sessionModel = currentModel;
      chatManagerService.getSession.mockImplementation((sessionId: string) =>
        sessionId === validatedModel.sessionId ? validatedModel : currentModel,
      );
      registry.getTask.mockResolvedValue({ sessionId: validatedModel.sessionId });

      await expect(service.validateAgenticTaskSession(validatedModel.sessionId)).resolves.toEqual({
        status: 'validated',
        taskStatus: 'running',
      });

      expect(service.sessionModel).toBe(currentModel);
      expect(registry.rememberActiveTaskSession).not.toHaveBeenCalledWith(validatedModel.sessionId);
      expect(service.isAgenticTaskSessionObserved(validatedModel.sessionId)).toBe(false);
    });

    it('activates only the latest overlapping Agentic Task selection', async () => {
      const { chatManagerService, service } = createService();
      const firstModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:first' });
      const secondModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:second' });
      const loadingChanges: boolean[] = [];
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
      service.onSessionLoadingChange((loading) => loadingChanges.push(loading));

      const firstActivation = service.activateAgenticTaskSession('acp:first');
      const secondActivation = service.activateAgenticTaskSession('acp:second');
      resolveSecond();
      await secondActivation;
      expect(loadingChanges).toEqual([true]);
      expect(service.isSessionLoading).toBe(true);
      resolveFirst();

      await expect(firstActivation).resolves.toEqual({ status: 'superseded' });
      expect(chatManagerService.disposeSession).toHaveBeenCalledWith('acp:first');
      expect(service.sessionModel?.sessionId).toBe('acp:second');
      expect(loadingChanges).toEqual([true, false]);
      expect(service.isSessionLoading).toBe(false);
    });

    it('activates only the latest overlapping ordinary ACP session selection', async () => {
      const { chatManagerService, service } = createService();
      const firstModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:first' });
      const secondModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:second' });
      const loadingChanges: boolean[] = [];
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
      service.onSessionLoadingChange((loading) => loadingChanges.push(loading));

      const firstActivation = service.activateSession('acp:first');
      const secondActivation = service.activateSession('acp:second');
      resolveSecond();
      await secondActivation;

      expect(service.sessionModel).toBe(secondModel);
      expect(loadingChanges).toEqual([true]);
      expect(service.isSessionLoading).toBe(true);

      resolveFirst();
      await firstActivation;

      expect(service.sessionModel).toBe(secondModel);
      expect(chatManagerService.disposeSession).toHaveBeenCalledWith('acp:first');
      expect(loadingChanges).toEqual([true, false]);
      expect(service.isSessionLoading).toBe(false);
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

      await expect(activation).resolves.toEqual({ status: 'superseded' });
      expect(service.sessionModel).toBe(currentModel);
      expect(chatManagerService.disposeSession).toHaveBeenCalledWith('acp:selected');
    });

    it('releases a validation load superseded after it settles', async () => {
      const { chatManagerService, service } = createService();
      const selectedModel = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:selected' });
      let resolveLoad!: () => void;
      const load = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
      let shouldApply = true;
      chatManagerService.loadSession.mockReturnValue(load);
      chatManagerService.getSession.mockReturnValue(selectedModel);

      const validation = service.validateAgenticTaskSession('acp:selected', () => shouldApply);
      shouldApply = false;
      resolveLoad();

      await expect(validation).resolves.toEqual({ status: 'superseded' });
      expect(chatManagerService.disposeSession).toHaveBeenCalledWith('acp:selected');
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
      const error = new Error('Resource not found: acp:missing');
      error.name = ACP_SESSION_NOT_FOUND_ERROR_NAME;
      expect(formatAcpLoadSessionFallbackMessage(error)).toBe(
        'This chat history is no longer available. A new chat draft is ready, and a session will be created when you send a message.',
      );
    });
  });
});
