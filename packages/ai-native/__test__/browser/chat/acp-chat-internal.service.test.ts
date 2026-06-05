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
        currentModeId: 'code',
      });
      const stateEmitter = new Emitter<any>();
      const chatManagerService = {
        clearSession: jest.fn(),
        getAvailableCommands: jest.fn(() => [{ name: 'help', description: 'Help' }]),
        getSession: jest.fn(() => model),
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

      Object.defineProperty(service, 'chatManagerService', {
        value: chatManagerService,
      });
      Object.defineProperty(service, 'permissionBridgeService', {
        value: permissionBridgeService,
      });
      Object.defineProperty(service, 'messageService', {
        value: messageService,
      });
      Object.defineProperty(service, 'aiNativeConfigService', {
        value: { capabilities: { supportsAgentMode: true } },
      });
      Object.defineProperty(service, 'logger', {
        value: { error: jest.fn(), log: jest.fn() },
      });

      return {
        chatManagerService,
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

    it('enters draft and clears active ACP session state', () => {
      const { model, permissionBridgeService, service } = createService();
      const sessionModelChanges: any[] = [];
      const availableCommandsChanges: any[] = [];
      const modeChanges: string[] = [];
      const sessionChanges: string[] = [];
      service._sessionModel = model;

      service.onSessionModelChange((sessionModel) => sessionModelChanges.push(sessionModel));
      service.onAvailableCommandsChange((commands) => availableCommandsChanges.push(commands));
      service.onModeChange((modeId) => modeChanges.push(modeId));
      service.onChangeSession((sessionId) => sessionChanges.push(sessionId));

      service.enterDraftSession();

      expect(service.sessionModel).toBeUndefined();
      expect(permissionBridgeService.setActiveSession).toHaveBeenCalledWith(undefined);
      expect(sessionModelChanges).toEqual([undefined]);
      expect(availableCommandsChanges).toEqual([[]]);
      expect(modeChanges).toEqual(['']);
      expect(sessionChanges).toEqual(['']);
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
