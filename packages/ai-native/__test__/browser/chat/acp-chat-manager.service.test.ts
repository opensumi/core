import { ChatMessageRole } from '@opensumi/ide-core-common';

import { ACPSessionProvider } from '../../../src/browser/chat/acp-session-provider';
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
      acpTitleStorage: any;
      acpSessionDisplayTitleOverrides: Record<string, string>;
      storageInitEmitter: any;
      listenSession: jest.Mock;
      fromAcpJSON(data: any[]): ChatModel[];
      toSessionData(model: ChatModel): any;
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
    Object.defineProperty(service, 'logger', {
      value: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
    });
    Object.defineProperty(service, 'sessionModels', {
      value: new Map(),
    });
    Object.defineProperty(service, 'acpSessionDisplayTitleOverrides', {
      value: {},
      writable: true,
    });
    Object.defineProperty(service, 'acpTitleStorage', {
      value: undefined,
      writable: true,
    });
    Object.defineProperty(service, 'storageInitEmitter', {
      value: {
        fireAndAwait: jest.fn().mockResolvedValue(undefined),
      },
    });
    Object.defineProperty(service, 'listenSession', {
      value: jest.fn(),
    });

    return service;
  };

  const createConstructedService = () => {
    const aiNativeConfig = {
      capabilities: {
        supportsAgentMode: true,
      },
    };
    const prototype = AcpChatManagerService.prototype as any;
    const originalAiNativeConfig = Object.getOwnPropertyDescriptor(prototype, 'aiNativeConfig');
    const originalSessionProviderRegistry = Object.getOwnPropertyDescriptor(prototype, 'sessionProviderRegistry');

    Object.defineProperty(prototype, 'aiNativeConfig', {
      configurable: true,
      get: () => aiNativeConfig,
    });
    Object.defineProperty(prototype, 'sessionProviderRegistry', {
      configurable: true,
      get: () => ({
        getAllProviders: () => [],
      }),
    });

    let service!: AcpChatManagerService & {
      chatFeatureRegistry: ChatFeatureRegistry;
      acpTitleStorage: any;
      acpSessionDisplayTitleOverrides: Record<string, string>;
    };

    try {
      service = new AcpChatManagerService() as typeof service;
    } finally {
      if (originalAiNativeConfig) {
        Object.defineProperty(prototype, 'aiNativeConfig', originalAiNativeConfig);
      } else {
        delete prototype.aiNativeConfig;
      }
      if (originalSessionProviderRegistry) {
        Object.defineProperty(prototype, 'sessionProviderRegistry', originalSessionProviderRegistry);
      } else {
        delete prototype.sessionProviderRegistry;
      }
    }

    Object.defineProperty(service, 'aiNativeConfig', {
      value: aiNativeConfig,
    });
    Object.defineProperty(service, 'chatFeatureRegistry', {
      value: new ChatFeatureRegistry(),
    });
    Object.defineProperty(service, 'logger', {
      value: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
    });
    Object.defineProperty(service, 'acpSessionDisplayTitleOverrides', {
      value: {},
      writable: true,
    });

    const storage = {
      set: jest.fn(),
    };
    Object.defineProperty(service, 'acpTitleStorage', {
      value: storage,
      writable: true,
    });

    return { service, storage };
  };

  const createSessionProvider = () => {
    const provider = Object.create(ACPSessionProvider.prototype) as ACPSessionProvider & {
      aiBackService: any;
      configProvider: any;
      loadedSessionMap: Map<string, any>;
      messageService: any;
      convertAgentSessionToModel(sessionId: string, agentSession: any): any;
    };

    Object.defineProperty(provider, 'configProvider', {
      value: {
        resolveConfig: jest.fn().mockResolvedValue({ cwd: '/workspace' }),
      },
    });
    Object.defineProperty(provider, 'messageService', {
      value: {
        error: jest.fn(),
      },
    });
    Object.defineProperty(provider, 'loadedSessionMap', {
      value: new Map(),
    });

    return provider;
  };

  it('sets creation time when creating an ACP session', async () => {
    const provider = createSessionProvider();
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        createSession: jest.fn().mockResolvedValue({
          sessionId: 's1',
        }),
      },
    });
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);

    try {
      const session = await provider.createSession();

      expect(session.createdAt).toBe(12345);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('uses the first agent message timestamp as loaded ACP session creation time', () => {
    const provider = createSessionProvider();

    const session = provider.convertAgentSessionToModel('acp:s1', {
      sessionId: 's1',
      messages: [
        {
          role: 'user',
          content: 'first prompt',
          timestamp: 67890,
        },
        {
          role: 'assistant',
          content: 'reply',
          timestamp: 67891,
        },
      ],
    });

    expect(session.createdAt).toBe(67890);
  });

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

  it('preserves creation time when restoring and serializing ACP sessions', () => {
    const service = createService();
    const [model] = service.fromAcpJSON([
      {
        sessionId: 'acp:s-created',
        createdAt: 12345,
        history: {
          additional: {},
          messages: [],
        },
        requests: [],
        title: 'created session',
      },
    ]);

    expect(model.createdAt).toBe(12345);
    expect(service.toSessionData(model).createdAt).toBe(12345);
  });

  it('keeps existing list title when a full ACP session is loaded', async () => {
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
        title: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.',
      },
    ])[0];
    service.acpTitleStorage = {
      set: jest.fn(),
    };

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
                content: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.\n\n---\n\n3',
                order: 0,
              },
            ],
          },
          requests: [],
        }),
      },
    });

    await service.loadSession(sessionId);

    expect(service.sessionModels.get(sessionId)?.title).toBe('Session s1');
    expect(service.acpTitleStorage.set).not.toHaveBeenCalled();
  });

  it('uses local display title override before polluted agent title', () => {
    const service = createService();
    service.acpSessionDisplayTitleOverrides = {
      'acp:s1': '3',
    };

    const [model] = service.fromAcpJSON([
      {
        sessionId: 'acp:s1',
        history: {
          additional: {},
          messages: [],
        },
        requests: [],
        title: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.',
      },
    ]);

    expect(model.title).toBe('3');
  });

  it('does not load full sessions when rendering the history list', async () => {
    const service = createService();
    service.mainProvider = {
      loadSessions: jest.fn().mockResolvedValue([
        {
          sessionId: 'acp:s1',
          history: {
            additional: {},
            messages: [],
          },
          requests: [],
          title: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.',
        },
      ]),
      loadSession: jest.fn().mockResolvedValue({
        sessionId: 'acp:s1',
        history: {
          additional: {},
          messages: [
            {
              id: 'acp:s1-msg-0',
              role: ChatMessageRole.User,
              content: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.\n\n---\n\n3',
              order: 0,
            },
          ],
        },
        requests: [],
      }),
    };

    await service.loadSessionList();

    expect(service.mainProvider.loadSession).not.toHaveBeenCalled();
    expect(service.sessionModels.get('acp:s1')?.title).toBe('Session s1');
  });

  it('uses local override on history list without loading full session data', async () => {
    const service = createService();
    service.acpSessionDisplayTitleOverrides = {
      'acp:s1': '3',
    };
    service.mainProvider = {
      loadSessions: jest.fn().mockResolvedValue([
        {
          sessionId: 'acp:s1',
          history: {
            additional: {},
            messages: [],
          },
          requests: [],
          title: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.',
        },
      ]),
      loadSession: jest.fn().mockResolvedValue({
        sessionId: 'acp:s1',
        history: {
          additional: {},
          messages: [
            {
              id: 'acp:s1-msg-0',
              role: ChatMessageRole.User,
              content: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.\n\n---\n\n3',
              order: 0,
            },
          ],
        },
        requests: [],
      }),
    };

    await service.loadSessionList();

    expect(service.sessionModels.get('acp:s1')?.title).toBe('3');
    expect(service.mainProvider.loadSession).not.toHaveBeenCalled();
  });

  it('extracts list title from ACP prompt separator in metadata title', async () => {
    const service = createService();
    service.mainProvider = {
      loadSessions: jest.fn().mockResolvedValue([
        {
          sessionId: 'acp:s1',
          history: {
            additional: {},
            messages: [],
          },
          requests: [],
          title: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.\n\n---\n\n3',
        },
      ]),
    };

    await service.loadSessionList();

    expect(service.sessionModels.get('acp:s1')?.title).toBe('3');
  });

  it('keeps the current empty ACP session last in manager order after loading history list', async () => {
    const service = createService();
    const currentSession = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:current',
      title: 'New Session',
    });
    service.sessionModels.set(currentSession.sessionId, currentSession);
    service.mainProvider = {
      loadSessions: jest.fn().mockResolvedValue([
        {
          sessionId: 'acp:s1',
          history: {
            additional: {},
            messages: [],
          },
          requests: [],
          title: 'history session',
        },
      ]),
    };

    await service.loadSessionList();

    expect(service.getSessions().map((session) => session.sessionId)).toEqual(['acp:s1', 'acp:current']);
  });

  it('keeps ACP session order stable when loading a clicked history item', async () => {
    const { service } = createConstructedService();
    const firstSession = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:first',
      title: 'First Session',
    });
    const secondSession = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:second',
      title: 'Second Session',
    });

    (service as any).sessionModels.set(firstSession.sessionId, firstSession);
    (service as any).sessionModels.set(secondSession.sessionId, secondSession);
    (service as any).mainProvider = {
      loadSession: jest.fn().mockResolvedValue({
        sessionId: 'acp:first',
        history: {
          additional: {},
          messages: [
            {
              id: 'acp:first-msg-0',
              role: ChatMessageRole.User,
              content: 'loaded first prompt',
              order: 0,
            },
          ],
        },
        requests: [],
      }),
    };

    await service.loadSession('acp:first');
    service.getSession('acp:first');

    expect(service.getSessions().map((session) => session.sessionId)).toEqual(['acp:first', 'acp:second']);
    expect(service.getSession('acp:first')?.history.getMessages()).toHaveLength(1);
  });

  it('stores raw first user message as ACP display title when creating request', () => {
    const { service, storage } = createConstructedService();
    const sessionId = 'acp:s1';
    const model = new ChatModel(new ChatFeatureRegistry(), { sessionId });

    (service as any).sessionModels.set(sessionId, model);

    const request = service.createRequest(sessionId, '3', 'agentId', undefined, undefined);

    expect(request?.message.prompt).toBe('3');
    expect(model.title).toBe('3');
    expect(storage.set).toHaveBeenCalledWith('acpSessionDisplayTitleOverrides', {
      [sessionId]: '3',
    });
  });

  it('skips global model preference validation for ACP sessions only', () => {
    const { service } = createConstructedService();
    const acpModel = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:s1',
      modelId: 'qwen3.6-plus',
    });
    const localModel = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'local:s1',
      modelId: 'MiniMax-M2.7',
    });

    expect((service as any).shouldValidateModelChange('acp:s1', acpModel)).toBe(false);
    expect((service as any).shouldValidateModelChange('local:s1', localModel)).toBe(true);
  });

  it('stores raw follow-up message as display title for old polluted ACP sessions', () => {
    const { service, storage } = createConstructedService();
    const sessionId = 'acp:s1';
    const model = new ChatModel(new ChatFeatureRegistry(), {
      sessionId,
      title: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.',
    });

    model.history.addUserMessage({
      agentId: 'agentId',
      agentCommand: '',
      content: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.',
      relationId: '',
      images: [],
    });
    (service as any).sessionModels.set(sessionId, model);

    service.createRequest(sessionId, '3', 'agentId', undefined, undefined);

    expect(model.title).toBe('3');
    expect(storage.set).toHaveBeenCalledWith('acpSessionDisplayTitleOverrides', {
      [sessionId]: '3',
    });
  });

  it('extracts display title from ACP prompt separator when no override exists', () => {
    const service = createService();
    const [model] = service.fromAcpJSON([
      {
        sessionId: 'acp:s4',
        history: {
          additional: {},
          messages: [
            {
              id: 'acp:s4-msg-0',
              role: ChatMessageRole.User,
              content: 'OpenSumi exposes IDE capabilities through the opensumi-ide MCP server.\n\n---\n\n3',
              order: 0,
            },
          ],
        },
        requests: [],
      },
    ]);

    expect(model.title).toBe('3');
  });

  it('falls back to first user message for ACP sessions with messages and no title', () => {
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

    expect(model.title).toBe('fallback title source');
  });

  it('preserves synthetic New Session title when an existing list item loads full messages', async () => {
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

    expect(service.sessionModels.get(sessionId)?.title).toBe('New Session');
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

  it('applies ACP session state updates and emits a change event', () => {
    const { service } = createConstructedService();
    const model = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:sess-1',
      modelId: 'old-model',
      currentModeId: 'plan',
    });
    const configOptions = [{ id: 'permission', name: 'Permission', currentValue: 'default' }];
    const changes: any[] = [];

    (service as any).sessionModels.set(model.sessionId, model);
    service.onDidApplySessionState((event) => changes.push(event));

    service.applySessionStateUpdate('sess-1', {
      currentModeId: 'code',
      currentModelId: 'qwen3.6-plus',
      configOptions,
    });

    expect(model.currentModeId).toBe('code');
    expect(model.modelId).toBe('qwen3.6-plus');
    expect(model.configOptions).toEqual(configOptions);
    expect(changes).toEqual([
      expect.objectContaining({
        sessionId: 'acp:sess-1',
        model,
        previousModeId: 'plan',
        currentModeId: 'code',
      }),
    ]);
  });
});
