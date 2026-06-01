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

import { INodeLogger } from '@opensumi/ide-core-node';

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

  describe('getSessionMcpServers()', () => {
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

    it('should throw when thread pool is full and no idle threads', async () => {
      const { service, thread } = createServiceWithAutoEvents();

      const maxPoolSize = (service as any).maxPoolSize;
      // Fill the pool with max threads
      const createdThreads: MockThread[] = [];
      for (let i = 0; i < maxPoolSize; i++) {
        const t = createMockThread({
          getStatus: jest.fn().mockReturnValue('working'),
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
        await service.createSession(mockAgentProcessConfig);
      }

      // Now try to create another session - should fail
      const failThread = createMockThread();
      (service as any).threadFactory.mockReturnValue(failThread);
      await expect(service.createSession(mockAgentProcessConfig)).rejects.toThrow('Thread pool is full');
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
        await service.createSession(mockAgentProcessConfig);
      }

      threads[0].newSession.mockResolvedValueOnce({ sessionId: 'session-3' });
      const result = await service.createSession(mockAgentProcessConfig);

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

    it('should not synthesize historyUpdates from local entries', async () => {
      const thread = createMockThread({
        initialized: true,
        getStatus: jest.fn().mockReturnValue('idle'),
        getEntries: jest.fn().mockReturnValue([
          {
            type: 'user_message',
            data: { id: 'msg-1', content: 'local prompt', timestamp: 1 },
          },
        ]),
        getSessionNotifications: jest.fn().mockReturnValue([]),
        onEvent: jest.fn(() => ({ dispose: jest.fn() })),
      });
      const mockFactory = jest.fn().mockReturnValue(thread);
      const service = setupServiceWithMockFactory(mockFactory);

      const result = await service.loadSession('existing-session-id', mockAgentProcessConfig);

      expect(result.historyUpdates).toEqual([]);
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

    it('should throw when pool is full and no idle thread', async () => {
      const { service } = createServiceWithAutoEvents();

      const maxPoolSize = (service as any).maxPoolSize;
      // Fill the pool
      for (let i = 0; i < maxPoolSize; i++) {
        const t = createMockThread({
          getStatus: jest.fn().mockReturnValue('working'),
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

      await expect(service.loadSession('new-session', mockAgentProcessConfig)).rejects.toThrow('Thread pool is full');
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
        await service.createSession(mockAgentProcessConfig);
      }

      const result = await service.loadSession('session-3', mockAgentProcessConfig);

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
        await service.createSession(mockAgentProcessConfig);
      }

      const firstReleaseGate = createDeferred<void>();
      mockTerminalHandler.releaseSessionTerminals.mockImplementation(async (sessionId: string) => {
        if (sessionId === 'session-0') {
          await firstReleaseGate.promise;
        }
      });

      const firstLoad = service.loadSession('session-3', mockAgentProcessConfig);
      await flushAsyncWork();
      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('session-0');

      const secondLoad = service.loadSession('session-4', mockAgentProcessConfig);
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
        await service.createSession(mockAgentProcessConfig);
      }

      await service.loadSessionOrNew('session-3', mockAgentProcessConfig);

      expect(threads[0].loadSessionOrNew).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-3', cwd: mockAgentProcessConfig.cwd }),
      );
      expect((service as any).reservedThreads.has(threads[0])).toBe(false);
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
        await service.createSession(mockAgentProcessConfig);
      }

      threads[0].newSession.mockResolvedValueOnce({ sessionId: 'session-3' });
      await service.createSession(mockAgentProcessConfig);

      expect((service as any).sessions.has('session-0')).toBe(false);

      const stream = service.sendMessage({ prompt: 'Hello again', sessionId: 'session-0' }, mockAgentProcessConfig);
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
        await service.createSession(mockAgentProcessConfig);
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

    it('should track maxPoolSize correctly', async () => {
      const { service } = createService();
      expect((service as any).maxPoolSize).toBe(3);
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
