import { Emitter } from '@opensumi/ide-core-common';

import { ChatModel } from '../../../src/browser/chat/chat-model';
import { ChatFeatureRegistry } from '../../../src/browser/chat/chat.feature.registry';
import {
  AcpChatInternalService,
  formatAcpLoadSessionFallbackMessage,
} from '../../../src/browser/chat/chat.internal.service.acp';

const disposable = () => ({ dispose: jest.fn() });

describe('AcpChatInternalService', () => {
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
        startSession: jest.fn(() => Promise.resolve(model)),
      };
      const permissionBridgeService = {
        clearSessionDialogs: jest.fn(),
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
      Object.defineProperty(service, 'logger', {
        value: { error: jest.fn(), log: jest.fn(), warn: jest.fn() },
      });

      return {
        chatManagerService,
        aiBackService,
        messageService,
        model,
        permissionBridgeService,
        service,
      };
    }

    it('reuses the active ACP session when ensuring a session model', async () => {
      const { chatManagerService, model, service } = createService();
      service._sessionModel = model;

      await expect(service.ensureSessionModel()).resolves.toBe(model);

      expect(chatManagerService.startSession).not.toHaveBeenCalled();
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
      const { chatManagerService, model, service } = createService();
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
