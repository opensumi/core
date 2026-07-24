import { ChatMessageRole } from '@opensumi/ide-core-common';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

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
    Object.defineProperty(service, 'ownedBackendSessions', {
      value: new Set(),
    });
    Object.defineProperty(service, 'sessionDisposeRequests', {
      value: new Map(),
    });
    Object.defineProperty(service, 'sessionLoadGenerations', {
      value: new Map(),
    });
    Object.defineProperty(service, 'sessionLifecycleOperations', {
      value: new Map(),
    });
    Object.defineProperty(service, 'shouldFailBddAttachment', {
      value: () => false,
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
      agenticTaskRegistry: any;
      loadedSessionMap: Map<string, any>;
      messageService: any;
      convertAgentSessionToModel(sessionId: string, agentSession: any): any;
    };

    Object.defineProperty(provider, 'configProvider', {
      value: {
        resolveConfig: jest.fn().mockResolvedValue({ agentId: 'claude-agent-acp', cwd: '/workspace' }),
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

  it('returns the resolved ACP target as non-persistent session metadata', async () => {
    const provider = createSessionProvider();
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        createSession: jest.fn().mockResolvedValue({
          sessionId: 's1',
        }),
      },
    });

    const session = await provider.createSession();

    expect(session.extension?.acpTarget).toEqual({
      agentId: 'claude-agent-acp',
      cwd: '/workspace',
    });
  });

  it('disposes an ACP provider session using its raw backend session id', async () => {
    const provider = createSessionProvider();
    const disposeSession = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(provider, 'aiBackService', {
      value: { disposeSession },
    });

    await provider.disposeSession('acp:s1');

    expect(disposeSession).toHaveBeenCalledWith('s1');
  });

  it('releases the backend session before clearing the browser session model', async () => {
    const service = createService() as any;
    service.ownedBackendSessions.add('acp:s1');
    const calls: string[] = [];
    service.mainProvider = {
      disposeSession: jest.fn(async () => {
        calls.push('backend');
      }),
    };
    service.clearSession = jest.fn(() => {
      calls.push('browser');
    });
    service.getSession = jest.fn(() => (calls.includes('browser') ? undefined : {}));

    await service.disposeSession('acp:s1');

    expect(calls).toEqual(['backend', 'browser']);
  });

  it('deduplicates overlapping backend session disposal and clears the browser model once', async () => {
    const service = createService() as any;
    service.ownedBackendSessions.add('acp:s1');
    let releaseBackend!: () => void;
    let notifyBackendStarted!: () => void;
    const backendStarted = new Promise<void>((resolve) => {
      notifyBackendStarted = resolve;
    });
    service.mainProvider = {
      disposeSession: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseBackend = resolve;
            notifyBackendStarted();
          }),
      ),
    };
    service.getSession = jest.fn(() => (service.clearSession.mock.calls.length === 0 ? {} : undefined));
    service.clearSession = jest.fn();

    const first = service.disposeSession('acp:s1');
    const second = service.disposeSession('acp:s1');
    await backendStarted;
    releaseBackend();
    await Promise.all([first, second]);

    expect(service.mainProvider.disposeSession).toHaveBeenCalledTimes(1);
    expect(service.clearSession).toHaveBeenCalledTimes(1);
  });

  it('keeps successful session disposal idempotent across sequential calls', async () => {
    const service = createService() as any;
    service.ownedBackendSessions.add('acp:s1');
    service.mainProvider = {
      disposeSession: jest.fn().mockResolvedValue(undefined),
    };
    service.getSession = jest.fn(() => (service.clearSession.mock.calls.length === 0 ? {} : undefined));
    service.clearSession = jest.fn();

    await service.disposeSession('acp:s1');
    await service.disposeSession('acp:s1');

    expect(service.mainProvider.disposeSession).toHaveBeenCalledTimes(1);
    expect(service.clearSession).toHaveBeenCalledTimes(1);
  });

  it('shares an overlapping failed disposal and retries only after it settles', async () => {
    const service = createService() as any;
    const error = new Error('ambiguous backend disposal failure');
    service.ownedBackendSessions.add('acp:s1');
    service.mainProvider = {
      disposeSession: jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined),
    };
    service.getSession = jest.fn(() => undefined);
    service.clearSession = jest.fn();

    const first = service.disposeSession('acp:s1');
    const second = service.disposeSession('acp:s1');
    await expect(Promise.all([first, second])).rejects.toThrow(error);

    expect(service.mainProvider.disposeSession).toHaveBeenCalledTimes(1);

    await expect(service.disposeSession('acp:s1')).resolves.toBeUndefined();
    expect(service.mainProvider.disposeSession).toHaveBeenCalledTimes(2);
  });

  it('disposes a session again after the same historical session is reloaded', async () => {
    const service = createService() as any;
    service.ownedBackendSessions.add('acp:s1');
    let browserOwnsSession = true;
    service.getSession = jest.fn(() => (browserOwnsSession ? {} : undefined));
    service.clearSession = jest.fn(() => {
      browserOwnsSession = false;
    });
    service.mainProvider = {
      disposeSession: jest.fn().mockResolvedValue(undefined),
      loadSession: jest.fn(async () => {
        browserOwnsSession = true;
        return {
          sessionId: 'acp:s1',
          history: { additional: {}, messages: [] },
          requests: [],
        };
      }),
    };

    await service.disposeSession('acp:s1');
    await service.loadSession('acp:s1');
    await service.disposeSession('acp:s1');

    expect(service.mainProvider.disposeSession).toHaveBeenCalledTimes(2);
    expect(service.clearSession).toHaveBeenCalledTimes(2);
  });

  it('serializes a pending historical reload before disposing its reacquired session', async () => {
    const service = createService() as any;
    let browserOwnsSession = false;
    let resolveLoad!: (session: any) => void;
    const loadPending = new Promise<any>((resolve) => {
      resolveLoad = resolve;
    });
    service.getSession = jest.fn(() => (browserOwnsSession ? {} : undefined));
    service.clearSession = jest.fn(() => {
      browserOwnsSession = false;
    });
    service.mainProvider = {
      disposeSession: jest.fn().mockResolvedValue(undefined),
      loadSession: jest.fn(() => loadPending),
    };

    await service.disposeSession('acp:s1');
    const reload = service.loadSession('acp:s1');
    const disposeReloaded = service.disposeSession('acp:s1');
    browserOwnsSession = true;
    resolveLoad({
      sessionId: 'acp:s1',
      history: { additional: {}, messages: [] },
      requests: [],
    });
    await Promise.all([reload, disposeReloaded]);

    expect(service.mainProvider.disposeSession).toHaveBeenCalledTimes(1);
    expect(service.clearSession).toHaveBeenCalledTimes(1);
  });

  it('queues a second disposal after a reload requested during the first disposal', async () => {
    const service = createService() as any;
    service.ownedBackendSessions.add('acp:s1');
    let releaseFirstDisposal!: () => void;
    let notifyFirstDisposalStarted!: () => void;
    const firstDisposalStarted = new Promise<void>((resolve) => {
      notifyFirstDisposalStarted = resolve;
    });
    let releaseLoad!: (session: any) => void;
    let notifyLoadStarted!: () => void;
    const loadStarted = new Promise<void>((resolve) => {
      notifyLoadStarted = resolve;
    });
    service.getSession = jest.fn(() => undefined);
    service.clearSession = jest.fn();
    service.mainProvider = {
      disposeSession: jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              releaseFirstDisposal = resolve;
              notifyFirstDisposalStarted();
            }),
        )
        .mockResolvedValueOnce(undefined),
      loadSession: jest.fn(
        () =>
          new Promise<any>((resolve) => {
            releaseLoad = resolve;
            notifyLoadStarted();
          }),
      ),
    };

    const firstDisposal = service.disposeSession('acp:s1');
    await firstDisposalStarted;
    const reload = service.loadSession('acp:s1');
    const secondDisposal = service.disposeSession('acp:s1');

    releaseFirstDisposal();
    await firstDisposal;
    await loadStarted;
    releaseLoad({
      sessionId: 'acp:s1',
      history: { additional: {}, messages: [] },
      requests: [],
    });
    await Promise.all([reload, secondDisposal]);

    expect(service.mainProvider.disposeSession).toHaveBeenCalledTimes(2);
  });

  it('maps a named ACP thread-pool saturation error to an actionable message without notifying directly', async () => {
    const provider = createSessionProvider();
    const saturationError = new Error('Thread pool is full (3), no reusable LRU thread available');
    saturationError.name = 'ACP_THREAD_POOL_SATURATED';
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        createSession: jest.fn().mockRejectedValue(saturationError),
      },
    });

    await expect(provider.createSession()).rejects.toMatchObject({
      name: 'ACP_THREAD_POOL_SATURATED',
      message:
        'ACP concurrent tasks have reached the configured limit of 3. Switch to or stop an active task, then try again.',
    });
    expect((provider as any).messageService.error).not.toHaveBeenCalled();
  });

  it('maps a saturation error without a parseable limit to the actionable fallback', async () => {
    const provider = createSessionProvider();
    const saturationError = new Error('Pool unavailable');
    saturationError.name = 'ACP_THREAD_POOL_SATURATED';
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        createSession: jest.fn().mockRejectedValue(saturationError),
      },
    });

    await expect(provider.createSession()).rejects.toMatchObject({
      name: 'ACP_THREAD_POOL_SATURATED',
      message:
        'ACP concurrent tasks have reached the configured limit. Switch to or stop an active task, then try again.',
    });
    expect((provider as any).messageService.error).not.toHaveBeenCalled();
  });

  it('preserves unrelated ACP session creation errors', async () => {
    const provider = createSessionProvider();
    const originalError = new Error('Agent startup failed');
    originalError.name = 'AgentStartupError';
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        createSession: jest.fn().mockRejectedValue(originalError),
      },
    });

    await expect(provider.createSession()).rejects.toBe(originalError);
  });

  it('uses an explicit ACP target when creating an ACP session', async () => {
    const provider = createSessionProvider();
    const config = { agentId: 'agent-b', cwd: '/work/b' };
    const resolveConfigForTarget = jest.fn().mockResolvedValue(config);
    (provider as any).configProvider.resolveConfigForTarget = resolveConfigForTarget;
    const createSession = jest.fn().mockResolvedValue({ sessionId: 's1' });
    Object.defineProperty(provider, 'aiBackService', {
      value: { createSession },
    });

    await provider.createSession({ acpTarget: { agentId: 'agent-b', cwd: '/work/b' }, operationId: 'launch-1' });

    expect(resolveConfigForTarget).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' });
    expect(createSession).toHaveBeenCalledWith(config, 'launch-1');
  });

  it('keeps ACP target metadata on a newly created browser session', async () => {
    const service = createService();
    Object.defineProperty(service, 'mainProvider', {
      value: {
        canHandle: (mode: string) => mode === 'acp',
        createSession: jest.fn().mockResolvedValue({
          sessionId: 'acp:s1',
          history: { additional: {}, messages: [] },
          requests: [],
          extension: {
            availableCommands: [],
            acpTarget: { agentId: 'claude-agent-acp', cwd: '/workspace' },
          },
        }),
      },
      writable: true,
    });

    const model = await service.startSession();

    expect(model.acpTarget).toEqual({
      agentId: 'claude-agent-acp',
      cwd: '/workspace',
    });
    expect(service.toSessionData(model)).not.toHaveProperty('acpTarget');
    expect(service.toSessionData(model)).not.toHaveProperty('extension');
  });

  it('reloads a registered Task through its stored Agent and Project target', async () => {
    const provider = createSessionProvider();
    const config = { agentId: 'agent-b', cwd: '/work/b' };
    const resolveConfigForTarget = jest.fn().mockResolvedValue(config);
    const loadAgentSession = jest.fn().mockResolvedValue({
      sessionId: 'b',
      messages: [],
    });
    Object.defineProperty(provider, 'agenticTaskRegistry', {
      value: {
        getTask: jest.fn().mockResolvedValue({ sessionId: 'acp:b', projectId: 'project-b', agentId: 'agent-b' }),
        getProject: jest.fn().mockResolvedValue({ id: 'project-b', workspacePath: '/work/b' }),
      },
    });
    (provider as any).configProvider.resolveConfigForTarget = resolveConfigForTarget;
    Object.defineProperty(provider, 'aiBackService', {
      value: { loadAgentSession },
    });

    await provider.loadSession('acp:b');

    expect(resolveConfigForTarget).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' });
    expect(loadAgentSession).toHaveBeenCalledWith(config, 'b');
  });

  it('restores ACP thought and tool-call state into an incomplete request snapshot', async () => {
    const provider = createSessionProvider();
    Object.defineProperty(provider, 'agenticTaskRegistry', {
      value: {
        getTask: jest.fn().mockResolvedValue(undefined),
      },
    });
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        loadAgentSession: jest.fn().mockResolvedValue({
          sessionId: 'running',
          threadStatus: 'working',
          modes: [],
          messages: [],
          historyUpdates: [
            {
              sessionId: 'running',
              update: {
                sessionUpdate: 'user_message_chunk',
                content: { type: 'text', text: 'inspect the project' },
              },
            },
            {
              sessionId: 'running',
              update: {
                sessionUpdate: 'agent_thought_chunk',
                content: { type: 'text', text: 'checking files' },
              },
            },
            {
              sessionId: 'running',
              update: {
                sessionUpdate: 'tool_call',
                toolCallId: 'tool-1',
                title: 'ReadFile',
                rawInput: { path: 'package.json' },
              },
            },
            {
              sessionId: 'running',
              update: {
                sessionUpdate: 'tool_call_update',
                toolCallId: 'tool-1',
                status: 'completed',
                rawOutput: 'file contents',
              },
            },
            {
              sessionId: 'running',
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: { type: 'text', text: 'partial answer' },
              },
            },
          ],
        }),
      },
    });

    const session = await provider.loadSession('acp:running');

    expect(session?.requests).toHaveLength(1);
    expect(session?.requests[0].response.isComplete).toBe(false);
    expect(session?.requests[0].response.responseContents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'reasoning', content: 'checking files' }),
        expect.objectContaining({
          kind: 'toolCall',
          content: expect.objectContaining({ id: 'tool-1', result: 'file contents', state: 'result' }),
        }),
        expect.objectContaining({ kind: 'markdownContent' }),
      ]),
    );
    expect(session?.history.messages[1]).toEqual(expect.objectContaining({ requestId: expect.any(String) }));
  });

  it('keeps an auth-required restored response open for later progress', () => {
    const provider = createSessionProvider();

    const session = provider.restoreSessionSnapshot('acp:auth-required', {
      kind: 'sessionSnapshot',
      sessionId: 'auth-required',
      threadStatus: 'auth_required',
      historyUpdates: [
        {
          sessionId: 'auth-required',
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text: 'continue after auth' },
          },
        },
        {
          sessionId: 'auth-required',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'waiting' },
          },
        },
      ],
    });

    expect(session.requests[0].response.isComplete).toBe(false);
  });

  it('restores an in-progress ACP tool call with a non-terminal state', () => {
    const provider = createSessionProvider();

    const session = provider.restoreSessionSnapshot('acp:tool-running', {
      kind: 'sessionSnapshot',
      sessionId: 'tool-running',
      threadStatus: 'working',
      historyUpdates: [
        {
          sessionId: 'tool-running',
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text: 'inspect files' },
          },
        },
        {
          sessionId: 'tool-running',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'tool-running-1',
            title: 'ReadFile',
            rawInput: { path: 'package.json' },
          },
        },
        {
          sessionId: 'tool-running',
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'tool-running-1',
            status: 'in_progress',
          },
        },
      ],
    });

    expect(session.requests[0].response.responseParts).toContainEqual(
      expect.objectContaining({
        kind: 'toolCall',
        content: expect.objectContaining({ id: 'tool-running-1', state: 'streaming' }),
      }),
    );
  });

  it('passes an explicit target only to ACP session creation', async () => {
    const service = createService();
    const createSession = jest.fn().mockResolvedValue({
      sessionId: 'acp:s1',
      history: { additional: {}, messages: [] },
      requests: [],
    });
    Object.defineProperty(service, 'mainProvider', {
      value: { createSession },
    });

    await service.startSession({ acpTarget: { agentId: 'agent-b', cwd: '/work/b' } });

    expect(createSession).toHaveBeenCalledWith({
      acpTarget: { agentId: 'agent-b', cwd: '/work/b' },
    });
  });

  it('uses the ACP session provider when agent mode becomes available after construction', async () => {
    const capabilities = { supportsAgentMode: false };
    const localCreateSession = jest.fn().mockResolvedValue({
      sessionId: 'local-session',
      history: { additional: {}, messages: [] },
      requests: [],
    });
    const acpCreateSession = jest.fn().mockResolvedValue({
      sessionId: 'acp:agent-session',
      history: { additional: {}, messages: [] },
      requests: [],
    });
    const localProvider = { canHandle: (mode: string) => mode === 'local', createSession: localCreateSession };
    const acpProvider = { canHandle: (mode: string) => mode === 'acp', createSession: acpCreateSession };
    const prototype = AcpChatManagerService.prototype as any;
    const originalAiNativeConfig = Object.getOwnPropertyDescriptor(prototype, 'aiNativeConfig');
    const originalSessionProviderRegistry = Object.getOwnPropertyDescriptor(prototype, 'sessionProviderRegistry');

    Object.defineProperty(prototype, 'aiNativeConfig', {
      configurable: true,
      get: () => ({ capabilities }),
    });
    Object.defineProperty(prototype, 'sessionProviderRegistry', {
      configurable: true,
      get: () => ({
        getAllProviders: () => [localProvider, acpProvider],
      }),
    });

    let service!: AcpChatManagerService;
    try {
      service = new AcpChatManagerService();
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
      value: { capabilities },
    });
    Object.defineProperty(service, 'chatFeatureRegistry', {
      value: new ChatFeatureRegistry(),
    });
    Object.defineProperty(service, 'listenSession', {
      value: jest.fn(),
    });
    Object.defineProperty(service, 'sessionProviderRegistry', {
      value: {
        getAllProviders: () => [localProvider, acpProvider],
      },
    });

    expect((service as any).mainProvider).toBe(localProvider);

    capabilities.supportsAgentMode = true;
    await service.startSession();

    expect(acpCreateSession).toHaveBeenCalledTimes(1);
    expect(localCreateSession).not.toHaveBeenCalled();
  });

  it('后端就绪失败切换到本地提供方后，新建会话不应自动切回 ACP', async () => {
    const service = createService();
    const acpCreateSession = jest.fn().mockResolvedValue({
      sessionId: 'acp:agent-session',
      history: { additional: {}, messages: [] },
      requests: [],
    });
    const localProvider = {
      canHandle: (mode: string) => mode === 'local',
      loadSessions: jest.fn().mockResolvedValue([]),
    };
    const acpProvider = {
      canHandle: (mode: string) => mode === 'acp',
      createSession: acpCreateSession,
      loadSessions: jest.fn().mockResolvedValue([]),
    };

    Object.defineProperty(service, 'mainProvider', {
      value: acpProvider,
      writable: true,
    });
    Object.defineProperty(service, 'sessionProviderRegistry', {
      value: {
        getProvider: (mode: string) => (mode === 'local' ? localProvider : undefined),
        getAllProviders: () => [localProvider, acpProvider],
      },
    });

    service.fallbackToLocal();
    const session = await service.startSession();

    expect(session.sessionId).not.toMatch(/^acp:/);
    expect(acpCreateSession).not.toHaveBeenCalled();
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

  it('keeps the first empty ACP session list result retryable before caching confirmed empty history', async () => {
    const provider = createSessionProvider();
    const listSessions = jest.fn().mockResolvedValue({ sessions: [] });
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        listSessions,
      },
    });

    await expect(provider.loadSessions()).resolves.toEqual([]);
    await expect(provider.loadSessions()).resolves.toEqual([]);
    await expect(provider.loadSessions()).resolves.toEqual([]);

    expect(listSessions).toHaveBeenCalledTimes(2);
  });

  it('reuses the in-flight ACP session list request', async () => {
    const provider = createSessionProvider();
    let resolveListSessions!: (value: any) => void;
    const listSessions = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveListSessions = resolve;
        }),
    );
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        listSessions,
      },
    });

    const first = provider.loadSessions();
    const second = provider.loadSessions();

    await Promise.resolve();

    expect(listSessions).toHaveBeenCalledTimes(1);

    resolveListSessions({
      sessions: [
        {
          sessionId: 's1',
          title: 'Session 1',
        },
      ],
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      [
        expect.objectContaining({
          sessionId: 'acp:s1',
          title: 'Session 1',
        }),
      ],
      [
        expect.objectContaining({
          sessionId: 'acp:s1',
          title: 'Session 1',
        }),
      ],
    ]);
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

  it('reattaches a loaded ACP session and applies snapshot status plus later output', async () => {
    const service = createService();
    const sessionId = 'acp:s-running';
    const attachment = new SumiReadableStream<any>();
    const attachSession = jest.fn().mockResolvedValue(attachment);
    Object.defineProperty(service, 'mainProvider', {
      value: {
        loadSession: jest.fn().mockResolvedValue({
          sessionId,
          history: {
            additional: {},
            messages: [
              {
                id: `${sessionId}-user`,
                role: ChatMessageRole.User,
                content: 'continue the task',
                order: 0,
                relationId: 'relation-1',
                agentId: 'Default_Chat_Agent',
                agentCommand: '',
                images: [],
              },
              {
                id: `${sessionId}-assistant`,
                role: ChatMessageRole.Assistant,
                content: '',
                order: 1,
                relationId: 'relation-1',
                requestId: 'request-1',
              },
            ],
          },
          requests: [
            {
              requestId: 'request-1',
              message: {
                prompt: 'continue the task',
                agentId: 'Default_Chat_Agent',
                command: '',
                images: [],
              },
              response: {
                isComplete: false,
                isCanceled: false,
                responseText: '',
                responseContents: [],
                responseParts: [],
                errorDetails: undefined,
                followups: undefined,
              },
            },
          ],
        }),
        attachSession,
      },
    });

    await service.loadSession(sessionId);
    attachment.emitData({
      kind: 'sessionSnapshot',
      sessionId: 's-running',
      threadStatus: 'working',
      historyUpdates: [],
    });
    attachment.emitData({ kind: 'content', content: 'continued output' });

    const model = service.getSession(sessionId)!;
    expect(attachSession).toHaveBeenCalledWith(sessionId);
    expect(model.threadStatus).toBe('working');
    expect(model.getRequest('request-1')?.response.responseText).toBe('continued output');
    attachment.end();
  });

  it('keeps restored ACP history when attachment fails and retries attachment on a later selection', async () => {
    const service = createService();
    const sessionId = 'acp:s-attach-failure';
    const loadSession = jest.fn().mockResolvedValue({
      sessionId,
      history: {
        additional: {},
        messages: [
          {
            id: `${sessionId}-user`,
            role: ChatMessageRole.User,
            content: 'restore this history once',
            order: 0,
          },
        ],
      },
      requests: [],
    });
    const attachSession = jest
      .fn()
      .mockImplementationOnce(() => {
        expect(service.getSession(sessionId)?.history.getMessages()).toEqual([
          expect.objectContaining({ content: 'restore this history once' }),
        ]);
        return Promise.reject(new Error('attachment transport unavailable'));
      })
      .mockResolvedValueOnce(undefined);
    Object.defineProperty(service, 'mainProvider', {
      value: { loadSession, attachSession },
    });

    await expect(service.loadSession(sessionId)).resolves.toBeUndefined();

    const restoredModel = service.getSession(sessionId);
    expect(restoredModel).toBeDefined();
    expect(restoredModel?.history.getMessages()).toEqual([
      expect.objectContaining({ content: 'restore this history once' }),
    ]);
    expect(restoredModel?.requests).toHaveLength(0);
    expect(loadSession).toHaveBeenCalledTimes(1);
    expect(attachSession).toHaveBeenCalledTimes(1);
    expect((service as any).logger.error).toHaveBeenCalledWith(
      '[ACP Chat][Manager] attach session failed after restoring history — errorType=Error',
    );

    await service.loadSession(sessionId);

    expect(loadSession).toHaveBeenCalledTimes(1);
    expect(attachSession).toHaveBeenCalledTimes(2);
    expect(service.getSession(sessionId)?.history.getMessages()).toEqual([
      expect.objectContaining({ content: 'restore this history once' }),
    ]);
    expect(service.getSession(sessionId)?.requests).toHaveLength(0);
  });

  it('propagates queued attachment snapshot restoration failures', async () => {
    const service = createService();
    const sessionId = 'acp:s-snapshot-failure';
    const restoreError = new Error('snapshot conversion failed');
    const queuedSnapshot = {
      kind: 'sessionSnapshot',
      sessionId: 's-snapshot-failure',
      threadStatus: 'working',
      historyUpdates: [],
    };
    const attachment = {
      onData: jest.fn((listener) => {
        listener(queuedSnapshot);
        return { dispose: jest.fn() };
      }),
      onEnd: jest.fn(() => ({ dispose: jest.fn() })),
      onError: jest.fn(() => ({ dispose: jest.fn() })),
      end: jest.fn(),
    };
    Object.defineProperty(service, 'mainProvider', {
      value: {
        attachSession: jest.fn().mockResolvedValue(attachment),
        restoreSessionSnapshot: jest.fn(() => {
          throw restoreError;
        }),
      },
    });

    await expect(service.loadSession(sessionId)).rejects.toBe(restoreError);
    expect((service as any).logger.error).not.toHaveBeenCalled();
  });

  it('reattaches an already populated ACP session without reloading or resending its prompt', async () => {
    const service = createService();
    const provider = createSessionProvider();
    const sessionId = 'acp:s-existing';
    const attachment = new SumiReadableStream<any>();
    const attachSession = jest.fn().mockResolvedValue(attachment);
    const loadSession = jest.fn();
    const [existingModel] = service.fromAcpJSON([
      {
        sessionId,
        history: {
          additional: {},
          messages: [
            {
              id: `${sessionId}-user`,
              role: ChatMessageRole.User,
              content: 'keep working',
              order: 0,
            },
          ],
        },
        requests: [
          {
            requestId: 'request-existing',
            message: {
              prompt: 'keep working',
              agentId: 'Default_Chat_Agent',
              command: '',
              images: [],
            },
            response: {
              isComplete: false,
              isCanceled: false,
              responseText: 'before reload',
              responseContents: [{ kind: 'markdownContent', content: { value: 'before reload' } }],
              responseParts: [{ kind: 'markdownContent', content: { value: 'before reload' } }],
            },
          },
        ],
      },
    ]);
    service.sessionModels.set(sessionId, existingModel);
    Object.defineProperty(service, 'mainProvider', {
      value: {
        loadSession,
        attachSession,
        restoreSessionSnapshot: provider.restoreSessionSnapshot.bind(provider),
      },
    });

    await service.loadSession(sessionId);
    attachment.emitData({
      kind: 'sessionSnapshot',
      sessionId: 's-existing',
      threadStatus: 'working',
      historyUpdates: [
        {
          sessionId: 's-existing',
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text: 'keep working' },
          },
        },
        {
          sessionId: 's-existing',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'before reload while offline' },
          },
        },
      ],
    });
    attachment.emitData({ kind: 'content', content: ' after reload' });

    expect(loadSession).not.toHaveBeenCalled();
    expect(attachSession).toHaveBeenCalledWith(sessionId);
    expect(service.getSession(sessionId)?.requests[0].response.responseText).toBe(
      'before reload while offline after reload',
    );
    attachment.end();
  });

  it('cancels a reattached working ACP session through the provider when no browser request token exists', () => {
    const { service } = createConstructedService();
    const sessionId = 'acp:s-reattached';
    const model = new ChatModel(new ChatFeatureRegistry(), { sessionId });
    const cancelSession = jest.fn().mockResolvedValue(undefined);
    model.setThreadStatus('working');
    (service as any).sessionModels.set(sessionId, model);
    (service as any).mainProvider = { cancelSession };

    expect(service.cancelRequest(sessionId)).toBe(true);
    expect(cancelSession).toHaveBeenCalledWith(sessionId);
  });

  it('normalizes the ACP session id when explicitly cancelling through the back service', async () => {
    const provider = createSessionProvider();
    const cancelSession = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(provider, 'aiBackService', {
      value: { cancelSession },
    });

    await provider.cancelSession('acp:s-reattached');

    expect(cancelSession).toHaveBeenCalledWith('s-reattached');
  });

  it('does not complete an auth-required attachment before later output arrives', async () => {
    const service = createService();
    const sessionId = 'acp:s-auth';
    const attachment = new SumiReadableStream<any>();
    const [model] = service.fromAcpJSON([
      {
        sessionId,
        history: {
          additional: {},
          messages: [{ id: 'user', role: ChatMessageRole.User, content: 'authenticate', order: 0 }],
        },
        requests: [
          {
            requestId: 'request-auth',
            message: { prompt: 'authenticate', agentId: 'Default_Chat_Agent', command: '', images: [] },
            response: {
              isComplete: false,
              isCanceled: false,
              responseText: '',
              responseContents: [],
              responseParts: [],
            },
          },
        ],
      },
    ]);
    service.sessionModels.set(sessionId, model);
    Object.defineProperty(service, 'mainProvider', {
      value: { attachSession: jest.fn().mockResolvedValue(attachment) },
    });

    await service.loadSession(sessionId);
    attachment.emitData({
      kind: 'sessionSnapshot',
      sessionId: 's-auth',
      threadStatus: 'auth_required',
      historyUpdates: [],
    });
    attachment.emitData({ kind: 'content', content: 'continued after auth' });

    expect(model.getRequest('request-auth')?.response.isComplete).toBe(false);
    expect(model.getRequest('request-auth')?.response.responseText).toBe('continued after auth');
    attachment.end();
  });

  it('preserves incomplete response state when serializing an ACP session', () => {
    const service = createService();
    const [model] = service.fromAcpJSON([
      {
        sessionId: 'acp:s-incomplete',
        history: { additional: {}, messages: [] },
        requests: [
          {
            requestId: 'request-incomplete',
            message: { prompt: 'continue', agentId: 'Default_Chat_Agent', command: '', images: [] },
            response: {
              isComplete: false,
              isCanceled: false,
              responseText: 'partial',
              responseContents: [],
              responseParts: [],
            },
          },
        ],
      },
    ]);

    expect(service.toSessionData(model).requests[0].response.isComplete).toBe(false);
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

  it('applies ACP available command updates and emits a change event', () => {
    const { service } = createConstructedService();
    const model = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:sess-1',
    });
    const availableCommands = [{ name: 'help', description: 'Show help' }];
    const changes: any[] = [];

    (service as any).sessionModels.set(model.sessionId, model);
    service.onDidApplySessionState((event) => changes.push(event));

    service.applySessionStateUpdate('sess-1', {
      availableCommands,
    } as any);

    expect(service.getAvailableCommands()).toEqual(availableCommands);
    expect(changes).toEqual([
      expect.objectContaining({
        sessionId: 'acp:sess-1',
        model,
      }),
    ]);
  });
});
