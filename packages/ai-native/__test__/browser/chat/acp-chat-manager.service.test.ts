import { ChatMessageRole } from '@opensumi/ide-core-common';

import { AcpChatManagerService } from '../../../src/browser/chat/chat-manager.service.acp';
import { ChatModel } from '../../../src/browser/chat/chat-model';
import { ChatFeatureRegistry } from '../../../src/browser/chat/chat.feature.registry';

describe('AcpChatManagerService', () => {
  const createService = () => {
    const service = Object.create(AcpChatManagerService.prototype) as AcpChatManagerService & {
      aiNativeConfig: any;
      chatFeatureRegistry: ChatFeatureRegistry;
      sessionModels: Map<string, ChatModel>;
      mainProvider: any;
      listenSession: jest.Mock;
      fromAcpJSON(data: any[]): ChatModel[];
    };

    Object.defineProperty(service, 'aiNativeConfig', {
      value: {
        capabilities: {
          supportsAgentMode: true,
        },
      },
    });
    Object.defineProperty(service, 'chatFeatureRegistry', {
      value: new ChatFeatureRegistry(),
    });
    Object.defineProperty(service, 'sessionModels', {
      value: new Map(),
    });
    Object.defineProperty(service, 'listenSession', {
      value: jest.fn(),
    });

    return service;
  };

  it('preserves metadata title when loading a full ACP session without title', async () => {
    const service = createService();
    const sessionId = 'acp:s1';
    const metadataModel = service.fromAcpJSON([
      {
        sessionId,
        history: {
          additional: {},
          messages: [],
        },
        requests: [],
        title: 'commit',
      },
    ])[0];

    service.sessionModels.set(sessionId, metadataModel);
    Object.defineProperty(service, 'mainProvider', {
      value: {
        loadSession: jest.fn().mockResolvedValue({
          sessionId,
          history: {
            additional: {},
            messages: [
              {
                id: `${sessionId}-msg-0`,
                role: ChatMessageRole.User,
                content: 'first prompt',
                order: 0,
              },
            ],
          },
          requests: [],
        }),
      },
    });

    await service.loadSession(sessionId);

    const loadedModel = service.sessionModels.get(sessionId);
    expect(loadedModel?.title).toBe('commit');
    expect(loadedModel?.history.getMessages()).toHaveLength(1);
  });

  it('does not default loaded ACP sessions with messages to New Session', () => {
    const service = createService();
    const [model] = service.fromAcpJSON([
      {
        sessionId: 'acp:s2',
        history: {
          additional: {},
          messages: [
            {
              id: 'acp:s2-msg-0',
              role: ChatMessageRole.User,
              content: 'fallback title source',
              order: 0,
            },
          ],
        },
        requests: [],
      },
    ]);

    expect(model.title).toBe('');
  });

  it('does not preserve synthetic New Session title when full session has messages', async () => {
    const service = createService();
    const sessionId = 'acp:s2';
    const metadataModel = service.fromAcpJSON([
      {
        sessionId,
        history: {
          additional: {},
          messages: [],
        },
        requests: [],
      },
    ])[0];

    expect(metadataModel.title).toBe('New Session');

    service.sessionModels.set(sessionId, metadataModel);
    Object.defineProperty(service, 'mainProvider', {
      value: {
        loadSession: jest.fn().mockResolvedValue({
          sessionId,
          history: {
            additional: {},
            messages: [
              {
                id: `${sessionId}-msg-0`,
                role: ChatMessageRole.User,
                content: 'fallback title source',
                order: 0,
              },
            ],
          },
          requests: [],
        }),
      },
    });

    await service.loadSession(sessionId);

    expect(service.sessionModels.get(sessionId)?.title).toBe('');
  });

  it('keeps New Session as the default for empty ACP sessions', () => {
    const service = createService();
    const [model] = service.fromAcpJSON([
      {
        sessionId: 'acp:s3',
        history: {
          additional: {},
          messages: [],
        },
        requests: [],
      },
    ]);

    expect(model.title).toBe('New Session');
  });
});
