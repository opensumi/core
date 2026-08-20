jest.mock('@opensumi/di', () => {
  const actual = jest.requireActual('@opensumi/di');
  const noopDecorator = () => () => {};
  return {
    ...actual,
    Injectable: () => (cls: any) => cls,
    Autowired: noopDecorator,
    Inject: noopDecorator,
    Optional: noopDecorator,
  };
});

import { ACP_SESSION_NOT_FOUND_ERROR_NAME, ACP_THREAD_POOL_SATURATED_ERROR_NAME } from '@opensumi/ide-core-common';
import { DEFAULT_ACP_THREAD_POOL_SIZE } from '@opensumi/ide-core-common/lib/settings/ai-native';
import { INodeLogger } from '@opensumi/ide-core-node';

import { AcpAgentLifecycleContribution } from '../../src/node';
import { AcpAgentService, AcpAgentServiceToken } from '../../src/node/acp/acp-agent.service';
import { AcpTerminalHandler, AcpTerminalHandlerToken } from '../../src/node/acp/handlers/terminal.handler';

// ---- Mock dependencies ----

const mockLogger: INodeLogger = {
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  warn: jest.fn(),
  critical: jest.fn(),
  dispose: jest.fn(),
  getLevel: jest.fn(),
  setLevel: jest.fn(),
} as unknown as INodeLogger;

const mockTerminalHandler = {
  releaseSessionTerminals: jest.fn().mockResolvedValue(undefined),
};

const mockAppConfig = {};

const mockPermissionRouting = {
  registerSession: jest.fn(),
  unregisterSession: jest.fn(),
  routePermissionRequest: jest.fn(),
  registeredSessions: new Map(),
};

const mockAgentProcessConfig = {
  agentId: 'test-agent',
  command: 'npx',
  args: ['@anthropic-ai/claude-code@latest'],
  cwd: '/test/workspace',
  env: [],
};

const SMALL_THREAD_POOL_SIZE = 3;

const mockAgentProcessConfigWithSmallPool = {
  ...mockAgentProcessConfig,
  threadPoolSize: SMALL_THREAD_POOL_SIZE,
};

// ---- Mock AcpThread factory ----

interface MockThread {
  threadId: string;
  sessionId: string;
  initialized: boolean;
  needsReset: boolean;
  initialize: jest.Mock;
  newSession: jest.Mock;
  loadSession: jest.Mock;
  loadSessionOrNew: jest.Mock;
  prompt: jest.Mock;
  cancel: jest.Mock;
  listSessions: jest.Mock;
  closeSession: jest.Mock;
  deleteSession: jest.Mock;
  agentCapabilities?: any;
  getEntries: jest.Mock;
  getSessionNotifications: jest.Mock;
  getSessionState: jest.Mock;
  getStatus: jest.Mock;
  setStatus: jest.Mock;
  setError: jest.Mock;
  handleNotification: jest.Mock;
  addUserMessage: jest.Mock;
  markAssistantComplete: jest.Mock;
  markToolCallWaiting: jest.Mock;
  respondToToolCall: jest.Mock;
  setSessionMode: jest.Mock;
  setSessionConfigOption: jest.Mock;
  unstable_setSessionModel: jest.Mock;
  reset: jest.Mock;
  dispose: jest.Mock;
  onEvent: jest.Mock;
  _fireEvent: (event: any) => void;
  _eventListeners: Array<(event: any) => void>;
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value?: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value?: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createMockThread(overrides: Record<string, any> = {}): MockThread {
  const eventListeners: Array<(event: any) => void> = [];
  const base: MockThread = {
    threadId: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: '',
    initialized: false,
    needsReset: false,
    initialize: jest.fn().mockResolvedValue({ protocolVersion: 1, agentCapabilities: {} }),
    newSession: jest.fn().mockResolvedValue({ sessionId: 'new-session-1' }),
    loadSession: jest.fn().mockResolvedValue({ sessionId: 'loaded-session-1' }),
    loadSessionOrNew: jest.fn().mockResolvedValue({ sessionId: 'new-session-1' }),
    prompt: jest.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    cancel: jest.fn().mockResolvedValue(undefined),
    listSessions: jest.fn().mockResolvedValue({ sessions: [] }),
    closeSession: jest.fn().mockResolvedValue(undefined),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    getEntries: jest.fn().mockReturnValue([]),
    getSessionNotifications: jest.fn().mockReturnValue([]),
    getSessionState: jest.fn().mockReturnValue({
      notifications: [],
      entries: [],
      modes: [],
    }),
    getStatus: jest.fn().mockReturnValue('idle'),
    setStatus: jest.fn(),
    setError: jest.fn(),
    handleNotification: jest.fn(),
    addUserMessage: jest.fn().mockReturnValue({ id: 'msg-1', content: '', timestamp: Date.now() }),
    markAssistantComplete: jest.fn(),
    markToolCallWaiting: jest.fn(),
    respondToToolCall: jest.fn(),
    setSessionMode: jest.fn().mockResolvedValue(undefined),
    setSessionConfigOption: jest.fn().mockResolvedValue(undefined),
    unstable_setSessionModel: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
    onEvent: jest.fn((cb: any) => {
      eventListeners.push(cb);
      return { dispose: jest.fn(() => {}) };
    }),
    _fireEvent(event: any) {
      eventListeners.forEach((cb) => cb(event));
    },
    _eventListeners: eventListeners,
  };
  return { ...base, ...overrides } as unknown as MockThread;
}

function setupServiceWithMockFactory(mockFactory: jest.Mock) {
  const service = new AcpAgentService();
  (service as any).threadFactory = mockFactory;
  (service as any).terminalHandler = mockTerminalHandler;
  (service as any).appConfig = mockAppConfig;
  (service as any).logger = mockLogger;
  (service as any).permissionRouting = mockPermissionRouting;
  return service;
}

function createService(): { service: AcpAgentService; mockFactory: jest.Mock; thread: MockThread } {
  const thread = createMockThread();
  const mockFactory = jest.fn().mockReturnValue(thread);
  const service = setupServiceWithMockFactory(mockFactory);
  return { service, mockFactory, thread };
}

// Helper that fires available_commands_update immediately
function createServiceWithAutoEvents(): { service: AcpAgentService; mockFactory: jest.Mock; thread: MockThread } {
  const eventListeners: Array<(event: any) => void> = [];
  const thread = createMockThread({
    onEvent: jest.fn((cb: any) => {
      eventListeners.push(cb);
      return { dispose: jest.fn(() => {}) };
    }),
    _fireEvent(event: any) {
      eventListeners.forEach((cb) => cb(event));
    },
    _eventListeners: eventListeners,
  });
  const mockFactory = jest.fn().mockReturnValue(thread);
  const service = setupServiceWithMockFactory(mockFactory);
  return { service, mockFactory, thread };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ============================================================================
// Tests
// ============================================================================

describe('AcpAgentService (Thread Pool)', () => {
  describe('Token', () => {
    it('should export AcpAgentServiceToken as a symbol', () => {
      expect(typeof AcpAgentServiceToken).toBe('symbol');
    });
  });

  describe('draft Session capabilities', () => {
    it('initializes and releases one compatible idle thread when reading close/delete capabilities', async () => {
      const thread = createMockThread({
        agentCapabilities: { sessionCapabilities: { close: {}, delete: {} } },
      });
      const service = setupServiceWithMockFactory(jest.fn(() => thread));

      await expect(service.getSessionCapabilities(mockAgentProcessConfig)).resolves.toEqual({
        close: true,
        delete: true,
      });

      expect(thread.initialize).toHaveBeenCalledWith(expect.objectContaining(mockAgentProcessConfig));
      expect((service as any).reservedThreads.has(thread)).toBe(false);
      expect((service as any).sessions.size).toBe(0);
    });

    it('routes standard Session deletion only through the active Session thread', async () => {
      const { service, thread } = createService();
      (service as any).sessions.set('draft-session', thread);

      await service.deleteSession({ sessionId: 'draft-session' });

      expect(thread.deleteSession).toHaveBeenCalledWith({ sessionId: 'draft-session' });
      await expect(service.deleteSession({ sessionId: 'missing-session' })).rejects.toThrow(
        'No active session for sessionId: missing-session',
      );
    });
  });

  describe('warmUpAgentPool()', () => {
    it('initializes one standby thread without creating sessions', async () => {
      const threads: MockThread[] = [];
      const mockFactory = jest.fn(() => {
        const thread = createMockThread();
        thread.initialize.mockImplementation(async () => {
          thread.initialized = true;
          return { protocolVersion: 1, agentCapabilities: {} };
        });
        threads.push(thread);
        return thread;
      });
      const service = setupServiceWithMockFactory(mockFactory);

      await service.warmUpAgentPool(mockAgentProcessConfigWithSmallPool);

      expect(mockFactory).toHaveBeenCalledTimes(1);
      expect(threads.every((thread) => thread.initialize.mock.calls.length === 1)).toBe(true);
      expect(threads.every((thread) => thread.newSession.mock.calls.length === 0)).toBe(true);
      expect((service as any).threadPool).toHaveLength(1);
      expect((service as any).sessions.size).toBe(0);
    });

    it('deduplicates concurrent and repeated warmups for the same runtime config', async () => {
      const initializeGate = createDeferred<any>();
      const threads: MockThread[] = [];
      const mockFactory = jest.fn(() => {
        const thread = createMockThread();
        thread.initialize.mockImplementation(async () => {
          await initializeGate.promise;
          thread.initialized = true;
          return { protocolVersion: 1, agentCapabilities: {} };
        });
        threads.push(thread);
        return thread;
      });
      const service = setupServiceWithMockFactory(mockFactory);

      const firstWarmup = service.warmUpAgentPool(mockAgentProcessConfigWithSmallPool);
      const secondWarmup = service.warmUpAgentPool(mockAgentProcessConfigWithSmallPool);
      expect(mockFactory).toHaveBeenCalledTimes(1);

      initializeGate.resolve({ protocolVersion: 1, agentCapabilities: {} });
      await Promise.all([firstWarmup, secondWarmup]);
      await service.warmUpAgentPool(mockAgentProcessConfigWithSmallPool);

      expect(mockFactory).toHaveBeenCalledTimes(1);
      expect(threads.every((thread) => thread.initialize.mock.calls.length === 1)).toBe(true);
    });

    it('cancels the obsolete standby and follows the latest runtime configuration', async () => {
      const initializeGate = createDeferred<any>();
      const obsoleteThread = createMockThread({ threadId: 'obsolete-standby' });
      obsoleteThread.initialize.mockImplementation(async () => {
        await initializeGate.promise;
        obsoleteThread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      obsoleteThread.dispose.mockImplementation(async () => {
        const cancellation = new Error('cancelled');
        cancellation.name = 'AcpThreadInitializationCancelledError';
        initializeGate.reject(cancellation);
      });
      const latestThread = createMockThread({ threadId: 'latest-standby' });
      latestThread.initialize.mockImplementation(async () => {
        latestThread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const mockFactory = jest.fn().mockReturnValueOnce(obsoleteThread).mockReturnValueOnce(latestThread);
      const service = setupServiceWithMockFactory(mockFactory);
      const configA = { ...mockAgentProcessConfigWithSmallPool, cwd: '/workspace-a' };
      const configB = { ...mockAgentProcessConfigWithSmallPool, cwd: '/workspace-b' };

      const warmupA = service.warmUpAgentPool(configA);
      const warmupB = service.warmUpAgentPool(configB);
      await flushAsyncWork();

      expect(obsoleteThread.dispose).toHaveBeenCalled();
      expect(mockFactory).toHaveBeenCalledTimes(2);
      expect(latestThread.initialize).toHaveBeenCalledTimes(1);
      expect((service as any).threadPool).toEqual([latestThread]);

      await Promise.all([warmupA, warmupB]);

      expect((service as any).threadPool).toEqual([latestThread]);
    });

    it('lets a session claim a warming thread without replenishing another standby', async () => {
      const initializeGate = createDeferred<any>();
      const thread = createMockThread();
      thread.initialize.mockImplementation(async () => {
        await initializeGate.promise;
        thread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      thread.newSession.mockImplementation(async () => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'new-session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
        return { sessionId: 'new-session-1' };
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));
      const oneThreadConfig = { ...mockAgentProcessConfig, threadPoolSize: 1 };

      const warmup = service.warmUpAgentPool(oneThreadConfig);
      const session = service.createSession(oneThreadConfig);
      await flushAsyncWork();

      expect(thread.initialize).toHaveBeenCalledTimes(1);
      initializeGate.resolve({ protocolVersion: 1, agentCapabilities: {} });
      await Promise.all([warmup, session]);
      await service.warmUpAgentPool(oneThreadConfig);

      expect(thread.initialize).toHaveBeenCalledTimes(1);
      expect(thread.newSession).toHaveBeenCalledTimes(1);
      expect((service as any).threadFactory).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('standby-warmup-claim'));
    });

    it('asynchronously replenishes a compatible standby after a session claims it', async () => {
      const standby = createMockThread({ threadId: 'claimed-standby' });
      standby.initialize.mockImplementation(async () => {
        standby.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      standby.newSession.mockImplementation(async () => {
        standby._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'claimed-session',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
        return { sessionId: 'claimed-session' };
      });
      const replacement = createMockThread({ threadId: 'replacement-standby' });
      replacement.initialize.mockImplementation(async () => {
        replacement.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const mockFactory = jest.fn().mockReturnValueOnce(standby).mockReturnValueOnce(replacement);
      const service = setupServiceWithMockFactory(mockFactory);
      const config = { ...mockAgentProcessConfig, threadPoolSize: 2 };

      await service.setStandbyTarget(config);
      const result = await service.createSession(config);
      await flushAsyncWork();

      expect(result.sessionId).toBe('claimed-session');
      expect(mockFactory).toHaveBeenCalledTimes(2);
      expect(replacement.initialize).toHaveBeenCalledTimes(1);
      expect((service as any).threadPool).toEqual([standby, replacement]);
      expect((service as any).sessions.get('claimed-session')).toBe(standby);
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('standby-hit'));
    });

    it('reclaims an incompatible process after its active session releases capacity', async () => {
      const activeThread = createMockThread({
        threadId: 'active-a',
        getStatus: jest.fn().mockReturnValue('awaiting_prompt'),
      });
      activeThread.initialize.mockImplementation(async () => {
        activeThread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      activeThread.newSession.mockImplementation(async () => {
        activeThread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-a',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
        return { sessionId: 'session-a' };
      });
      const standbyB = createMockThread({ threadId: 'standby-b' });
      standbyB.initialize.mockImplementation(async () => {
        standbyB.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const mockFactory = jest.fn().mockReturnValueOnce(activeThread).mockReturnValueOnce(standbyB);
      const service = setupServiceWithMockFactory(mockFactory);
      const configA = { ...mockAgentProcessConfig, cwd: '/workspace-a', threadPoolSize: 1 };
      const configB = { ...mockAgentProcessConfig, cwd: '/workspace-b', threadPoolSize: 1 };

      const session = await service.createSession(configA);
      await service.setStandbyTarget(configB);
      expect(activeThread.dispose).not.toHaveBeenCalled();

      await service.disposeSession(session.sessionId);
      await flushAsyncWork();

      expect(activeThread.dispose).toHaveBeenCalled();
      expect(standbyB.initialize).toHaveBeenCalledTimes(1);
      expect((service as any).threadPool).toEqual([standbyB]);
    });

    it('waits for and replaces an incompatible warming thread before creating a session', async () => {
      const initializeGate = createDeferred<any>();
      const warmingThread = createMockThread();
      warmingThread.initialize.mockImplementation(async () => {
        await initializeGate.promise;
        warmingThread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const sessionThread = createMockThread({
        newSession: jest.fn(async () => {
          sessionThread._fireEvent({
            type: 'session_notification',
            notification: {
              sessionId: 'workspace-b-session',
              update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
            },
          });
          return { sessionId: 'workspace-b-session' };
        }),
      });
      const mockFactory = jest.fn().mockReturnValueOnce(warmingThread).mockReturnValueOnce(sessionThread);
      const service = setupServiceWithMockFactory(mockFactory);
      const configA = { ...mockAgentProcessConfig, cwd: '/workspace-a', threadPoolSize: 1 };
      const configB = { ...mockAgentProcessConfig, cwd: '/workspace-b', threadPoolSize: 1 };

      const warmup = service.warmUpAgentPool(configA);
      let sessionSettled = false;
      const session = service.createSession(configB).finally(() => {
        sessionSettled = true;
      });
      await flushAsyncWork();

      expect(sessionSettled).toBe(false);
      expect(warmingThread.dispose).not.toHaveBeenCalled();
      expect(mockFactory).toHaveBeenCalledTimes(1);

      initializeGate.resolve({ protocolVersion: 1, agentCapabilities: {} });
      const [, result] = await Promise.all([warmup, session]);

      expect(result.sessionId).toBe('workspace-b-session');
      expect(warmingThread.dispose).toHaveBeenCalledTimes(1);
      expect(sessionThread.initialize).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/workspace-b' }));
      expect((service as any).threadPool).toEqual([sessionThread]);
      expect(mockFactory).toHaveBeenCalledTimes(2);
    });

    it('gives one foreground request exclusive ownership of an incompatible warming slot', async () => {
      const initializeGate = createDeferred<any>();
      const warmingThread = createMockThread();
      warmingThread.initialize.mockImplementation(async () => {
        await initializeGate.promise;
        warmingThread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const sessionThread = createMockThread({
        newSession: jest.fn(async () => {
          sessionThread._fireEvent({
            type: 'session_notification',
            notification: {
              sessionId: 'foreground-session',
              update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
            },
          });
          return { sessionId: 'foreground-session' };
        }),
      });
      const mockFactory = jest.fn().mockReturnValueOnce(warmingThread).mockReturnValueOnce(sessionThread);
      const service = setupServiceWithMockFactory(mockFactory);
      const warmupConfig = { ...mockAgentProcessConfig, cwd: '/workspace-a', threadPoolSize: 1 };
      const foregroundConfig = { ...mockAgentProcessConfig, cwd: '/workspace-b', threadPoolSize: 1 };

      const warmup = service.warmUpAgentPool(warmupConfig);
      const firstRequest = service.createSession(foregroundConfig);
      await flushAsyncWork();

      let secondError: Error | undefined;
      try {
        await service.createSession(foregroundConfig);
      } catch (error) {
        secondError = error as Error;
      }
      expect(secondError).toBeInstanceOf(Error);
      expect(secondError!.name).toBe('ACP_THREAD_POOL_SATURATED');
      expect(secondError!.message).toContain('Thread pool is full (1)');
      expect(warmingThread.dispose).not.toHaveBeenCalled();

      initializeGate.resolve({ protocolVersion: 1, agentCapabilities: {} });
      await Promise.all([warmup, firstRequest]);

      expect(warmingThread.dispose).toHaveBeenCalledTimes(1);
      expect(sessionThread.newSession).toHaveBeenCalledTimes(1);
      expect(mockFactory).toHaveBeenCalledTimes(2);
    });

    it('disposes a failed warmup thread', async () => {
      const failedThread = createMockThread({
        initialize: jest.fn().mockRejectedValue(new Error('warmup failed')),
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(failedThread));

      await service.warmUpAgentPool(mockAgentProcessConfigWithSmallPool);

      expect(failedThread.dispose).toHaveBeenCalledTimes(1);
      expect((service as any).threadPool).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('failed to initialize thread'));
    });

    it('backs off repeated standby startup failures at one, five, then thirty seconds', async () => {
      jest.useFakeTimers();
      let attempt = 0;
      const mockFactory = jest.fn(() => {
        attempt += 1;
        return createMockThread({
          threadId: `failed-standby-${attempt}`,
          initialize: jest.fn().mockRejectedValue(new Error(`warmup failed ${attempt}`)),
        });
      });
      const service = setupServiceWithMockFactory(mockFactory);

      await service.setStandbyTarget(mockAgentProcessConfigWithSmallPool);
      expect(mockFactory).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(999);
      expect(mockFactory).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(mockFactory).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(4999);
      expect(mockFactory).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1);
      expect(mockFactory).toHaveBeenCalledTimes(3);

      await jest.advanceTimersByTimeAsync(29999);
      expect(mockFactory).toHaveBeenCalledTimes(3);
      await jest.advanceTimersByTimeAsync(1);
      expect(mockFactory).toHaveBeenCalledTimes(4);

      await service.stopAgent();
      jest.useRealTimers();
    });
  });

  describe('getSessionMcpServers()', () => {
    it('should start and return the built-in OpenSumi MCP server connection descriptor', async () => {
      const { service } = createService();
      const connection = {
        name: 'opensumi-ide',
        type: 'http',
        transport: 'streamable-http',
        url: 'http://127.0.0.1:12345/mcp/token',
        redactedUrl: 'http://127.0.0.1:12345/mcp/<redacted>',
        headers: [],
      };
      const opensumiMcpHttpServer = {
        start: jest.fn().mockResolvedValue(undefined),
        getConnectionInfo: jest.fn().mockReturnValue(connection),
      };
      (service as any).opensumiMcpHttpServer = opensumiMcpHttpServer;

      await expect(service.getOpenSumiMcpServerConnection('client-full')).resolves.toBe(connection);
      expect(opensumiMcpHttpServer.start).toHaveBeenCalled();
      expect(opensumiMcpHttpServer.getConnectionInfo).toHaveBeenCalledWith('client-full');
    });

    it('should append the built-in OpenSumi MCP server when the agent supports HTTP MCP', async () => {
      const thread = createMockThread({
        agentCapabilities: {
          mcpCapabilities: {
            http: true,
            sse: true,
          },
        },
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);
      const opensumiMcpHttpServer = {
        getServerName: jest.fn().mockReturnValue('opensumi-ide'),
        start: jest.fn().mockResolvedValue(undefined),
        getUrl: jest.fn().mockReturnValue('http://127.0.0.1:12345/mcp/token'),
      };
      (service as any).opensumiMcpHttpServer = opensumiMcpHttpServer;

      const servers = await (service as any).getSessionMcpServers(thread, {
        ...mockAgentProcessConfig,
        mcpServers: [
          {
            name: 'external-http',
            type: 'http',
            url: 'http://127.0.0.1:9999/mcp',
            headers: [],
          },
        ],
      });

      expect(opensumiMcpHttpServer.start).toHaveBeenCalled();
      expect(servers).toEqual([
        {
          name: 'external-http',
          type: 'http',
          url: 'http://127.0.0.1:9999/mcp',
          headers: [],
        },
        {
          name: 'opensumi-ide',
          type: 'http',
          url: 'http://127.0.0.1:12345/mcp/token',
          headers: [],
        },
      ]);
    });

    it('should not append the built-in OpenSumi MCP server without HTTP MCP support', async () => {
      const thread = createMockThread({
        agentCapabilities: {
          mcpCapabilities: {
            http: false,
            sse: true,
          },
        },
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);
      const opensumiMcpHttpServer = {
        getServerName: jest.fn().mockReturnValue('opensumi-ide'),
        start: jest.fn().mockResolvedValue(undefined),
        getUrl: jest.fn().mockReturnValue('http://127.0.0.1:12345/mcp/token'),
      };
      (service as any).opensumiMcpHttpServer = opensumiMcpHttpServer;

      const servers = await (service as any).getSessionMcpServers(thread, {
        ...mockAgentProcessConfig,
        mcpServers: [],
      });

      expect(opensumiMcpHttpServer.start).not.toHaveBeenCalled();
      expect(servers).toEqual([]);
    });

    it('should not append the built-in OpenSumi MCP server when WebMCP is disabled', async () => {
      const thread = createMockThread({
        agentCapabilities: {
          mcpCapabilities: {
            http: true,
            sse: true,
          },
        },
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);
      const opensumiMcpHttpServer = {
        getServerName: jest.fn().mockReturnValue('opensumi-ide'),
        start: jest.fn().mockResolvedValue(undefined),
        getUrl: jest.fn().mockReturnValue('http://127.0.0.1:12345/mcp/token'),
      };
      (service as any).opensumiMcpHttpServer = opensumiMcpHttpServer;

      const externalServer = {
        name: 'external-http',
        type: 'http',
        url: 'http://127.0.0.1:9999/mcp',
        headers: [],
      };
      const servers = await (service as any).getSessionMcpServers(thread, {
        ...mockAgentProcessConfig,
        webMcp: {
          enabled: false,
        },
        mcpServers: [externalServer],
      });

      expect(opensumiMcpHttpServer.start).not.toHaveBeenCalled();
      expect(servers).toEqual([externalServer]);
    });
  });

  // -----------------------------------------------------------------------
  // createSession
  // -----------------------------------------------------------------------

  describe('createSession()', () => {
    it('should create a new thread, initialize, and return sessionId with availableCommands', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      // Fire available_commands_update event
      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: {
              sessionUpdate: 'available_commands_update',
              availableCommands: [
                { name: 'ReadFile', description: 'Read a file' },
                { name: 'WriteFile', description: 'Write a file' },
              ],
            },
          },
        });
      }, 10);

      const result = await service.createSession(mockAgentProcessConfig);

      expect(result.sessionId).toBeDefined();
      expect(result.availableCommands).toHaveLength(2);
      expect(result.availableCommands[0].name).toBe('ReadFile');
      expect(thread.initialize).toHaveBeenCalled();
      expect(thread.newSession).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('timings={"threadAcquireMs":'));
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('"newSessionRpcMs":'));
    });

    it('should create a session with empty commands when available_commands_update times out', async () => {
      jest.useFakeTimers();
      const { service, thread } = createServiceWithAutoEvents();

      const resultPromise = service.createSession(mockAgentProcessConfig);
      await jest.advanceTimersByTimeAsync(5000);

      const result = await resultPromise;

      expect(result.sessionId).toBe('new-session-1');
      expect(result.availableCommands).toEqual([]);
      expect(thread.dispose).not.toHaveBeenCalled();
    });

    it('should use the latest complete available command update during discovery', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: {
              sessionUpdate: 'available_commands_update',
              availableCommands: [{ name: 'old-skill', description: 'Removed skill' }],
            },
          },
        });
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: {
              sessionUpdate: 'available_commands_update',
              availableCommands: [{ name: 'new-skill', description: 'Installed skill' }],
            },
          },
        });
      }, 10);

      const result = await service.createSession(mockAgentProcessConfig);

      expect(result.availableCommands).toEqual([{ name: 'new-skill', description: 'Installed skill' }]);
    });

    it('should preserve working sessions and report diagnostics when the pool is saturated', async () => {
      const { service } = createServiceWithAutoEvents();

      // Fill the pool with max threads
      const createdThreads: MockThread[] = [];
      for (let i = 0; i < SMALL_THREAD_POOL_SIZE; i++) {
        const t = createMockThread({
          getStatus: jest.fn().mockReturnValue('working'),
          newSession: jest.fn().mockResolvedValue({ sessionId: `session-${i}` }),
          onEvent: jest.fn((cb: any) => {
            setTimeout(() => {
              cb({
                type: 'session_notification',
                notification: {
                  sessionId: `session-${i}`,
                  update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
                },
              });
            }, 10);
            return { dispose: jest.fn() };
          }),
        });
        createdThreads.push(t);
        (service as any).threadFactory.mockReturnValueOnce(t);
        await service.createSession(mockAgentProcessConfigWithSmallPool);
      }

      (mockLogger.warn as jest.Mock).mockClear();
      let saturationError: Error | undefined;
      try {
        await service.createSession(mockAgentProcessConfigWithSmallPool);
      } catch (error) {
        saturationError = error as Error;
      }

      expect(saturationError).toBeInstanceOf(Error);
      expect(saturationError!.name).toBe('ACP_THREAD_POOL_SATURATED');
      expect(saturationError!.message).toContain('Thread pool is full');
      expect(createdThreads.every((thread) => thread.dispose.mock.calls.length === 0)).toBe(true);
      expect((service as any).sessions.size).toBe(SMALL_THREAD_POOL_SIZE);
      createdThreads.forEach((thread, index) => {
        expect((service as any).sessions.get(`session-${index}`)).toBe(thread);
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('"warming":false'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('"processReusable":false'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('"capacityReclaimable":false'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('"exclusionReasons"'));
    });

    it('should recycle the least recently used reusable thread when pool is full', async () => {
      const { service, mockFactory } = createServiceWithAutoEvents();
      const threads: MockThread[] = [];

      for (let i = 0; i < 3; i++) {
        const t = createMockThread({
          threadId: `thread-${i}`,
          getStatus: jest.fn().mockReturnValue('awaiting_prompt'),
          newSession: jest.fn().mockResolvedValue({ sessionId: `session-${i}` }),
          onEvent: jest.fn((cb: any) => {
            setTimeout(() => {
              cb({
                type: 'session_notification',
                notification: {
                  sessionId: `session-${i}`,
                  update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
                },
              });
            }, 10);
            return { dispose: jest.fn() };
          }),
        });
        threads.push(t);
        mockFactory.mockReturnValueOnce(t);
        await service.createSession(mockAgentProcessConfigWithSmallPool);
      }

      threads[0].newSession.mockResolvedValueOnce({ sessionId: 'session-3' });
      const result = await service.createSession(mockAgentProcessConfigWithSmallPool);

      expect(result.sessionId).toBe('session-3');
      expect(mockFactory).toHaveBeenCalledTimes(3);
      expect(threads[0].newSession).toHaveBeenCalledTimes(2);
      expect((service as any).sessions.has('session-0')).toBe(false);
      expect((service as any).sessions.get('session-3')).toBe(threads[0]);
    });

    it('should not let loadSession reuse a thread reserved by createSession', async () => {
      const initializeGate = createDeferred<any>();
      const creatingThread = createMockThread({
        threadId: 'creating-thread',
        initialize: jest.fn().mockReturnValue(initializeGate.promise),
        newSession: jest.fn().mockResolvedValue({ sessionId: 'created-session' }),
        getStatus: jest.fn().mockReturnValue('idle'),
      });
      const loadingThread = createMockThread({
        threadId: 'loading-thread',
        getStatus: jest.fn().mockReturnValue('idle'),
        loadSession: jest.fn().mockResolvedValue({ sessionId: 'loaded-session' }),
      });
      const mockFactory = jest.fn().mockReturnValueOnce(creatingThread).mockReturnValueOnce(loadingThread);
      const service = setupServiceWithMockFactory(mockFactory);

      const createPromise = service.createSession(mockAgentProcessConfig);
      await flushAsyncWork();

      const loadPromise = service.loadSession('loaded-session', mockAgentProcessConfig);
      await flushAsyncWork();

      expect(mockFactory).toHaveBeenCalledTimes(2);
      expect((service as any).sessions.get('loaded-session')).toBe(loadingThread);
      expect(creatingThread.loadSession).not.toHaveBeenCalled();

      initializeGate.resolve({ protocolVersion: 1, agentCapabilities: {} });
      creatingThread._fireEvent({
        type: 'session_notification',
        notification: {
          sessionId: 'created-session',
          update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
        },
      });

      const [createResult, loadResult] = await Promise.all([createPromise, loadPromise]);

      expect(loadingThread.loadSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'loaded-session', cwd: mockAgentProcessConfig.cwd }),
      );
      expect(createResult.sessionId).toBe('created-session');
      expect(loadResult.sessionId).toBe('loaded-session');
      expect((service as any).sessions.get('created-session')).toBe(creatingThread);
      expect((service as any).sessions.get('loaded-session')).toBe(loadingThread);
    });

    it('cancels an in-flight session creation before it can bind a session', async () => {
      const initializeGate = createDeferred<any>();
      const cancellationError = new Error('session creation cancelled');
      cancellationError.name = 'ACP_SESSION_CREATION_CANCELLED';
      const thread = createMockThread({
        initialize: jest.fn().mockReturnValue(initializeGate.promise),
        dispose: jest.fn(async () => initializeGate.reject(cancellationError)),
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));

      const creation = service.createSession(mockAgentProcessConfig, 'launch-1');
      await flushAsyncWork();
      await service.cancelSessionCreation('launch-1');

      await expect(creation).rejects.toMatchObject({ name: 'ACP_SESSION_CREATION_CANCELLED' });
      expect(thread.dispose).toHaveBeenCalledTimes(1);
      expect(thread.newSession).not.toHaveBeenCalled();
      expect((service as any).threadPool).toEqual([]);
      expect((service as any).sessions.size).toBe(0);
    });

    it('cancels promptly after newSession while command discovery is still pending', async () => {
      const thread = createMockThread({
        initialized: true,
        newSession: jest.fn().mockResolvedValue({ sessionId: 'temporary-session' }),
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));

      const creation = service.createSession(mockAgentProcessConfig, 'launch-after-session');
      await flushAsyncWork();
      expect(thread.newSession).toHaveBeenCalledTimes(1);

      await service.cancelSessionCreation('launch-after-session');
      await expect(creation).rejects.toMatchObject({ name: 'ACP_SESSION_CREATION_CANCELLED' });

      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('temporary-session');
      expect((service as any).sessions.has('temporary-session')).toBe(false);
      expect((service as any).threadPool).toEqual([]);
    });

    it('should clean up on error when thread was newly created', async () => {
      const thread = createMockThread({
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
        initialize: jest.fn().mockRejectedValue(new Error('Init failed')),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      await expect(service.createSession(mockAgentProcessConfig)).rejects.toThrow('Init failed');
      expect(thread.dispose).toHaveBeenCalled();
    });

    it('keeps a connected process reusable when newSession fails', async () => {
      const thread = createMockThread({
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
        newSession: jest.fn().mockRejectedValue(new Error('Session creation failed')),
      });
      thread.initialize.mockImplementation(async () => {
        thread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));

      await expect(service.createSession(mockAgentProcessConfig)).rejects.toThrow('Session creation failed');

      expect(thread.reset).toHaveBeenCalled();
      expect(thread.dispose).not.toHaveBeenCalled();
      expect((service as any).threadPool).toEqual([thread]);
      expect((service as any).sessions.size).toBe(0);
    });

    it('releases session resources when creation fails after receiving a session id', async () => {
      const thread = createMockThread({
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
        newSession: jest.fn().mockResolvedValue({ sessionId: 'partially-created-session' }),
        getSessionState: jest.fn(() => {
          throw new Error('Session state failed');
        }),
      });
      thread.initialize.mockImplementation(async () => {
        thread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));

      await expect(service.createSession(mockAgentProcessConfig)).rejects.toThrow('Session state failed');

      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('partially-created-session');
      expect(mockPermissionRouting.unregisterSession).toHaveBeenCalledWith('partially-created-session');
      expect(thread.reset).toHaveBeenCalled();
      expect(thread.dispose).not.toHaveBeenCalled();
    });

    it('disposes a fresh replacement when its initialization fails', async () => {
      const originalThread = createMockThread({
        threadId: 'original-thread',
        getStatus: jest.fn().mockReturnValue('awaiting_prompt'),
        newSession: jest.fn(async () => {
          originalThread._fireEvent({
            type: 'session_notification',
            notification: {
              sessionId: 'session-a',
              update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
            },
          });
          return { sessionId: 'session-a' };
        }),
      });
      originalThread.initialize.mockImplementation(async () => {
        originalThread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const replacementThread = createMockThread({
        threadId: 'replacement-thread',
        initialize: jest.fn().mockRejectedValue(new Error('Replacement init failed')),
      });
      const service = setupServiceWithMockFactory(
        jest.fn().mockReturnValueOnce(originalThread).mockReturnValueOnce(replacementThread),
      );
      const configA = { ...mockAgentProcessConfig, cwd: '/workspace-a', threadPoolSize: 1 };
      const configB = { ...mockAgentProcessConfig, cwd: '/workspace-b', threadPoolSize: 1 };

      await service.createSession(configA);
      await expect(service.createSession(configB)).rejects.toThrow('Replacement init failed');

      expect(originalThread.dispose).toHaveBeenCalled();
      expect(replacementThread.dispose).toHaveBeenCalled();
      expect(replacementThread.reset).not.toHaveBeenCalled();
      expect((service as any).threadPool).toEqual([]);
    });

    it('should apply valid default mode, model, and config options after creating a session', async () => {
      jest.useFakeTimers();
      const { service, thread } = createServiceWithAutoEvents();
      thread.getSessionState.mockReturnValue({
        notifications: [],
        entries: [],
        modes: [{ id: 'plan', name: 'Plan' }],
        models: [{ modelId: 'gpt-5', name: 'GPT-5' }],
        configOptions: [
          {
            id: 'permission',
            options: [{ value: 'acceptEdits' }, { value: 'ask' }],
          },
          {
            id: 'thinking',
          },
        ],
      });

      const resultPromise = service.createSession({
        ...mockAgentProcessConfig,
        defaultMode: 'plan',
        defaultModel: 'gpt-5',
        defaultConfigOptions: {
          permission: 'acceptEdits',
          thinking: true,
        },
      });
      await jest.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;

      expect(result.sessionId).toBe('new-session-1');
      expect(thread.setSessionMode).toHaveBeenCalledWith({ sessionId: 'new-session-1', modeId: 'plan' });
      expect(thread.unstable_setSessionModel).toHaveBeenCalledWith({ sessionId: 'new-session-1', model: 'gpt-5' });
      expect(thread.setSessionConfigOption).toHaveBeenCalledWith({
        sessionId: 'new-session-1',
        configId: 'permission',
        value: 'acceptEdits',
      });
      expect(thread.setSessionConfigOption).toHaveBeenCalledWith({
        sessionId: 'new-session-1',
        configId: 'thinking',
        value: true,
      });
    });

    it('should warn and continue when default session options are invalid', async () => {
      jest.useFakeTimers();
      const { service, thread } = createServiceWithAutoEvents();
      thread.getSessionState.mockReturnValue({
        notifications: [],
        entries: [],
        modes: [{ id: 'code', name: 'Code' }],
        models: [{ modelId: 'claude-sonnet', name: 'Claude Sonnet' }],
        configOptions: [
          {
            id: 'permission',
            options: [{ value: 'ask' }],
          },
        ],
      });

      const resultPromise = service.createSession({
        ...mockAgentProcessConfig,
        defaultMode: 'plan',
        defaultModel: 'gpt-5',
        defaultConfigOptions: {
          permission: 'acceptEdits',
          missing: 'value',
        },
      });
      await jest.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;

      expect(result.sessionId).toBe('new-session-1');
      expect(thread.setSessionMode).not.toHaveBeenCalled();
      expect(thread.unstable_setSessionModel).not.toHaveBeenCalled();
      expect(thread.setSessionConfigOption).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid defaultMode'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid defaultModel'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid defaultConfigOptions value'));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid defaultConfigOptions key'));
    });
  });

  // -----------------------------------------------------------------------
  // initializeAgent
  // -----------------------------------------------------------------------

  describe('initializeAgent()', () => {
    it('should create a session and return AgentSessionInfo', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const result = await service.initializeAgent(mockAgentProcessConfig);

      expect(result.sessionId).toBeDefined();
      expect(result.processId).toBe(thread.threadId);
      expect(result.status).toBe('ready');
    });
  });

  // -----------------------------------------------------------------------
  // loadSession
  // -----------------------------------------------------------------------

  describe('loadSession()', () => {
    it('should return directly if session already exists in mapping', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);
      const loadResult = await service.loadSession(createResult.sessionId, mockAgentProcessConfig);

      expect(loadResult.sessionId).toBe(createResult.sessionId);
      expect(thread.loadSession).not.toHaveBeenCalled();
    });

    it('should create new thread and load session when no idle thread', async () => {
      const thread = createMockThread({
        initialized: true,
        getStatus: jest.fn().mockReturnValue('idle'),
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      const result = await service.loadSession('existing-session-id', mockAgentProcessConfig);

      expect(result.sessionId).toBe('existing-session-id');
      expect(thread.loadSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'existing-session-id' }));
    });

    it('should return native agent replay notifications as historyUpdates', async () => {
      const nativeHistory = [
        {
          sessionId: 'existing-session-id',
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'edit-1',
            status: 'completed',
            content: [{ type: 'diff', path: 'src/index.ts' }],
            rawOutput: { changedFiles: ['src/index.ts'] },
          },
        },
        {
          sessionId: 'existing-session-id',
          update: {
            sessionUpdate: 'usage_update',
            used: 120,
            size: 2000,
          },
        },
      ];
      const thread = createMockThread({
        initialized: true,
        getStatus: jest.fn().mockReturnValue('idle'),
        getSessionNotifications: jest.fn().mockReturnValue(nativeHistory),
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      const result = await service.loadSession('existing-session-id', mockAgentProcessConfig);

      expect(result.historyUpdates).toEqual(nativeHistory);
    });

    it('does not expose local prompt, response, tool, thought, or permission sentinels in metadata-only session restore results', async () => {
      const thread = createMockThread({
        initialized: true,
        getStatus: jest.fn().mockReturnValue('idle'),
        getEntries: jest.fn().mockReturnValue([
          {
            type: 'user_message',
            data: { id: 'msg-1', content: 'BDD_SENSITIVE_PROMPT', timestamp: 1 },
          },
          {
            type: 'agent_message',
            data: { id: 'msg-2', content: 'BDD_ASSISTANT_PART', timestamp: 2 },
          },
          {
            type: 'thought',
            data: { id: 'msg-3', content: 'BDD_THOUGHT_STEP', timestamp: 3 },
          },
          {
            type: 'tool_result',
            data: { id: 'msg-4', content: 'BDD_TOOL_RESULT', timestamp: 4 },
          },
          {
            type: 'permission',
            data: { id: 'msg-5', content: 'BDD_PERMISSION_ALLOWED', timestamp: 5 },
          },
        ]),
        getSessionNotifications: jest.fn().mockReturnValue([]),
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      const result = await service.loadSession('existing-session-id', mockAgentProcessConfig);

      expect(result.historyUpdates).toEqual([]);
      const serialized = JSON.stringify(result);
      [
        'BDD_SENSITIVE_PROMPT',
        'BDD_ASSISTANT_PART',
        'BDD_THOUGHT_STEP',
        'BDD_TOOL_RESULT',
        'BDD_PERMISSION_ALLOWED',
      ].forEach((sentinel) => expect(serialized).not.toContain(sentinel));
    });

    it('should apply default session options after loading a session', async () => {
      const thread = createMockThread({
        initialized: true,
        getStatus: jest.fn().mockReturnValue('idle'),
        getSessionState: jest.fn().mockReturnValue({
          notifications: [],
          entries: [],
          modes: [{ id: 'code', name: 'Code' }],
          models: [{ modelId: 'gpt-5-mini', name: 'GPT-5 Mini' }],
          configOptions: [{ id: 'approval', options: [{ value: 'on-request' }] }],
        }),
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      await service.loadSession('existing-session-id', {
        ...mockAgentProcessConfig,
        defaultMode: 'code',
        defaultModel: 'gpt-5-mini',
        defaultConfigOptions: {
          approval: 'on-request',
        },
      });

      expect(thread.setSessionMode).toHaveBeenCalledWith({ sessionId: 'existing-session-id', modeId: 'code' });
      expect(thread.unstable_setSessionModel).toHaveBeenCalledWith({
        sessionId: 'existing-session-id',
        model: 'gpt-5-mini',
      });
      expect(thread.setSessionConfigOption).toHaveBeenCalledWith({
        sessionId: 'existing-session-id',
        configId: 'approval',
        value: 'on-request',
      });
    });

    it('keeps a connected process reusable when loadSession fails', async () => {
      const thread = createMockThread({
        loadSession: jest
          .fn()
          .mockRejectedValueOnce(new Error('Session load failed'))
          .mockResolvedValueOnce({ sessionId: 'next-session' }),
      });
      thread.initialize.mockImplementation(async () => {
        thread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      await expect(service.loadSession('failed-session', mockAgentProcessConfig)).rejects.toThrow(
        'Session load failed',
      );
      const result = await service.loadSession('next-session', mockAgentProcessConfig);

      expect(result.sessionId).toBe('next-session');
      expect(mockFactory).toHaveBeenCalledTimes(1);
      expect(thread.reset).toHaveBeenCalled();
      expect(thread.dispose).not.toHaveBeenCalled();
      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('failed-session');
      expect((service as any).sessions.has('failed-session')).toBe(false);
      expect((service as any).sessions.get('next-session')).toBe(thread);
    });

    it('maps ACP resource-not-found during session/load to the stable missing-session error', async () => {
      const missingSessionError = Object.assign(new Error('Resource not found: missing-session'), { code: -32002 });
      const thread = createMockThread({
        loadSession: jest.fn().mockRejectedValueOnce(missingSessionError),
      });
      thread.initialize.mockImplementation(async () => {
        thread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));

      await expect(service.loadSession('missing-session', mockAgentProcessConfig)).rejects.toMatchObject({
        name: ACP_SESSION_NOT_FOUND_ERROR_NAME,
      });
    });

    it('should join an in-flight load instead of returning a half-loaded thread', async () => {
      const loadGate = createDeferred<void>();
      let loaded = false;
      const thread = createMockThread({
        initialized: true,
        getStatus: jest.fn().mockReturnValue('idle'),
        loadSession: jest.fn(async () => {
          await loadGate.promise;
          loaded = true;
          return { sessionId: 'shared-session' };
        }),
        getSessionNotifications: jest.fn(() =>
          loaded
            ? [
                {
                  sessionId: 'shared-session',
                  update: {
                    sessionUpdate: 'agent_message_chunk',
                    content: { type: 'text', text: 'Loaded history' },
                  },
                },
              ]
            : [],
        ),
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      const firstLoad = service.loadSession('shared-session', mockAgentProcessConfig);
      await flushAsyncWork();
      expect(thread.loadSession).toHaveBeenCalledTimes(1);

      let secondResolved = false;
      const secondLoad = service.loadSession('shared-session', mockAgentProcessConfig).then((result) => {
        secondResolved = true;
        return result;
      });

      await flushAsyncWork();
      expect(thread.loadSession).toHaveBeenCalledTimes(1);
      expect(secondResolved).toBe(false);

      loadGate.resolve();
      const [firstResult, secondResult] = await Promise.all([firstLoad, secondLoad]);

      expect(firstResult.historyUpdates).toHaveLength(1);
      expect(secondResult.historyUpdates).toHaveLength(1);
      expect(secondResult.historyUpdates[0].update).toEqual(
        expect.objectContaining({
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Loaded history' },
        }),
      );
    });

    it('should reject load without disturbing working sessions when the pool is saturated', async () => {
      const { service } = createServiceWithAutoEvents();
      const workingThreads: MockThread[] = [];

      // Fill the pool
      for (let i = 0; i < SMALL_THREAD_POOL_SIZE; i++) {
        const t = createMockThread({
          getStatus: jest.fn().mockReturnValue('working'),
          newSession: jest.fn().mockResolvedValue({ sessionId: `session-${i}` }),
          onEvent: jest.fn((cb: any) => {
            setTimeout(() => {
              cb({
                type: 'session_notification',
                notification: {
                  sessionId: `session-${i}`,
                  update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
                },
              });
            }, 10);
            return { dispose: jest.fn() };
          }),
        });
        workingThreads.push(t);
        (service as any).threadFactory.mockReturnValueOnce(t);
        await service.createSession(mockAgentProcessConfigWithSmallPool);
      }

      let saturationError: Error | undefined;
      try {
        await service.loadSession('new-session', mockAgentProcessConfigWithSmallPool);
      } catch (error) {
        saturationError = error as Error;
      }

      expect(saturationError).toBeInstanceOf(Error);
      expect(saturationError!.name).toBe(ACP_THREAD_POOL_SATURATED_ERROR_NAME);
      expect(workingThreads.every((thread) => thread.dispose.mock.calls.length === 0)).toBe(true);
      expect((service as any).sessions.size).toBe(SMALL_THREAD_POOL_SIZE);
    });

    it('reclaims a disconnected process while keeping its durable session reloadable', async () => {
      let disconnectedStatus = 'idle';
      const disconnectedThread = createMockThread({
        threadId: 'disconnected-thread',
        getStatus: jest.fn(() => disconnectedStatus),
        newSession: jest.fn(async () => {
          disconnectedThread._fireEvent({
            type: 'session_notification',
            notification: {
              sessionId: 'durable-session',
              update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
            },
          });
          return { sessionId: 'durable-session' };
        }),
      });
      const replacementThread = createMockThread({
        threadId: 'replacement-thread',
        initialized: true,
        getStatus: jest.fn().mockReturnValue('awaiting_prompt'),
        loadSession: jest.fn(async ({ sessionId }) => ({ sessionId })),
      });
      const mockFactory = jest.fn().mockReturnValueOnce(disconnectedThread).mockReturnValueOnce(replacementThread);
      const service = setupServiceWithMockFactory(mockFactory);
      const oneThreadConfig = { ...mockAgentProcessConfig, threadPoolSize: 1 };

      await service.createSession(oneThreadConfig);
      disconnectedStatus = 'disconnected';

      const replacementResult = await service.loadSession('replacement-session', oneThreadConfig);

      expect(replacementResult.sessionId).toBe('replacement-session');
      expect(disconnectedThread.dispose).toHaveBeenCalledTimes(1);
      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('durable-session');
      expect(mockPermissionRouting.unregisterSession).toHaveBeenCalledWith('durable-session');
      expect((service as any).sessions.has('durable-session')).toBe(false);
      expect((service as any).sessionRefCounts.has('durable-session')).toBe(false);
      expect((service as any).threadStatusDisposables.has('durable-session')).toBe(false);
      expect((service as any).threadPool).toEqual([replacementThread]);

      const reloadedResult = await service.loadSession('durable-session', oneThreadConfig);

      expect(reloadedResult.sessionId).toBe('durable-session');
      expect(replacementThread.loadSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ sessionId: 'durable-session', cwd: oneThreadConfig.cwd }),
      );
    });

    it('should load a new session by recycling the least recently used reusable thread', async () => {
      const { service, mockFactory } = createServiceWithAutoEvents();
      const threads: MockThread[] = [];

      for (let i = 0; i < 3; i++) {
        const t = createMockThread({
          threadId: `thread-${i}`,
          getStatus: jest.fn().mockReturnValue('awaiting_prompt'),
          newSession: jest.fn().mockResolvedValue({ sessionId: `session-${i}` }),
          loadSession: jest.fn().mockResolvedValue({ sessionId: 'session-3' }),
          onEvent: jest.fn((cb: any) => {
            setTimeout(() => {
              cb({
                type: 'session_notification',
                notification: {
                  sessionId: `session-${i}`,
                  update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
                },
              });
            }, 10);
            return { dispose: jest.fn() };
          }),
        });
        threads.push(t);
        mockFactory.mockReturnValueOnce(t);
        await service.createSession(mockAgentProcessConfigWithSmallPool);
      }

      const result = await service.loadSession('session-3', mockAgentProcessConfigWithSmallPool);

      expect(result.sessionId).toBe('session-3');
      expect(mockFactory).toHaveBeenCalledTimes(3);
      expect(threads[0].loadSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-3', cwd: mockAgentProcessConfig.cwd }),
      );
      expect((service as any).sessions.has('session-0')).toBe(false);
      expect((service as any).sessions.get('session-3')).toBe(threads[0]);
    });

    it('should reserve a recycled thread before async cleanup so concurrent loads cannot reuse it', async () => {
      const { service, mockFactory } = createServiceWithAutoEvents();
      const threads: MockThread[] = [];

      for (let i = 0; i < 3; i++) {
        const t = createMockThread({
          threadId: `thread-${i}`,
          getStatus: jest.fn().mockReturnValue('awaiting_prompt'),
          newSession: jest.fn().mockResolvedValue({ sessionId: `session-${i}` }),
          loadSession: jest.fn(async (params) => ({ sessionId: params.sessionId })),
          onEvent: jest.fn((cb: any) => {
            setTimeout(() => {
              cb({
                type: 'session_notification',
                notification: {
                  sessionId: `session-${i}`,
                  update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
                },
              });
            }, 10);
            return { dispose: jest.fn() };
          }),
        });
        threads.push(t);
        mockFactory.mockReturnValueOnce(t);
        await service.createSession(mockAgentProcessConfigWithSmallPool);
      }

      const firstReleaseGate = createDeferred<void>();
      mockTerminalHandler.releaseSessionTerminals.mockImplementation(async (sessionId: string) => {
        if (sessionId === 'session-0') {
          await firstReleaseGate.promise;
        }
      });

      const firstLoad = service.loadSession('session-3', mockAgentProcessConfigWithSmallPool);
      await flushAsyncWork();
      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('session-0');

      const secondLoad = service.loadSession('session-4', mockAgentProcessConfigWithSmallPool);
      await flushAsyncWork();
      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('session-1');

      firstReleaseGate.resolve();
      await Promise.all([firstLoad, secondLoad]);

      expect(threads[0].loadSession).toHaveBeenCalledTimes(1);
      expect(threads[0].loadSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-3', cwd: mockAgentProcessConfig.cwd }),
      );
      expect(threads[1].loadSession).toHaveBeenCalledTimes(1);
      expect(threads[1].loadSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-4', cwd: mockAgentProcessConfig.cwd }),
      );
      expect((service as any).sessions.get('session-3')).toBe(threads[0]);
      expect((service as any).sessions.get('session-4')).toBe(threads[1]);
    });

    it('prevents a reserved reclamation candidate from starting a concurrent prompt', async () => {
      const releaseGate = createDeferred<void>();
      let status = 'awaiting_prompt';
      const thread = createMockThread({
        threadId: 'reclamation-candidate',
        getStatus: jest.fn(() => status),
        newSession: jest.fn(async () => {
          thread._fireEvent({
            type: 'session_notification',
            notification: {
              sessionId: 'session-0',
              update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
            },
          });
          return { sessionId: 'session-0' };
        }),
        loadSession: jest.fn(async ({ sessionId }) => ({ sessionId })),
        prompt: jest.fn(async () => {
          status = 'working';
          return { stopReason: 'end_turn' };
        }),
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));
      const oneThreadConfig = { ...mockAgentProcessConfig, threadPoolSize: 1 };
      mockTerminalHandler.releaseSessionTerminals.mockImplementation(async (sessionId: string) => {
        if (sessionId === 'session-0') {
          await releaseGate.promise;
        }
      });

      await service.createSession(oneThreadConfig);

      const replacementLoad = service.loadSession('session-1', oneThreadConfig);
      await flushAsyncWork();
      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('session-0');
      expect((service as any).reservedThreads.has(thread)).toBe(true);

      const promptErrors: Error[] = [];
      const stream = service.sendMessage({ sessionId: 'session-0', prompt: 'do not start' }, oneThreadConfig);
      stream.onError((error) => promptErrors.push(error));
      await flushAsyncWork();

      expect(thread.prompt).not.toHaveBeenCalled();
      expect(status).toBe('awaiting_prompt');
      expect(promptErrors).toHaveLength(1);
      expect(promptErrors[0].name).toBe(ACP_THREAD_POOL_SATURATED_ERROR_NAME);

      releaseGate.resolve();
      await replacementLoad;

      expect(thread.loadSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1', cwd: oneThreadConfig.cwd }),
      );
    });
  });

  describe('loadSessionOrNew()', () => {
    it('should rebind service state when fallback creates a different session id', async () => {
      const thread = createMockThread({
        initialized: true,
        getStatus: jest.fn().mockReturnValue('idle'),
        loadSessionOrNew: jest.fn().mockResolvedValue({ sessionId: 'actual-session-id' }),
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      const result = await service.loadSessionOrNew('missing-session-id', mockAgentProcessConfig);

      expect(result.sessionId).toBe('actual-session-id');
      expect((service as any).sessions.has('missing-session-id')).toBe(false);
      expect((service as any).sessions.get('actual-session-id')).toBe(thread);
      expect(mockPermissionRouting.unregisterSession).toHaveBeenCalledWith('missing-session-id');
      expect(mockPermissionRouting.registerSession).toHaveBeenCalledWith('actual-session-id');
    });

    it('should join a pending loadSessionOrNew request for the same session', async () => {
      const loadGate = createDeferred<{ sessionId: string }>();
      const thread = createMockThread({
        initialized: true,
        getStatus: jest.fn().mockReturnValue('idle'),
        loadSessionOrNew: jest.fn().mockReturnValue(loadGate.promise),
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      const firstLoad = service.loadSessionOrNew('pending-session-id', mockAgentProcessConfig);
      await flushAsyncWork();

      const secondLoad = service.loadSessionOrNew('pending-session-id', mockAgentProcessConfig);
      loadGate.resolve({ sessionId: 'pending-session-id' });
      const [firstResult, secondResult] = await Promise.all([firstLoad, secondLoad]);

      expect(firstResult.sessionId).toBe('pending-session-id');
      expect(secondResult.sessionId).toBe('pending-session-id');
      expect(thread.loadSessionOrNew).toHaveBeenCalledTimes(1);
      expect((service as any).sessionRefCounts.get('pending-session-id')).toBe(2);
    });

    it('should release recycled thread reservation after loadSessionOrNew registers a pending load', async () => {
      const { service, mockFactory } = createServiceWithAutoEvents();
      const threads: MockThread[] = [];

      for (let i = 0; i < 3; i++) {
        const t = createMockThread({
          threadId: `thread-${i}`,
          getStatus: jest.fn().mockReturnValue('awaiting_prompt'),
          newSession: jest.fn().mockResolvedValue({ sessionId: `session-${i}` }),
          loadSessionOrNew: jest.fn().mockResolvedValue({ sessionId: 'session-3' }),
          onEvent: jest.fn((cb: any) => {
            setTimeout(() => {
              cb({
                type: 'session_notification',
                notification: {
                  sessionId: `session-${i}`,
                  update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
                },
              });
            }, 10);
            return { dispose: jest.fn() };
          }),
        });
        threads.push(t);
        mockFactory.mockReturnValueOnce(t);
        await service.createSession(mockAgentProcessConfigWithSmallPool);
      }

      await service.loadSessionOrNew('session-3', mockAgentProcessConfigWithSmallPool);

      expect(threads[0].loadSessionOrNew).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-3', cwd: mockAgentProcessConfig.cwd }),
      );
      expect((service as any).reservedThreads.has(threads[0])).toBe(false);
    });

    it('keeps a connected process reusable when loadSessionOrNew fails', async () => {
      const thread = createMockThread({
        loadSessionOrNew: jest.fn().mockRejectedValue(new Error('Load or create failed')),
      });
      thread.initialize.mockImplementation(async () => {
        thread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));

      await expect(service.loadSessionOrNew('failed-session', mockAgentProcessConfig)).rejects.toThrow(
        'Load or create failed',
      );

      expect(thread.reset).toHaveBeenCalled();
      expect(thread.dispose).not.toHaveBeenCalled();
      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('failed-session');
      expect((service as any).threadPool).toEqual([thread]);
      expect((service as any).sessions.has('failed-session')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------

  describe('sendMessage()', () => {
    it('should return stream with error if session cannot be loaded', async () => {
      const thread = createMockThread({
        loadSession: jest.fn().mockRejectedValue(new Error('Session not found')),
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));
      const stream = service.sendMessage({ prompt: 'hello', sessionId: 'nonexistent' }, mockAgentProcessConfig);

      const errors: Error[] = [];
      stream.onError((e) => errors.push(e));
      await flushAsyncWork();

      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Session not found');
    });

    it('should reload an LRU-evicted session before sending a message', async () => {
      const { service, mockFactory } = createServiceWithAutoEvents();
      const threads: MockThread[] = [];

      for (let i = 0; i < 3; i++) {
        const threadIndex = i;
        const t = createMockThread({
          threadId: `thread-${threadIndex}`,
          getStatus: jest.fn().mockReturnValue('awaiting_prompt'),
          newSession: jest.fn().mockResolvedValue({ sessionId: `session-${threadIndex}` }),
          loadSession: jest.fn().mockResolvedValue({ sessionId: 'session-0' }),
          onEvent: jest.fn((cb: any) => {
            setTimeout(() => {
              cb({
                type: 'session_notification',
                notification: {
                  sessionId: `session-${threadIndex}`,
                  update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
                },
              });
            }, 10);
            return { dispose: jest.fn() };
          }),
        });
        threads.push(t);
        mockFactory.mockReturnValueOnce(t);
        await service.createSession(mockAgentProcessConfigWithSmallPool);
      }

      threads[0].newSession.mockResolvedValueOnce({ sessionId: 'session-3' });
      await service.createSession(mockAgentProcessConfigWithSmallPool);

      expect((service as any).sessions.has('session-0')).toBe(false);

      const stream = service.sendMessage(
        { prompt: 'Hello again', sessionId: 'session-0' },
        mockAgentProcessConfigWithSmallPool,
      );
      const updates: any[] = [];
      stream.onData((data) => updates.push(data));
      await flushAsyncWork();

      expect((service as any).sessions.get('session-0')).toBe(threads[1]);
      expect(threads[1].loadSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-0', cwd: mockAgentProcessConfig.cwd }),
      );
      expect(threads[1].addUserMessage).toHaveBeenCalledWith('Hello again');
      expect(threads[1].prompt).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-0', prompt: expect.any(Array) }),
      );
      expect(updates).toContainEqual(expect.objectContaining({ type: 'thread_status' }));
    });

    it('should add user message and prompt the thread', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);
      service.sendMessage({ prompt: 'Hello world', sessionId: createResult.sessionId }, mockAgentProcessConfig);
      await flushAsyncWork();

      expect(thread.addUserMessage).toHaveBeenCalledWith('Hello world');
      expect(thread.prompt).toHaveBeenCalled();
    });

    it('should prepend only the low-priority WebMCP hint for the first built-in MCP prompt', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);
      (service as any).builtInMcpSessionIds.add(createResult.sessionId);

      service.sendMessage(
        { prompt: 'Explain the current file', sessionId: createResult.sessionId },
        mockAgentProcessConfig,
      );
      await flushAsyncWork();

      const promptBlocks = thread.prompt.mock.calls[0][0].prompt;
      expect(promptBlocks).toEqual([
        {
          type: 'text',
          text: [
            '<opensumi_mcp_usage_hint priority="low">',
            'Use the opensumi-ide MCP catalog tools to discover and enable IDE capability groups before invoking non-default OpenSumi tools.',
            '</opensumi_mcp_usage_hint>',
            '',
            'Explain the current file',
          ].join('\n'),
        },
      ]);
      expect(promptBlocks[0].text).not.toContain('terminal_create');
      expect(promptBlocks[0].text).not.toContain('Live OpenSumi opensumi-ide MCP registered capability metadata');
    });

    it('should not repeat the WebMCP hint after the first built-in MCP prompt', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);
      (service as any).builtInMcpSessionIds.add(createResult.sessionId);
      thread.getEntries.mockReturnValue([{ id: 'user-1' }, { id: 'assistant-1' }]);

      service.sendMessage({ prompt: 'Summarize this file', sessionId: createResult.sessionId }, mockAgentProcessConfig);
      await flushAsyncWork();

      expect(thread.prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: [{ type: 'text', text: 'Summarize this file' }],
        }),
      );
    });

    it('should emit thought updates from session_notification events', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);

      const updates: any[] = [];
      const stream = service.sendMessage(
        { prompt: 'Hello', sessionId: createResult.sessionId },
        mockAgentProcessConfig,
      );
      stream.onData((data) => updates.push(data));

      // Simulate a session notification event
      thread._fireEvent({
        type: 'session_notification',
        notification: {
          sessionId: createResult.sessionId,
          update: {
            sessionUpdate: 'agent_thought_chunk',
            content: { type: 'text', text: 'I am thinking...' },
          },
        },
      });

      expect(updates).toContainEqual(expect.objectContaining({ type: 'thought', content: 'I am thinking...' }));
    });

    it('should emit message updates from session_notification events', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);

      const updates: any[] = [];
      const stream = service.sendMessage(
        { prompt: 'Hello', sessionId: createResult.sessionId },
        mockAgentProcessConfig,
      );
      stream.onData((data) => updates.push(data));

      thread._fireEvent({
        type: 'session_notification',
        notification: {
          sessionId: createResult.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'Here is my answer.' },
          },
        },
      });

      expect(updates).toContainEqual(expect.objectContaining({ type: 'message', content: 'Here is my answer.' }));
    });

    it('should ignore stream updates from a different session', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);

      const updates: any[] = [];
      const stream = service.sendMessage(
        { prompt: 'Hello', sessionId: createResult.sessionId },
        mockAgentProcessConfig,
      );
      stream.onData((data) => updates.push(data));

      thread._fireEvent({
        type: 'session_notification',
        notification: {
          sessionId: 'stale-session',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'stale answer' },
          },
        },
      });

      expect(updates).not.toContainEqual(expect.objectContaining({ type: 'message', content: 'stale answer' }));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('ignoring notification for stale-session'));
    });

    it('should emit tool_call updates', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);

      const updates: any[] = [];
      const stream = service.sendMessage(
        { prompt: 'Hello', sessionId: createResult.sessionId },
        mockAgentProcessConfig,
      );
      stream.onData((data) => updates.push(data));

      thread._fireEvent({
        type: 'session_notification',
        notification: {
          sessionId: createResult.sessionId,
          update: {
            sessionUpdate: 'tool_call',
            title: 'ReadFile',
            rawInput: { path: '/test/file.ts' },
          },
        },
      });

      expect(updates).toContainEqual(
        expect.objectContaining({
          type: 'tool_call',
          content: 'ReadFile',
          toolCall: expect.objectContaining({ name: 'ReadFile', input: { path: '/test/file.ts' } }),
        }),
      );
    });

    it('should emit tool_result updates from tool_call_update with diff', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);

      const updates: any[] = [];
      const stream = service.sendMessage(
        { prompt: 'Hello', sessionId: createResult.sessionId },
        mockAgentProcessConfig,
      );
      stream.onData((data) => updates.push(data));

      thread._fireEvent({
        type: 'session_notification',
        notification: {
          sessionId: createResult.sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            content: [{ type: 'diff', path: 'src/index.ts' }],
          },
        },
      });

      expect(updates).toContainEqual(
        expect.objectContaining({ type: 'tool_result', content: 'Modified src/index.ts' }),
      );
    });

    it('should emit done and end stream after prompt completes', (done) => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      service.createSession(mockAgentProcessConfig).then((createResult) => {
        const updates: any[] = [];
        const stream = service.sendMessage(
          { prompt: 'Hello', sessionId: createResult.sessionId },
          mockAgentProcessConfig,
        );
        stream.onData((data) => updates.push(data));
        stream.onEnd(() => {
          expect(updates).toContainEqual({ type: 'done', content: '' });
          expect(thread.markAssistantComplete).toHaveBeenCalled();
          done();
        });
      });
    });

    it('should emit error if prompt fails', async () => {
      const eventListeners: Array<(event: any) => void> = [];
      const thread = createMockThread({
        onEvent: jest.fn((cb: any) => {
          eventListeners.push(cb);
          return { dispose: jest.fn() };
        }),
        _fireEvent(event: any) {
          eventListeners.forEach((cb) => cb(event));
        },
        _eventListeners: eventListeners,
        prompt: jest.fn().mockRejectedValue(new Error('Prompt failed')),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);

      const errors: Error[] = [];
      const stream = service.sendMessage(
        { prompt: 'Hello', sessionId: createResult.sessionId },
        mockAgentProcessConfig,
      );
      stream.onError((e) => errors.push(e));

      // Wait for the async prompt to complete and error to be emitted
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Prompt failed');
    });

    it('should preserve message from JSON-RPC error objects when prompt fails', async () => {
      const eventListeners: Array<(event: any) => void> = [];
      const thread = createMockThread({
        onEvent: jest.fn((cb: any) => {
          eventListeners.push(cb);
          return { dispose: jest.fn() };
        }),
        _fireEvent(event: any) {
          eventListeners.forEach((cb) => cb(event));
        },
        _eventListeners: eventListeners,
        prompt: jest.fn().mockRejectedValue({
          code: -32603,
          message: 'Internal error: API Error: 422 provider config not found',
          data: { errorKind: 'unknown' },
        }),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);

      const errors: Error[] = [];
      const stream = service.sendMessage(
        { prompt: 'Hello', sessionId: createResult.sessionId },
        mockAgentProcessConfig,
      );
      stream.onError((e) => errors.push(e));

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBe('Internal error: API Error: 422 provider config not found');
      expect((errors[0] as any).code).toBe(-32603);
      expect((errors[0] as any).data).toEqual({ errorKind: 'unknown' });
    });

    it('should include images in prompt', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);

      const imageData = 'data:image/png;base64,iVBORw0KGgo=';
      service.sendMessage(
        { prompt: 'Look at this', sessionId: createResult.sessionId, images: [imageData] },
        mockAgentProcessConfig,
      );
      await flushAsyncWork();

      expect(thread.prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.arrayContaining([
            { type: 'text', text: expect.stringContaining('Look at this') },
            { type: 'image', data: 'iVBORw0KGgo=', mimeType: 'image/png' },
          ]),
        }),
      );
    });
  });

  describe('attachSession()', () => {
    it('should emit the current snapshot before forwarding later session updates without prompting again', async () => {
      const { service, thread } = createServiceWithAutoEvents();
      const historyUpdates = [
        {
          sessionId: 'session-1',
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text: 'keep working' },
          },
        },
      ];
      thread.getSessionNotifications.mockReturnValue(historyUpdates);
      thread.getStatus.mockReturnValue('working');
      thread.getSessionState.mockReturnValue({
        notifications: [],
        entries: [],
        modes: [],
        availableCommands: [{ name: 'installed-skill', description: 'Installed skill' }],
      });

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);
      thread.prompt.mockClear();

      const attachment = service.attachSession(createResult.sessionId);
      const updates: any[] = [];
      attachment.onData((update) => updates.push(update));

      thread._fireEvent({
        type: 'session_notification',
        notification: {
          sessionId: createResult.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'still running' },
          },
        },
      });

      expect(updates[0]).toEqual(
        expect.objectContaining({
          type: 'snapshot',
          snapshot: expect.objectContaining({
            sessionId: createResult.sessionId,
            historyUpdates,
            threadStatus: 'working',
            availableCommands: [{ name: 'installed-skill', description: 'Installed skill' }],
          }),
        }),
      );
      expect(updates).toContainEqual(
        expect.objectContaining({
          type: 'update',
          update: expect.objectContaining({ type: 'message', content: 'still running' }),
        }),
      );
      expect(thread.prompt).not.toHaveBeenCalled();
      attachment.end();
    });

    it('should release the thread event subscription when an attachment ends', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const createResult = await service.createSession(mockAgentProcessConfig);
      const attachmentSubscription = { dispose: jest.fn() };
      thread.onEvent.mockReturnValueOnce(attachmentSubscription);

      const attachment = service.attachSession(createResult.sessionId);
      attachment.end();

      expect(attachmentSubscription.dispose).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // cancelRequest
  // -----------------------------------------------------------------------

  describe('cancelRequest()', () => {
    it('should call thread.cancel', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const result = await service.createSession(mockAgentProcessConfig);
      await service.cancelRequest(result.sessionId);

      expect(thread.cancel).toHaveBeenCalledWith(expect.objectContaining({ sessionId: result.sessionId }));
    });

    it('should return early and warn if session not found', async () => {
      const { service } = createService();
      await service.cancelRequest('nonexistent-session');

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should swallow errors', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      thread.cancel = jest.fn().mockRejectedValue(new Error('Cancel failed'));

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const result = await service.createSession(mockAgentProcessConfig);
      await expect(service.cancelRequest(result.sessionId)).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // disposeSession
  // -----------------------------------------------------------------------

  describe('disposeSession()', () => {
    it('should release terminals and remove from session mapping (default)', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const result = await service.createSession(mockAgentProcessConfig);
      await service.disposeSession(result.sessionId);

      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith(result.sessionId);
      expect(service.getSessionInfo(result.sessionId)).toBeNull();
      expect(thread.dispose).not.toHaveBeenCalled();
    });

    it('should fully dispose thread when force=true', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const result = await service.createSession(mockAgentProcessConfig);
      await service.disposeSession(result.sessionId, true);

      expect(thread.dispose).toHaveBeenCalled();
      expect(service.getSessionInfo(result.sessionId)).toBeNull();
    });

    it('should release a loaded session only after the final retained reference is disposed', async () => {
      const thread = createMockThread({
        initialized: true,
        getStatus: jest.fn().mockReturnValue('idle'),
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      await Promise.all([
        service.loadSession('shared-session', mockAgentProcessConfig),
        service.loadSession('shared-session', mockAgentProcessConfig),
      ]);

      mockTerminalHandler.releaseSessionTerminals.mockClear();

      await service.disposeSession('shared-session');

      expect(mockTerminalHandler.releaseSessionTerminals).not.toHaveBeenCalled();
      expect((service as any).sessions.get('shared-session')).toBe(thread);

      await service.disposeSession('shared-session');

      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('shared-session');
      expect((service as any).sessions.has('shared-session')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // stopAgent
  // -----------------------------------------------------------------------

  describe('stopAgent()', () => {
    it('should dispose all threads and clear pool', async () => {
      const { service } = createServiceWithAutoEvents();

      const threads: MockThread[] = [];
      for (let i = 0; i < 3; i++) {
        const t = createMockThread({
          newSession: jest.fn().mockResolvedValue({ sessionId: `session-${i}` }),
          onEvent: jest.fn((cb: any) => {
            setTimeout(() => {
              cb({
                type: 'session_notification',
                notification: {
                  sessionId: `session-${i}`,
                  update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
                },
              });
            }, 10);
            return { dispose: jest.fn() };
          }),
        });
        threads.push(t);
        (service as any).threadFactory.mockReturnValueOnce(t);
        await service.createSession(mockAgentProcessConfigWithSmallPool);
      }

      await service.stopAgent();

      for (const t of threads) {
        expect(t.dispose).toHaveBeenCalled();
      }
      expect((service as any).threadPool).toHaveLength(0);
      expect((service as any).sessions.size).toBe(0);
    });

    it('should be no-op when no threads', async () => {
      const { service } = createService();
      await service.stopAgent();

      expect((service as any).threadPool).toHaveLength(0);
    });

    it('cancels an unclaimed standby warmup before draining shutdown', async () => {
      const initializeGate = createDeferred<any>();
      const thread = createMockThread();
      thread.initialize.mockImplementation(async () => {
        await initializeGate.promise;
        thread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));
      const config = { ...mockAgentProcessConfig, threadPoolSize: 1 };

      const warmup = service.warmUpAgentPool(config);
      let stopSettled = false;
      const stop = service.stopAgent().finally(() => {
        stopSettled = true;
      });
      await flushAsyncWork();

      expect(stopSettled).toBe(false);
      expect(thread.dispose).toHaveBeenCalledTimes(1);

      initializeGate.resolve({ protocolVersion: 1, agentCapabilities: {} });
      await Promise.all([warmup, stop]);

      expect(thread.dispose).toHaveBeenCalled();
      expect((service as any).threadPool).toHaveLength(0);
    });

    it('waits for a fresh createSession initialization before completing shutdown', async () => {
      const initializeGate = createDeferred<any>();
      const thread = createMockThread();
      thread.initialize.mockImplementation(async () => {
        await initializeGate.promise;
        thread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      thread.newSession.mockImplementation(async () => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'foreground-session',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
        return { sessionId: 'foreground-session' };
      });
      const service = setupServiceWithMockFactory(jest.fn().mockReturnValue(thread));
      const config = { ...mockAgentProcessConfig, threadPoolSize: 1 };

      const createOutcome = service.createSession(config).then(
        (result) => result,
        (error) => error as Error,
      );
      await flushAsyncWork();
      expect(thread.initialize).toHaveBeenCalledTimes(1);

      let stopSettled = false;
      const stop = service.stopAgent().finally(() => {
        stopSettled = true;
      });
      await flushAsyncWork();

      expect(stopSettled).toBe(false);
      expect(thread.dispose).not.toHaveBeenCalled();

      initializeGate.resolve({ protocolVersion: 1, agentCapabilities: {} });
      const [outcome] = await Promise.all([createOutcome, stop]);

      expect(outcome).toBeInstanceOf(Error);
      expect((outcome as Error).name).toBe('AcpAgentServiceStoppingError');
      expect(thread.dispose).toHaveBeenCalledTimes(1);
      expect((service as any).threadPool).toHaveLength(0);
    });

    it('does not create an incompatible warmup replacement after shutdown begins', async () => {
      const initializeGate = createDeferred<any>();
      const warmingThread = createMockThread();
      warmingThread.initialize.mockImplementation(async () => {
        await initializeGate.promise;
        warmingThread.initialized = true;
        return { protocolVersion: 1, agentCapabilities: {} };
      });
      const replacementThread = createMockThread();
      const mockFactory = jest.fn().mockReturnValueOnce(warmingThread).mockReturnValueOnce(replacementThread);
      const service = setupServiceWithMockFactory(mockFactory);
      const warmupConfig = { ...mockAgentProcessConfig, cwd: '/workspace-a', threadPoolSize: 1 };
      const foregroundConfig = { ...mockAgentProcessConfig, cwd: '/workspace-b', threadPoolSize: 1 };

      const warmup = service.warmUpAgentPool(warmupConfig);
      const createOutcome = service.createSession(foregroundConfig).then(
        (result) => result,
        (error) => error as Error,
      );
      await flushAsyncWork();
      expect((service as any).reservedThreads.has(warmingThread)).toBe(true);

      const stop = service.stopAgent();
      await flushAsyncWork();

      expect(mockFactory).toHaveBeenCalledTimes(1);
      expect(warmingThread.dispose).not.toHaveBeenCalled();

      initializeGate.resolve({ protocolVersion: 1, agentCapabilities: {} });
      const [, outcome] = await Promise.all([warmup, createOutcome, stop]);

      expect(outcome).toBeInstanceOf(Error);
      expect((outcome as Error).name).toBe('AcpAgentServiceStoppingError');
      expect(mockFactory).toHaveBeenCalledTimes(1);
      expect(replacementThread.initialize).not.toHaveBeenCalled();
      expect(replacementThread.dispose).not.toHaveBeenCalled();
      expect(warmingThread.dispose).toHaveBeenCalledTimes(1);
      expect((service as any).threadPool).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // dispose
  // -----------------------------------------------------------------------

  describe('dispose()', () => {
    it('should call stopAgent and clean up', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      await service.createSession(mockAgentProcessConfig);
      await service.dispose();

      expect(thread.dispose).toHaveBeenCalled();
    });

    it('should dispose the container-owned agent service during application shutdown', async () => {
      const agentService = { dispose: jest.fn().mockResolvedValue(undefined) };
      const contribution = new AcpAgentLifecycleContribution();
      Object.defineProperty(contribution, 'agentService', { value: agentService });

      await contribution.onStop();

      expect(agentService.dispose).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // getSessionInfo
  // -----------------------------------------------------------------------

  describe('getSessionInfo()', () => {
    it('should return null initially (no sessionId)', () => {
      const { service } = createService();
      expect(service.getSessionInfo()).toBeNull();
    });

    it('should return null for unknown sessionId', () => {
      const { service } = createService();
      expect(service.getSessionInfo('unknown')).toBeNull();
    });

    it('should return session info for active session', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const result = await service.createSession(mockAgentProcessConfig);
      const info = service.getSessionInfo(result.sessionId);

      expect(info).not.toBeNull();
      expect(info?.sessionId).toBe(result.sessionId);
      expect(info?.processId).toBe(thread.threadId);
      expect(info?.status).toBe('ready');
    });
  });

  // -----------------------------------------------------------------------
  // listSessions
  // -----------------------------------------------------------------------

  describe('listSessions()', () => {
    it('returns an empty successful result when a compatible thread lists no sessions', async () => {
      const { service, thread } = createService();
      (service as any).sessions.set('active-session', thread);

      await expect(service.listSessions()).resolves.toEqual({ sessions: [], nextCursor: undefined });
      expect(thread.listSessions).toHaveBeenCalledTimes(1);
    });

    it('merges successful session lists when another compatible thread fails', async () => {
      const failingThread = createMockThread({
        threadId: 'failing-thread',
        listSessions: jest.fn().mockRejectedValue(new Error('first list failed')),
      });
      const successfulThread = createMockThread({
        threadId: 'successful-thread',
        listSessions: jest.fn().mockResolvedValue({
          sessions: [{ sessionId: 'history-session', cwd: mockAgentProcessConfig.cwd, title: 'History Session' }],
        }),
      });
      const service = setupServiceWithMockFactory(jest.fn());
      (service as any).sessions.set('failed-session', failingThread);
      (service as any).sessions.set('successful-session', successfulThread);

      await expect(service.listSessions()).resolves.toEqual({
        sessions: [{ sessionId: 'history-session', cwd: mockAgentProcessConfig.cwd, title: 'History Session' }],
        nextCursor: undefined,
      });
    });

    it('throws a normalized error when every compatible thread fails to list sessions', async () => {
      const agentError = { message: 'session service unavailable', code: -32001, data: { service: 'session' } };
      const failingThread = createMockThread({
        listSessions: jest.fn().mockRejectedValue(agentError),
      });
      const service = setupServiceWithMockFactory(jest.fn());
      (service as any).sessions.set('failed-session', failingThread);

      let error: unknown;
      try {
        await service.listSessions();
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({
        message: 'session service unavailable',
        code: -32001,
        data: { service: 'session' },
        cause: agentError,
      });
    });

    it('releases an idle-thread reservation when its only list attempt fails', async () => {
      const { service, thread } = createService();
      thread.listSessions.mockRejectedValue(new Error('list failed'));

      await expect(service.listSessions({ cwd: mockAgentProcessConfig.cwd }, mockAgentProcessConfig)).rejects.toThrow(
        'list failed',
      );
      expect((service as any).reservedThreads.has(thread)).toBe(false);
      expect((service as any).sessions.size).toBe(0);
    });

    it('should return all active sessions', async () => {
      const { service } = createServiceWithAutoEvents();

      for (let i = 0; i < 2; i++) {
        const t = createMockThread({
          newSession: jest.fn().mockResolvedValue({ sessionId: `session-${i}` }),
          listSessions: jest.fn().mockResolvedValue({
            sessions: [{ sessionId: `session-${i}`, cwd: mockAgentProcessConfig.cwd, title: `Session ${i}` }],
          }),
          onEvent: jest.fn((cb: any) => {
            setTimeout(() => {
              cb({
                type: 'session_notification',
                notification: {
                  sessionId: `session-${i}`,
                  update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
                },
              });
            }, 10);
            return { dispose: jest.fn() };
          }),
        });
        (service as any).threadFactory.mockReturnValueOnce(t);
        await service.createSession(mockAgentProcessConfig);
      }

      const result = await service.listSessions();

      expect(result.sessions).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should initialize an idle thread to list sessions when no sessions are active', async () => {
      const { service, mockFactory, thread } = createService();
      thread.listSessions.mockResolvedValue({
        sessions: [{ sessionId: 'history-session', cwd: mockAgentProcessConfig.cwd, title: 'History Session' }],
        nextCursor: 'cursor-1',
      });

      const result = await service.listSessions({ cwd: mockAgentProcessConfig.cwd }, mockAgentProcessConfig);

      expect(mockFactory).toHaveBeenCalledTimes(1);
      expect(thread.initialize).toHaveBeenCalledWith(expect.objectContaining(mockAgentProcessConfig));
      expect(thread.listSessions).toHaveBeenCalledWith({ cwd: mockAgentProcessConfig.cwd });
      expect(result).toEqual({
        sessions: [{ sessionId: 'history-session', cwd: mockAgentProcessConfig.cwd, title: 'History Session' }],
        nextCursor: 'cursor-1',
      });
      expect((service as any).sessions.size).toBe(0);
      expect((service as any).reservedThreads.has(thread)).toBe(false);
    });

    it('显式配置列会话时应忽略不兼容的活跃线程并查询匹配配置', async () => {
      const { service, mockFactory, thread: activeThread } = createServiceWithAutoEvents();

      setTimeout(() => {
        activeThread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'new-session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);
      await service.createSession(mockAgentProcessConfig);

      const requestedConfig = {
        ...mockAgentProcessConfig,
        agentId: 'history-agent',
        args: ['test/bdd/fixtures/acp-agent/mock-acp-agent.mjs', '--fixture=history'],
      };
      const requestedThread = createMockThread({
        listSessions: jest.fn().mockResolvedValue({
          sessions: [{ sessionId: 'history-session', cwd: requestedConfig.cwd, title: 'History Session' }],
          nextCursor: 'history-cursor',
        }),
      });
      mockFactory.mockReturnValueOnce(requestedThread);

      const result = await service.listSessions({ cwd: requestedConfig.cwd }, requestedConfig);

      expect(activeThread.listSessions).not.toHaveBeenCalled();
      expect(requestedThread.initialize).toHaveBeenCalledWith(expect.objectContaining(requestedConfig));
      expect(requestedThread.listSessions).toHaveBeenCalledWith({ cwd: requestedConfig.cwd });
      expect(result).toEqual({
        sessions: [{ sessionId: 'history-session', cwd: requestedConfig.cwd, title: 'History Session' }],
        nextCursor: 'history-cursor',
      });
      expect((service as any).reservedThreads.has(requestedThread)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // setSessionMode
  // -----------------------------------------------------------------------

  describe('setSessionMode()', () => {
    it('should log but not throw for existing session', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const result = await service.createSession(mockAgentProcessConfig);
      await service.setSessionMode({ sessionId: result.sessionId, modeId: 'code' });

      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should throw if session not found', async () => {
      const { service } = createService();
      await expect(service.setSessionMode({ sessionId: 'nonexistent', modeId: 'code' })).rejects.toThrow(
        'No active session',
      );
    });
  });

  // -----------------------------------------------------------------------
  // getAvailableModes
  // -----------------------------------------------------------------------

  describe('getAvailableModes()', () => {
    it('should return null (not implemented yet)', async () => {
      const { service } = createService();
      const result = await service.getAvailableModes();
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Thread pool semantics
  // -----------------------------------------------------------------------

  describe('Thread pool semantics', () => {
    it('should reuse idle threads for new sessions', async () => {
      const { service, mockFactory, thread } = createServiceWithAutoEvents();

      // After first session, mark thread as needing reset (simulating bound session)
      thread.needsReset = true;

      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-1',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      // Create first session
      const result1 = await service.createSession(mockAgentProcessConfig);
      expect(mockFactory).toHaveBeenCalledTimes(1);

      // Dispose session (thread returns to pool as idle, but still needsReset=true)
      await service.disposeSession(result1.sessionId);

      // Reset the mock factory for next call tracking
      mockFactory.mockClear();
      mockFactory.mockReturnValue(thread); // Return same thread

      // Create second session - should reuse idle thread
      setTimeout(() => {
        thread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'session-2',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);

      const result2 = await service.createSession(mockAgentProcessConfig);
      expect(mockFactory).toHaveBeenCalledTimes(0); // No new thread created

      // The thread should have been reset (needsReset was true, so reset was called)
      expect(thread.reset).toHaveBeenCalled();
    });

    it('should dispose incompatible idle threads instead of reusing them for different agent process configs', async () => {
      const firstThread = createMockThread({
        newSession: jest.fn().mockResolvedValue({ sessionId: 'fixture-a-session' }),
      });
      const secondThread = createMockThread({
        newSession: jest.fn().mockResolvedValue({ sessionId: 'fixture-b-session' }),
      });
      const mockFactory = jest.fn().mockReturnValueOnce(firstThread).mockReturnValueOnce(secondThread);
      const service = setupServiceWithMockFactory(mockFactory);
      const configA = {
        ...mockAgentProcessConfig,
        args: ['mock-acp-agent.mjs', '--fixture=load-failure'],
        env: [{ name: 'OPENSUMI_ACP_BDD_FIXTURE', value: 'load-failure' }],
        threadPoolSize: 1,
      };
      const configB = {
        ...mockAgentProcessConfig,
        args: ['mock-acp-agent.mjs', '--fixture=history'],
        env: [{ name: 'OPENSUMI_ACP_BDD_FIXTURE', value: 'history' }],
        threadPoolSize: 1,
      };

      setTimeout(() => {
        firstThread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'fixture-a-session',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);
      const result1 = await service.createSession(configA);

      await service.disposeSession(result1.sessionId);

      setTimeout(() => {
        secondThread._fireEvent({
          type: 'session_notification',
          notification: {
            sessionId: 'fixture-b-session',
            update: { sessionUpdate: 'available_commands_update', availableCommands: [] },
          },
        });
      }, 10);
      const result2 = await service.createSession(configB);

      expect(result2.sessionId).toBe('fixture-b-session');
      expect(mockFactory).toHaveBeenCalledTimes(2);
      expect(firstThread.dispose).toHaveBeenCalledTimes(1);
      expect(firstThread.reset).not.toHaveBeenCalled();
      expect(secondThread.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ args: configB.args, env: configB.env }),
      );
    });

    it('should track maxPoolSize correctly', async () => {
      const { service } = createService();
      expect((service as any).maxPoolSize).toBe(DEFAULT_ACP_THREAD_POOL_SIZE);
    });

    it('should apply configured maxPoolSize from agent process config', async () => {
      const { service } = createService();
      (service as any).syncMaxPoolSize({ ...mockAgentProcessConfig, threadPoolSize: 4 });
      expect((service as any).maxPoolSize).toBe(4);
    });
  });

  // -----------------------------------------------------------------------
  // parseDataUrl
  // -----------------------------------------------------------------------

  describe('parseDataUrl()', () => {
    it('should extract mimeType and base64Data from data URLs', () => {
      const { service } = createService();
      const result = (service as any).parseDataUrl('data:image/png;base64,helloWorld');
      expect(result).toEqual({ mimeType: 'image/png', base64Data: 'helloWorld' });
    });

    it('should return default mimeType for non-data URLs', () => {
      const { service } = createService();
      const result = (service as any).parseDataUrl('not-a-data-url');
      expect(result).toEqual({ mimeType: 'image/jpeg', base64Data: 'not-a-data-url' });
    });
  });
});
