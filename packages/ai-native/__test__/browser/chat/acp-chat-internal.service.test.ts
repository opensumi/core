import { Emitter } from '@opensumi/ide-core-common';

import { ChatModel } from '../../../src/browser/chat/chat-model';
import { ChatFeatureRegistry } from '../../../src/browser/chat/chat.feature.registry';
import {
  AcpChatInternalService,
  formatAcpLoadSessionFallbackMessage,
} from '../../../src/browser/chat/chat.internal.service.acp';

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

  describe('formatAcpLoadSessionFallbackMessage()', () => {
    it('returns a friendly fallback message for object-shaped errors', () => {
      expect(
        formatAcpLoadSessionFallbackMessage({
          code: -32603,
          data: {
            sessionId: 'a3e1d854-a698-463b-9492-10b8638f30e3',
          },
        }),
      ).toBe('Unable to open this chat history. A new session has been created.');
    });

    it('returns a friendly not-found message when the session no longer exists', () => {
      expect(formatAcpLoadSessionFallbackMessage(new Error('Session not found'))).toBe(
        'This chat history is no longer available. A new session has been created.',
      );
    });
  });
});
