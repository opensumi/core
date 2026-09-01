import { ChatMessageRole, Deferred, Emitter } from '@opensumi/ide-core-common';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { ACPSessionProvider } from '../../../src/browser/chat/acp-session-provider';
import { AcpChatManagerService } from '../../../src/browser/chat/chat-manager.service.acp';
import { ChatModel } from '../../../src/browser/chat/chat-model';
import { ChatFeatureRegistry } from '../../../src/browser/chat/chat.feature.registry';
import * as agentTypeModule from '../../../src/browser/chat/get-default-agent-type';

describe('AcpChatManagerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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
    Object.defineProperty(service, 'agentSessionCatalog', {
      value: [],
      writable: true,
    });
    Object.defineProperty(service, 'metadataOnlySessionIds', {
      value: new Set(),
      writable: true,
    });
    Object.defineProperty(service, 'agentSessionMetadataRevision', {
      value: 0,
      writable: true,
    });
    Object.defineProperty(service, 'agentSessionMetadataUpdates', {
      value: new Map(),
    });
    Object.defineProperty(service, 'onDidChangeAgentSessionCatalogEmitter', {
      value: new Emitter(),
    });
    Object.defineProperty(service, 'onDidChangeAgentSessionCatalog', {
      value: (service as any).onDidChangeAgentSessionCatalogEmitter.event,
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
      agentSessionCatalog: any[];
      agentSessionTargets: Map<string, any>;
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
    Object.defineProperty(provider, 'agentSessionCatalog', {
      value: [],
      writable: true,
    });
    Object.defineProperty(provider, 'agentSessionTargets', {
      value: new Map(),
      writable: true,
    });
    Object.defineProperty(provider, 'logger', {
      value: { warn: jest.fn() },
    });
    Object.defineProperty(provider, 'preferenceService', {
      value: { get: jest.fn() },
    });
    Object.defineProperty(provider, 'agenticTaskRegistry', {
      configurable: true,
      value: {
        listProjects: jest.fn().mockResolvedValue([]),
        getTask: jest.fn().mockResolvedValue(undefined),
      },
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

  it('builds the Agent session catalog from every Agent and known Project, discarding a failed Agent', async () => {
    const provider = createSessionProvider() as any;
    jest.spyOn(agentTypeModule, 'getAvailableAgentConfigs').mockReturnValue({
      'agent-a': { command: 'agent-a', args: [] },
      'agent-b': { command: 'agent-b', args: [] },
    });
    provider.agenticTaskRegistry.listProjects.mockResolvedValue([
      { id: 'a', workspacePath: '/work/a', availability: 'available' },
      { id: 'b', workspacePath: '/work/b', availability: 'available' },
      { id: 'hidden', workspacePath: '/work/hidden', availability: 'unavailable' },
    ]);
    provider.configProvider.resolveConfigForTarget = jest.fn(async ({ agentId, cwd }) => ({
      agentId,
      cwd,
      env: { ACP_SESSION_TEST_SECRET: 'never-log-this' },
    }));
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        listSessions: jest.fn(async ({ agentId, cwd }) => {
          if (agentId === 'agent-b' && cwd === '/work/b') {
            throw new Error('agent-b list failed');
          }
          return {
            sessions: [
              {
                sessionId: `${agentId}-${cwd.slice(-1)}`,
                cwd,
                title: `${agentId} ${cwd}`,
                updatedAt: '2026-01-01',
              },
              { sessionId: 'unknown', cwd: '/not-authorized', title: 'Unknown' },
            ],
          };
        }),
      },
    });

    await expect(provider.refreshAgentSessions()).resolves.toEqual([
      expect.objectContaining({ sessionId: 'acp:agent-a-a', agentId: 'agent-a', cwd: '/work/a' }),
      expect.objectContaining({ sessionId: 'acp:agent-a-b', agentId: 'agent-a', cwd: '/work/b' }),
    ]);
    expect(provider.aiBackService.listSessions).toHaveBeenCalledTimes(4);
    expect(provider.messageService.error).not.toHaveBeenCalled();
    expect(provider.logger.warn).toHaveBeenCalledWith(expect.stringContaining('agentId=agent-b'));
    expect(provider.logger.warn.mock.calls.flat().join('\n')).not.toContain('never-log-this');
    expect(provider.getAgentSessions()).toHaveLength(2);
  });

  it('runs a follow-up discovery when a refresh is requested during an in-flight stale snapshot', async () => {
    const provider = createSessionProvider() as any;
    const firstList = new Deferred<any>();
    jest.spyOn(agentTypeModule, 'getAvailableAgentConfigs').mockReturnValue({
      'agent-a': { command: 'agent-a', args: [] },
    });
    provider.agenticTaskRegistry.listProjects
      .mockResolvedValueOnce([{ id: 'old', workspacePath: '/work/old', availability: 'available' }])
      .mockResolvedValueOnce([{ id: 'new', workspacePath: '/work/new', availability: 'available' }]);
    provider.configProvider.resolveConfigForTarget = jest.fn(async ({ agentId, cwd }) => ({ agentId, cwd }));
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        listSessions: jest
          .fn()
          .mockImplementationOnce(() => firstList.promise)
          .mockResolvedValueOnce({
            sessions: [{ sessionId: 'new-session', cwd: '/work/new', title: 'New Session' }],
          }),
      },
    });

    const initialRefresh = provider.refreshAgentSessions();
    await Promise.resolve();
    const overlappingRefresh = provider.refreshAgentSessions();
    firstList.resolve({
      sessions: [{ sessionId: 'old-session', cwd: '/work/old', title: 'Old Session' }],
    });

    await expect(initialRefresh).resolves.toEqual([
      expect.objectContaining({ sessionId: 'acp:new-session', cwd: '/work/new' }),
    ]);
    await expect(overlappingRefresh).resolves.toEqual([
      expect.objectContaining({ sessionId: 'acp:new-session', cwd: '/work/new' }),
    ]);
    expect(provider.agenticTaskRegistry.listProjects).toHaveBeenCalledTimes(2);
    expect(provider.aiBackService.listSessions).toHaveBeenCalledTimes(2);
    expect(provider.getAgentSessions()).toEqual([
      expect.objectContaining({ sessionId: 'acp:new-session', cwd: '/work/new' }),
    ]);
  });

  it('excludes a raw Session ID returned by more than one Agent instead of guessing its route', async () => {
    const provider = createSessionProvider() as any;
    jest.spyOn(agentTypeModule, 'getAvailableAgentConfigs').mockReturnValue({
      'agent-a': { command: 'agent-a', args: [] },
      'agent-b': { command: 'agent-b', args: [] },
    });
    provider.agenticTaskRegistry.listProjects.mockResolvedValue([
      { id: 'a', workspacePath: '/work/a', availability: 'available' },
    ]);
    provider.configProvider.resolveConfigForTarget = jest.fn(async ({ agentId, cwd }) => ({ agentId, cwd }));
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        listSessions: jest.fn(async ({ agentId, cwd }) => ({
          sessions: [
            { sessionId: 'collision', cwd, title: `${agentId} collision` },
            { sessionId: `${agentId}-unique`, cwd, title: `${agentId} unique` },
          ],
        })),
      },
    });

    await expect(provider.refreshAgentSessions()).resolves.toEqual([
      expect.objectContaining({ sessionId: 'acp:agent-a-unique', agentId: 'agent-a' }),
      expect.objectContaining({ sessionId: 'acp:agent-b-unique', agentId: 'agent-b' }),
    ]);
    expect(provider.getAgentSessions().map((entry) => entry.sessionId)).not.toContain('acp:collision');
    expect(provider.agentSessionTargets.has('acp:collision')).toBe(false);
    expect(provider.logger.warn).toHaveBeenCalledWith(expect.stringContaining('agentCount=2'));
  });

  it('queries only available absolute Workspace Targets and ignores relative Agent metadata', async () => {
    const provider = createSessionProvider() as any;
    jest.spyOn(agentTypeModule, 'getAvailableAgentConfigs').mockReturnValue({
      'agent-a': { command: 'agent-a', args: [] },
    });
    provider.agenticTaskRegistry.listProjects.mockResolvedValue([
      { id: 'relative', workspacePath: 'relative/path', availability: 'available' },
      { id: 'available', workspacePath: '/work/a', availability: 'available' },
      { id: 'unavailable', workspacePath: '/work/b', availability: 'unavailable' },
    ]);
    provider.configProvider.resolveConfigForTarget = jest.fn(async ({ agentId, cwd }) => ({ agentId, cwd }));
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        listSessions: jest.fn().mockResolvedValue({
          sessions: [
            { sessionId: 'relative-result', cwd: 'relative/path', title: 'Relative' },
            { sessionId: 'authorized-result', cwd: '/work/a', title: 'Authorized' },
          ],
        }),
      },
    });

    await expect(provider.refreshAgentSessions()).resolves.toEqual([
      expect.objectContaining({ sessionId: 'acp:authorized-result', cwd: '/work/a' }),
    ]);
    expect(provider.configProvider.resolveConfigForTarget).toHaveBeenCalledTimes(1);
    expect(provider.configProvider.resolveConfigForTarget).toHaveBeenCalledWith({ agentId: 'agent-a', cwd: '/work/a' });
  });

  it('loads an Agent-listed session through the Agent and cwd returned by session/list', async () => {
    const provider = createSessionProvider() as any;
    provider.agentSessionTargets.set('acp:s1', { agentId: 'agent-b', cwd: '/work/b' });
    provider.configProvider.resolveConfigForTarget = jest.fn(async (target) => ({ ...target }));
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        loadAgentSession: jest.fn().mockResolvedValue({ sessionId: 's1', messages: [] }),
      },
    });

    const session = await provider.loadSession('acp:s1');

    expect(provider.configProvider.resolveConfigForTarget).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' });
    expect(provider.aiBackService.loadAgentSession).toHaveBeenCalledWith({ agentId: 'agent-b', cwd: '/work/b' }, 's1');
    expect(session.extension).toEqual(
      expect.objectContaining({ acpTarget: { agentId: 'agent-b', cwd: '/work/b' }, metadataOnly: false }),
    );
  });

  it('logs the complete Agent history update list before converting a loaded session', async () => {
    const provider = createSessionProvider() as any;
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const historyUpdates = [
      {
        sessionId: 's1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: 'first prompt' },
        },
      },
    ];
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        loadAgentSession: jest.fn().mockResolvedValue({ sessionId: 's1', messages: [], historyUpdates }),
      },
    });

    await provider.loadSession('acp:s1');

    expect(consoleLog).toHaveBeenCalledWith('[ACP Chat][session/load] Agent history updates:', historyUpdates);
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

  it('force disposes an ACP provider session using its raw backend session id', async () => {
    const provider = createSessionProvider();
    const disposeSession = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(provider, 'aiBackService', {
      value: { disposeSession },
    });

    await provider.disposeSession('acp:s1', true);

    expect(disposeSession).toHaveBeenCalledWith('s1', true);
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

  it('force releases a restored backend session that is not browser-owned', async () => {
    const service = createService() as any;
    service.mainProvider = {
      disposeSession: jest.fn().mockResolvedValue(undefined),
    };
    service.clearSession = jest.fn();
    service.getSession = jest.fn(() => ({}));

    await service.disposeSession('acp:restored', true);

    expect(service.mainProvider.disposeSession).toHaveBeenCalledWith('acp:restored', true);
    expect(service.clearSession).toHaveBeenCalledWith('acp:restored');
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

  it('does not use a legacy Task record to route an unlisted ACP session', async () => {
    const provider = createSessionProvider();
    const config = { agentId: 'claude-agent-acp', cwd: '/workspace' };
    const loadAgentSession = jest.fn().mockResolvedValue({
      sessionId: 'b',
      messages: [],
    });
    const getTask = jest.fn().mockResolvedValue({
      sessionId: 'acp:b',
      projectId: 'project-b',
      agentId: 'agent-b',
    });
    Object.defineProperty(provider, 'agenticTaskRegistry', {
      value: {
        getTask,
        getProject: jest.fn().mockResolvedValue({ id: 'project-b', workspacePath: '/work/b' }),
      },
    });
    Object.defineProperty(provider, 'aiBackService', {
      value: { loadAgentSession },
    });

    await provider.loadSession('acp:b');

    expect(getTask).not.toHaveBeenCalled();
    expect((provider as any).configProvider.resolveConfig).toHaveBeenCalledTimes(1);
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

  it('preserves messageId boundaries without creating an empty user message during history restore', async () => {
    const provider = createSessionProvider();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    Object.defineProperty(provider, 'aiBackService', {
      value: {
        loadAgentSession: jest.fn().mockResolvedValue({
          sessionId: 'message-boundaries',
          messages: [],
          historyUpdates: [
            {
              sessionId: 'message-boundaries',
              update: {
                sessionUpdate: 'agent_message_chunk',
                messageId: 'assistant-greeting',
                content: { type: 'text', text: 'How can I help?' },
              },
            },
            {
              sessionId: 'message-boundaries',
              update: {
                sessionUpdate: 'user_message_chunk',
                messageId: 'user-1',
                content: { type: 'text', text: 'hello' },
              },
            },
            {
              sessionId: 'message-boundaries',
              update: {
                sessionUpdate: 'agent_message_chunk',
                messageId: 'assistant-1',
                content: { type: 'text', text: 'first response' },
              },
            },
            {
              sessionId: 'message-boundaries',
              update: {
                sessionUpdate: 'agent_message_chunk',
                messageId: 'assistant-2',
                content: { type: 'text', text: 'second response' },
              },
            },
          ],
        }),
      },
    });

    const session = await provider.loadSession('acp:message-boundaries');

    expect(session?.history.messages.map(({ role, content }) => ({ role, content }))).toEqual([
      { role: ChatMessageRole.Assistant, content: 'How can I help?' },
      { role: ChatMessageRole.User, content: 'hello' },
      { role: ChatMessageRole.Assistant, content: 'first response' },
      { role: ChatMessageRole.Assistant, content: 'second response' },
    ]);
  });

  it.each(['auth_required', 'stopping'] as const)('keeps a %s restored response open for later progress', (status) => {
    const provider = createSessionProvider();
    const sessionId = `acp:${status}`;

    const session = provider.restoreSessionSnapshot(sessionId, {
      kind: 'sessionSnapshot',
      sessionId: status,
      threadStatus: status,
      historyUpdates: [
        {
          sessionId: status,
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text: 'continue after pending state' },
          },
        },
        {
          sessionId: status,
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

  it('preserves the ACP target when a loaded session snapshot omits runtime routing metadata', async () => {
    const service = createService();
    const sessionId = 'acp:targeted-session';
    const acpTarget = { agentId: 'agent-b', cwd: '/work/b' };
    const metadataModel = service.fromAcpJSON([
      {
        sessionId,
        history: {
          additional: {},
          messages: [],
        },
        requests: [],
        extension: {
          availableCommands: [],
          acpTarget,
        },
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
                content: 'continue in the original project',
                order: 0,
              },
            ],
          },
          requests: [],
        }),
      },
    });

    await service.loadSession(sessionId);

    expect(service.getSession(sessionId)).not.toBe(metadataModel);
    expect(service.getSession(sessionId)?.acpTarget).toEqual(acpTarget);
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
      availableCommands: [{ name: 'new-skill', description: 'Run the new skill' }],
    });
    attachment.emitData({ kind: 'content', content: 'continued output' });

    const model = service.getSession(sessionId)!;
    expect(attachSession).toHaveBeenCalledWith(sessionId);
    expect(model.threadStatus).toBe('working');
    expect(service.getAvailableCommands(sessionId)).toEqual([{ name: 'new-skill', description: 'Run the new skill' }]);
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
      extension: {
        availableCommands: [{ name: 'restored-skill', description: 'Restored skill' }],
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

    const firstLoad = await service.loadSession(sessionId);
    await expect(firstLoad.liveReady).resolves.toBe('failed');

    const restoredModel = service.getSession(sessionId);
    expect(restoredModel).toBeDefined();
    expect(restoredModel?.history.getMessages()).toEqual([
      expect.objectContaining({ content: 'restore this history once' }),
    ]);
    expect(restoredModel?.requests).toHaveLength(0);
    expect(service.getAvailableCommands(sessionId)).toEqual([
      { name: 'restored-skill', description: 'Restored skill' },
    ]);
    expect(loadSession).toHaveBeenCalledTimes(1);
    expect(attachSession).toHaveBeenCalledTimes(1);
    expect((service as any).logger.error).toHaveBeenCalledWith(
      '[ACP Chat][Manager] attach session failed after restoring history — errorType=Error',
    );

    const secondLoad = await service.loadSession(sessionId);
    await expect(secondLoad.liveReady).resolves.toBe('ready');

    expect(loadSession).toHaveBeenCalledTimes(1);
    expect(attachSession).toHaveBeenCalledTimes(2);
    expect(service.getSession(sessionId)?.history.getMessages()).toEqual([
      expect.objectContaining({ content: 'restore this history once' }),
    ]);
    expect(service.getSession(sessionId)?.requests).toHaveLength(0);
  });

  it('makes a restored transcript available without waiting for Live Ready attachment', async () => {
    const service = createService();
    const sessionId = 'acp:transcript-ready';
    let resolveAttachment: (stream: undefined) => void;
    const attachment = new Promise<undefined>((resolve) => {
      resolveAttachment = resolve;
    });
    const attachSession = jest.fn(() => attachment);
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
                content: 'Transcript Ready content',
                order: 0,
              },
            ],
          },
          requests: [],
        }),
        attachSession,
      },
    });

    const loading = service.loadSession(sessionId);
    const outcome = await Promise.race([
      loading.then(() => 'transcript-ready' as const),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 0)),
    ]);

    expect(outcome).toBe('transcript-ready');
    expect(service.getSession(sessionId)?.history.getMessages()).toEqual([
      expect.objectContaining({ content: 'Transcript Ready content' }),
    ]);
    expect(attachSession).toHaveBeenCalledWith(sessionId);

    resolveAttachment!(undefined);
    const result = await loading;
    await expect(result.liveReady).resolves.toBe('ready');
  });

  it('does not attach a stale Live Ready stream after the transcript session was disposed', async () => {
    const service = createService();
    const sessionModels = (service as any).sessionModels;
    jest.spyOn(service, 'clearSession').mockImplementation((key: string) => {
      sessionModels.delete(key);
    });
    const sessionId = 'acp:disposed-before-live-ready';
    let resolveAttachment!: (stream: any) => void;
    const pendingAttachment = new Promise<any>((resolve) => {
      resolveAttachment = resolve;
    });
    const attachment = {
      onData: jest.fn(() => ({ dispose: jest.fn() })),
      onEnd: jest.fn(() => ({ dispose: jest.fn() })),
      onError: jest.fn(() => ({ dispose: jest.fn() })),
      end: jest.fn(),
    };
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
                content: 'dispose after Transcript Ready',
                order: 0,
              },
            ],
          },
          requests: [],
        }),
        attachSession: jest.fn(() => pendingAttachment),
        disposeSession: jest.fn().mockResolvedValue(undefined),
      },
    });

    const result = await service.loadSession(sessionId);
    await service.disposeSession(sessionId);
    resolveAttachment(attachment);

    await expect(result.liveReady).resolves.toBe('failed');
    expect(attachment.end).toHaveBeenCalledTimes(1);
    expect(service.getSession(sessionId)).toBeUndefined();
  });

  it('reports queued attachment snapshot restoration failures through Live Ready', async () => {
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
        loadSession: jest.fn().mockResolvedValue({
          sessionId,
          history: {
            additional: {},
            messages: [
              {
                id: `${sessionId}-user`,
                role: ChatMessageRole.User,
                content: 'restore before applying queued snapshot',
                order: 0,
              },
            ],
          },
          requests: [],
        }),
        attachSession: jest.fn().mockResolvedValue(attachment),
        restoreSessionSnapshot: jest.fn(() => {
          throw restoreError;
        }),
      },
    });

    const result = await service.loadSession(sessionId);

    await expect(result.liveReady).resolves.toBe('failed');
    expect((service as any).logger.error).toHaveBeenCalledWith(
      '[ACP Chat][Manager] attach session failed after restoring history — errorType=Error',
    );
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
    expect(service.getSession(sessionId)?.history.getMessages()).toEqual([
      expect.objectContaining({ role: ChatMessageRole.User, content: 'keep working' }),
      expect.objectContaining({ role: ChatMessageRole.Assistant, content: 'before reload while offline' }),
    ]);
    attachment.end();
  });

  it('keeps restored user turns attached to their Agent message identities when a snapshot adds a greeting', async () => {
    const service = createService();
    const provider = createSessionProvider();
    const sessionId = 'acp:stable-message-identities';
    const attachment = new SumiReadableStream<any>();
    const initialSession = provider.restoreSessionSnapshot(sessionId, {
      kind: 'sessionSnapshot',
      sessionId: 'stable-message-identities',
      threadStatus: 'idle',
      historyUpdates: [
        {
          sessionId: 'stable-message-identities',
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'assistant-greeting',
            content: { type: 'text', text: 'How can I help?' },
          },
        },
        {
          sessionId: 'stable-message-identities',
          update: {
            sessionUpdate: 'user_message_chunk',
            messageId: 'user-1',
            content: { type: 'text', text: 'first prompt' },
          },
        },
        {
          sessionId: 'stable-message-identities',
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'assistant-1',
            content: { type: 'text', text: 'first response' },
          },
        },
        {
          sessionId: 'stable-message-identities',
          update: {
            sessionUpdate: 'user_message_chunk',
            messageId: 'user-2',
            content: { type: 'text', text: 'second prompt' },
          },
        },
        {
          sessionId: 'stable-message-identities',
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'assistant-2',
            content: { type: 'text', text: 'second response' },
          },
        },
      ],
    });
    Object.defineProperty(service, 'mainProvider', {
      value: {
        loadSession: jest.fn().mockResolvedValue(initialSession),
        attachSession: jest.fn().mockResolvedValue(attachment),
        restoreSessionSnapshot: provider.restoreSessionSnapshot.bind(provider),
      },
    });

    const result = await service.loadSession(sessionId);
    await expect(result.liveReady).resolves.toBe('ready');
    attachment.emitData({
      kind: 'sessionSnapshot',
      sessionId: 'stable-message-identities',
      threadStatus: 'idle',
      historyUpdates: [
        {
          sessionId: 'stable-message-identities',
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'assistant-new-greeting',
            content: { type: 'text', text: 'New greeting' },
          },
        },
        {
          sessionId: 'stable-message-identities',
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'assistant-greeting',
            content: { type: 'text', text: 'How can I help?' },
          },
        },
        {
          sessionId: 'stable-message-identities',
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'assistant-1',
            content: { type: 'text', text: 'first response' },
          },
        },
        {
          sessionId: 'stable-message-identities',
          update: {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'assistant-2',
            content: { type: 'text', text: 'second response' },
          },
        },
      ],
    });

    expect(
      service
        .getSession(sessionId)
        ?.history.getMessages()
        .map(({ role, content }) => ({ role, content })),
    ).toEqual([
      { role: ChatMessageRole.Assistant, content: 'New greeting' },
      { role: ChatMessageRole.Assistant, content: 'How can I help?' },
      { role: ChatMessageRole.User, content: 'first prompt' },
      { role: ChatMessageRole.Assistant, content: 'first response' },
      { role: ChatMessageRole.User, content: 'second prompt' },
      { role: ChatMessageRole.Assistant, content: 'second response' },
    ]);
    expect(service.getSession(sessionId)?.requests.map((request) => request.message.prompt)).toEqual([
      '',
      '',
      'first prompt',
      'second prompt',
    ]);
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

  it('does not send duplicate cancellation for a stopping ACP session', () => {
    const { service } = createConstructedService();
    const sessionId = 'acp:s-stopping';
    const model = new ChatModel(new ChatFeatureRegistry(), { sessionId });
    const cancelSession = jest.fn().mockResolvedValue(undefined);
    model.setThreadStatus('stopping');
    (service as any).sessionModels.set(sessionId, model);
    (service as any).mainProvider = { cancelSession };

    expect(service.cancelRequest(sessionId)).toBe(false);
    expect(cancelSession).not.toHaveBeenCalled();
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

  it('keeps a listed session metadata update when an older catalog refresh completes', async () => {
    const service = createService() as any;
    let resolveRefresh!: (sessions: any[]) => void;
    service.mainProvider = {
      refreshAgentSessions: jest.fn(
        () =>
          new Promise<any[]>((resolve) => {
            resolveRefresh = resolve;
          }),
      ),
    };
    service.agentSessionCatalog = [
      {
        sessionId: 'acp:one',
        agentId: 'agent-a',
        cwd: '/workspace',
        title: 'Before',
        updatedAt: '2026-08-20T00:00:00.000Z',
      },
    ];
    const catalogChanges: any[] = [];
    service.onDidChangeAgentSessionCatalog((catalog: any[]) => catalogChanges.push(catalog));

    const refresh = service.refreshAgentSessionCatalog();
    service.applySessionStateUpdate('one', {
      title: 'Live update',
    });
    service.applySessionStateUpdate('one', {
      updatedAt: '2026-08-20T01:00:00.000Z',
    });
    service.applySessionStateUpdate('not-listed', {
      title: 'Must not create a row',
    });
    resolveRefresh([
      {
        sessionId: 'acp:one',
        agentId: 'agent-a',
        cwd: '/workspace',
        title: 'Stale discovery title',
        updatedAt: '2026-08-20T00:30:00.000Z',
      },
    ]);

    await refresh;

    expect(service.getAgentSessionCatalog()).toEqual([
      expect.objectContaining({
        sessionId: 'acp:one',
        title: 'Live update',
        updatedAt: '2026-08-20T01:00:00.000Z',
      }),
    ]);
    expect(catalogChanges).toHaveLength(3);
  });

  it('keeps a loaded session when a catalog refresh omits it', async () => {
    const service = createService() as any;
    const loadedSession = new ChatModel(new ChatFeatureRegistry(), {
      sessionId: 'acp:active',
      title: 'Active conversation',
    });
    service.sessionModels.set(loadedSession.sessionId, loadedSession);
    service.mainProvider = {
      refreshAgentSessions: jest.fn().mockResolvedValue([]),
    };

    await service.refreshAgentSessionCatalog();

    expect(service.getAgentSessionCatalog()).toEqual([]);
    expect(service.getSession('acp:active')).toBe(loadedSession);
  });

  it('uses an early Agent metadata title when the live model is created after the update', () => {
    const service = createService() as any;

    service.applySessionStateUpdate('new', { title: 'Agent-owned title' });
    const [model] = service.fromAcpJSON([
      {
        sessionId: 'acp:new',
        createdAt: 1,
        title: 'Local prompt title',
        history: { additional: {}, messages: [] },
        requests: [],
      },
    ]);

    expect(model.title).toBe('Agent-owned title');
    expect(service.getAgentSessionCatalog()).toEqual([]);
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

    expect(service.getAvailableCommands(model.sessionId)).toEqual(availableCommands);
    expect(changes).toEqual([
      expect.objectContaining({
        sessionId: 'acp:sess-1',
        model,
      }),
    ]);
  });

  it('keeps available command catalogs isolated by ACP session', () => {
    const { service } = createConstructedService();
    const firstSession = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:first' });
    const secondSession = new ChatModel(new ChatFeatureRegistry(), { sessionId: 'acp:second' });
    (service as any).sessionModels.set(firstSession.sessionId, firstSession);
    (service as any).sessionModels.set(secondSession.sessionId, secondSession);

    service.applySessionStateUpdate('first', {
      availableCommands: [{ name: 'first-skill', description: 'First session skill' }],
    } as any);
    service.applySessionStateUpdate('second', {
      availableCommands: [{ name: 'second-skill', description: 'Second session skill' }],
    } as any);

    expect(service.getAvailableCommands(firstSession.sessionId)).toEqual([
      { name: 'first-skill', description: 'First session skill' },
    ]);
    expect(service.getAvailableCommands(secondSession.sessionId)).toEqual([
      { name: 'second-skill', description: 'Second session skill' },
    ]);
  });
});
