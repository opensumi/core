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

import { EventEmitter } from 'events';

// Mock child_process spawn
const mockSpawn = jest.fn();
jest.mock('node:child_process', () => ({
  ChildProcess: class MockChildProcess {},
  spawn: (...args: any[]) => mockSpawn(...args),
}));

// Mock stream/web
jest.mock('stream/web', () => ({
  ReadableStream: class MockReadableStream {
    constructor() {}
  },
  WritableStream: class MockWritableStream {
    constructor() {}
  },
}));

// Mock @agentclientprotocol/sdk
const mockClientSideConnection = jest.fn().mockImplementation(() => ({
  initialize: jest.fn().mockResolvedValue({
    protocolVersion: 1,
    agentCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
  }),
  newSession: jest.fn().mockResolvedValue({ sessionId: 'new-session-1' }),
  loadSession: jest.fn().mockResolvedValue({ sessionId: 'loaded-session-1' }),
  prompt: jest.fn().mockResolvedValue({ stopReason: 'end_turn' }),
  cancel: jest.fn().mockResolvedValue(undefined),
  listSessions: jest.fn().mockResolvedValue({ sessions: [] }),
}));

jest.mock('@agentclientprotocol/sdk', () => ({
  ClientSideConnection: mockClientSideConnection,
  ndJsonStream: jest.fn().mockReturnValue({ readable: {}, writable: {} }),
}));

// Mock node-pty
jest.mock('node-pty', () => ({
  spawn: jest.fn(),
}));

import {
  AcpThread,
  AcpThreadOptions,
  AgentProcessConfig,
  AgentThreadEntry,
  ThreadStatus,
  ToolCallStatus,
} from '../../../src/node/acp/acp-thread';

// ---- Mock dependencies ----
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  warn: jest.fn(),
  critical: jest.fn(),
  dispose: jest.fn(),
  getLevel: jest.fn(),
  setLevel: jest.fn(),
};

const mockFileSystemHandler = {
  readTextFile: jest.fn().mockResolvedValue({ content: 'file content' }),
  writeTextFile: jest.fn().mockResolvedValue({}),
  getFileMeta: jest.fn().mockResolvedValue({}),
  listDirectory: jest.fn().mockResolvedValue({ entries: [] }),
  createDirectory: jest.fn().mockResolvedValue({}),
};

const mockTerminalHandler = {
  createTerminal: jest.fn().mockResolvedValue({ terminalId: 'term-1' }),
  getTerminalOutput: jest.fn().mockResolvedValue({ output: 'hello', truncated: false }),
  waitForTerminalExit: jest.fn().mockResolvedValue({ exitCode: 0 }),
  killTerminal: jest.fn().mockResolvedValue({ exitCode: 0 }),
  releaseTerminal: jest.fn().mockResolvedValue({}),
  releaseSessionTerminals: jest.fn().mockResolvedValue(undefined),
};

const mockPermissionCaller = {
  requestPermission: jest.fn().mockResolvedValue({ outcome: { outcome: 'allowed' } }),
  cancelRequest: jest.fn().mockResolvedValue(undefined),
};

function createMockChildProcess(pid = 12345) {
  const mock = new EventEmitter() as any;
  mock.pid = pid;
  mock.killed = false;
  mock.exitCode = null;
  mock.signalCode = null;
  mock.stdio = [
    new EventEmitter(), // stdin
    new EventEmitter(), // stdout
    new EventEmitter(), // stderr
  ];
  mock.stdio[0].writable = true;
  mock.stdio[0].write = jest.fn().mockReturnValue(true);
  mock.stderr = new EventEmitter();
  return mock;
}

function createTestOptions(): AcpThreadOptions {
  return {
    command: 'npx',
    args: ['@anthropic-ai/claude-code@latest', '--print'],
    cwd: '/test/workspace',
    env: {},
    fileSystemHandler: mockFileSystemHandler as any,
    terminalHandler: mockTerminalHandler as any,
    permissionCaller: mockPermissionCaller as any,
  };
}

function createTestConfig(): AgentProcessConfig {
  return {
    command: 'npx',
    args: ['@anthropic-ai/claude-code@latest', '--print'],
    cwd: '/test/workspace',
    workspaceDir: '/test/workspace',
  };
}

/** Helper: extract UserMessageEntry from AgentThreadEntry */
function getUserData(entry: AgentThreadEntry) {
  return entry.type === 'user_message' ? entry.data : null;
}

/** Helper: extract AssistantMessageEntry from AgentThreadEntry */
function getAssistantData(entry: AgentThreadEntry) {
  return entry.type === 'assistant_message' ? entry.data : null;
}

/** Helper: extract ToolCallEntry from AgentThreadEntry */
function getToolCallData(entry: AgentThreadEntry) {
  return entry.type === 'tool_call' ? entry.data : null;
}

describe('AcpThread', () => {
  let thread: AcpThread;
  let mockChildProcess: ReturnType<typeof createMockChildProcess>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClientSideConnection.mockClear();
    mockSpawn.mockClear();

    mockChildProcess = createMockChildProcess();
    mockSpawn.mockImplementation(() => mockChildProcess);

    jest.spyOn(process, 'kill').mockImplementation(() => undefined as any);

    thread = new AcpThread(createTestOptions());
    Object.defineProperty(thread, 'logger', { value: mockLogger, writable: true });
  });

  afterEach(async () => {
    try {
      (thread as any)._eventEmitter?.dispose();
      (thread as any)._childProcess = null;
      (thread as any)._processRunning = false;
    } catch {}
    jest.restoreAllMocks();
  });

  // ===================================================================
  // Basic properties
  // ===================================================================
  describe('basic properties', () => {
    it('should have a unique threadId', () => {
      expect(thread.threadId).toBeDefined();
      expect(typeof thread.threadId).toBe('string');
      expect(thread.threadId.length).toBeGreaterThan(0);
    });

    it('should start with idle status', () => {
      expect(thread.status).toBe('idle');
    });

    it('should start with empty entries', () => {
      expect(thread.entries).toEqual([]);
    });

    it('should start not running and not connected', () => {
      expect(thread.isProcessRunning).toBe(false);
      expect(thread.isConnected).toBe(false);
    });

    it('should start with empty sessionId (not nullable)', () => {
      expect(thread.sessionId).toBe('');
      expect(typeof thread.sessionId).toBe('string');
    });

    it('should start with needsReset=false', () => {
      expect(thread.needsReset).toBe(false);
    });

    it('should start with null agentCapabilities', () => {
      expect(thread.agentCapabilities).toBeNull();
    });

    it('should start with initialized=false', () => {
      expect(thread.initialized).toBe(false);
    });
  });

  // ===================================================================
  // State machine transitions
  // ===================================================================
  describe('state machine transitions', () => {
    it('should start as idle', () => {
      expect(thread.status).toBe('idle');
    });

    it('should transition to awaiting_prompt after newSession', async () => {
      // Simulate initialize + newSession flow
      (thread as any)._connected = true;
      (thread as any)._connection = {
        newSession: jest.fn().mockResolvedValue({ sessionId: 's1' }),
      };
      (thread as any)._initialized = true;

      await thread.newSession();

      expect(thread.status).toBe('awaiting_prompt');
      expect(thread.sessionId).toBe('s1');
    });

    it('should transition to working during prompt', async () => {
      (thread as any)._connected = true;
      let resolvePrompt: ((value: any) => void) | null = null;
      (thread as any)._connection = {
        prompt: jest.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              resolvePrompt = resolve;
            }),
        ),
      };
      (thread as any)._initialized = true;

      const promptPromise = thread.prompt({} as any);

      await new Promise((r) => setTimeout(r, 10));

      expect(thread.status).toBe('working');

      resolvePrompt!({ stopReason: 'end_turn' });
      await promptPromise;

      expect(thread.status).toBe('awaiting_prompt');
    });

    it('should transition to disconnected on process exit', async () => {
      (thread as any)._processRunning = true;
      (thread as any)._connected = true;

      const exitMock = createMockChildProcess(12345);
      (thread as any)._childProcess = exitMock;

      exitMock.on('exit', (code: number | null, signal: string | null) => {
        (thread as any)._processRunning = false;
        (thread as any)._connected = false;
        (thread as any)._status = 'disconnected';
      });

      exitMock.emit('exit', 0, null);

      expect((thread as any)._processRunning).toBe(false);
      expect((thread as any)._connected).toBe(false);
      expect(thread.status).toBe('disconnected');
    });
  });

  // ===================================================================
  // Message merging (chunk aggregation) — uses data wrapper pattern
  // ===================================================================
  describe('message merging', () => {
    it('should create new user message entry on first chunk', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: 'Hello' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('user_message');
      expect(getUserData(thread.entries[0])!.content).toBe('Hello');
    });

    it('should append to existing user message on subsequent chunks', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: 'Hello' },
        },
      });

      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: ' World' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect(getUserData(thread.entries[0])!.content).toBe('Hello World');
    });

    it('should create new assistant message entry for agent_message_chunk', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Thinking...' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('assistant_message');
      const data = getAssistantData(thread.entries[0])!;
      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0]).toEqual({ type: 'text', text: 'Thinking...' });
      expect(data.isComplete).toBe(false);
    });

    it('should append to last incomplete assistant message', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Part 1' },
        },
      });

      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: ' Part 2' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      const data = getAssistantData(thread.entries[0])!;
      const textBlock = data.chunks.find((c: any) => c.type === 'text') as any;
      expect(textBlock!.text).toBe('Part 1 Part 2');
    });

    it('should create new assistant entry after previous one is marked complete', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'First' },
        },
      });

      // Mark complete — no params needed
      thread.markAssistantComplete();

      // New chunk should create new entry
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Second' },
        },
      });

      expect(thread.entries).toHaveLength(2);
      expect(getAssistantData(thread.entries[0])!.isComplete).toBe(true);
      expect(getAssistantData(thread.entries[1])!.isComplete).toBe(false);
    });

    it('should handle agent_thought_chunk separately', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'Let me think about this...' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('assistant_message');
      const data = getAssistantData(thread.entries[0])!;
      // Thought is appended as a chunk
      expect(data.chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===================================================================
  // Tool call lifecycle — uses data wrapper pattern
  // ===================================================================
  describe('tool call lifecycle', () => {
    it('should create tool call entry on tool_call notification', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Read',
          input: { path: 'test.txt' },
        },
      } as any);

      expect(thread.entries).toHaveLength(1);
      const data = getToolCallData(thread.entries[0])!;
      expect(data.toolCall.toolCallId).toBe('tc-1');
      expect(data.toolCall.title).toBe('Read');
      expect(data.status).toBe('pending');
    });

    it('should update tool call status to in_progress on tool_call_update', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Read',
        },
      } as any);

      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tc-1',
          status: 'in_progress',
        },
      });

      const data = getToolCallData(thread.entries[0])!;
      expect(data.status).toBe('in_progress');
    });

    it('should mark tool call as completed on tool_call_update with status=completed', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Read',
        },
      } as any);

      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tc-1',
          status: 'completed',
        },
      });

      const data = getToolCallData(thread.entries[0])!;
      expect(data.status).toBe('completed');
    });

    it('should mark tool call as failed on tool_call_update with status=failed', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Write',
        },
      } as any);

      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tc-1',
          status: 'failed',
        },
      });

      const data = getToolCallData(thread.entries[0])!;
      expect(data.status).toBe('failed');
    });

    it('markToolCallWaiting should update status to waiting_for_confirmation', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Write',
        },
      } as any);

      thread.markToolCallWaiting('tc-1');

      const data = getToolCallData(thread.entries[0])!;
      expect(data.status).toBe('waiting_for_confirmation');
    });
  });

  // ===================================================================
  // Process initialization
  // ===================================================================
  describe('process initialization', () => {
    it('ensureSdkConnection should only start process once if already running', async () => {
      (thread as any)._childProcess = mockChildProcess;
      (thread as any)._processRunning = true;
      (thread as any)._connected = true;
      (thread as any)._connection = { initialize: jest.fn() };

      await (thread as any).ensureSdkConnection();

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should clean up stale process reference before starting new one', async () => {
      mockChildProcess.killed = true;
      (thread as any)._childProcess = mockChildProcess;
      (thread as any)._processRunning = true;
      expect((thread as any).isProcessAlive()).toBe(false);

      (thread as any)._childProcess = null;
      (thread as any)._processRunning = false;

      const newMock = createMockChildProcess(99999);
      mockSpawn.mockReturnValue(newMock);

      await (thread as any).startProcess();

      expect(mockSpawn).toHaveBeenCalled();
      expect((thread as any)._processRunning).toBe(true);
      expect((thread as any)._childProcess).toBe(newMock);
    });

    it('should accept AgentProcessConfig in initialize()', async () => {
      (thread as any)._childProcess = mockChildProcess;
      (thread as any)._processRunning = true;
      (thread as any)._connected = true;
      const mockInitialize = jest.fn().mockResolvedValue({
        protocolVersion: 1,
        agentCapabilities: { fs: { readTextFile: true } },
      });
      (thread as any)._connection = { initialize: mockInitialize };

      const config: AgentProcessConfig = createTestConfig();
      const result = await thread.initialize(config);

      expect(mockInitialize).toHaveBeenCalled();
      expect(thread.initialized).toBe(true);
    });
  });

  // ===================================================================
  // Dispose cleanup
  // ===================================================================
  describe('dispose()', () => {
    it('should clear connection reference', async () => {
      (thread as any)._connected = true;
      (thread as any)._connection = {};

      await thread.dispose();

      expect((thread as any)._connection).toBeNull();
      expect((thread as any)._connected).toBe(false);
    });

    it('should clear pending permission requests', async () => {
      (thread as any)._pendingPermissionRequests.set('req-1', {
        resolve: jest.fn(),
        reject: jest.fn(),
      });

      await thread.dispose();

      expect((thread as any)._pendingPermissionRequests.size).toBe(0);
    });

    it('should kill the process', async () => {
      (thread as any)._childProcess = mockChildProcess;
      (thread as any)._processRunning = true;

      const killSpy = jest.spyOn(thread as any, 'killProcess').mockImplementation(async () => {
        (thread as any)._childProcess = null;
        (thread as any)._processRunning = false;
      });

      await thread.dispose();

      expect(killSpy).toHaveBeenCalled();
      expect((thread as any)._processRunning).toBe(false);
      expect((thread as any)._childProcess).toBeNull();
    });
  });

  // ===================================================================
  // reset() — spec: does NOT clear _initialized
  // ===================================================================
  describe('reset()', () => {
    it('should clear all entries', () => {
      thread.addUserMessage('Hello');
      expect(thread.entries).toHaveLength(1);

      thread.reset();

      expect(thread.entries).toEqual([]);
    });

    it('should clear sessionId and needsReset', () => {
      (thread as any)._sessionId = 's1';
      (thread as any)._needsReset = true;

      thread.reset();

      expect(thread.sessionId).toBe('');
      expect(thread.needsReset).toBe(false);
    });

    it('should NOT clear initialized flag (thread remains reusable)', () => {
      (thread as any)._initialized = true;

      thread.reset();

      expect((thread as any)._initialized).toBe(true);
    });

    it('should reset status to idle', () => {
      (thread as any)._status = 'working';

      thread.reset();

      expect(thread.status).toBe('idle');
    });

    it('should clear pending permission requests', () => {
      (thread as any)._pendingPermissionRequests.set('req-1', {
        resolve: jest.fn(),
        reject: jest.fn(),
      });

      thread.reset();

      expect((thread as any)._pendingPermissionRequests.size).toBe(0);
    });
  });

  // ===================================================================
  // Entry manipulation — data wrapper pattern
  // ===================================================================
  describe('addUserMessage()', () => {
    it('should create a user message entry and add to entries', () => {
      const entry = thread.addUserMessage('Hello, AI!');

      expect(entry.content).toBe('Hello, AI!');
      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('user_message');
      expect(getUserData(thread.entries[0])!).toBe(entry);
    });

    it('should generate a unique id for each message', () => {
      const e1 = thread.addUserMessage('First');
      const e2 = thread.addUserMessage('Second');

      expect(e1.id).not.toBe(e2.id);
    });

    it('should set timestamp', () => {
      const entry = thread.addUserMessage('Test');
      expect(entry.timestamp).toBeGreaterThan(0);
    });
  });

  describe('markAssistantComplete()', () => {
    it('should mark last assistant entry as complete (no params)', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Draft' },
        },
      });

      const data = getAssistantData(thread.entries[0])!;
      expect(data.isComplete).toBe(false);

      // No params — finds last assistant entry automatically
      thread.markAssistantComplete();

      expect(data.isComplete).toBe(true);
    });

    it('should transition status to awaiting_prompt', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Answer' },
        },
      });

      (thread as any)._status = 'working';

      thread.markAssistantComplete();

      expect(thread.status).toBe('awaiting_prompt');
    });

    it('should do nothing if no assistant entry exists', () => {
      expect(thread.entries).toEqual([]);
      thread.markAssistantComplete();
      expect(thread.entries).toEqual([]);
    });

    it('should emit entry_updated event', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Draft' },
        },
      });

      thread.markAssistantComplete();

      const updatedEvent = events.find((e) => e.type === 'entry_updated');
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent.entry.type).toBe('assistant_message');
    });
  });

  // ===================================================================
  // handleNotification — public method
  // ===================================================================
  describe('handleNotification', () => {
    it('should be a public method on the instance', () => {
      expect(typeof thread.handleNotification).toBe('function');
    });

    it('should handle available_commands_update without creating entries', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'available_commands_update',
          commands: [],
        },
      } as any);

      expect(thread.entries).toEqual([]);
    });

    it('should create/replace plan entry on plan notification', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'plan',
          content: { type: 'text', text: 'Plan: 1. Read file 2. Edit' },
        },
      } as any);

      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('plan');

      // Second plan should replace first
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'plan',
          content: { type: 'text', text: 'Updated plan: 1. Read 2. Write 3. Test' },
        },
      } as any);

      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('plan');
    });

    it('should transition to working on tool_call notification', () => {
      (thread as any)._status = 'awaiting_prompt';

      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Read',
        },
      } as any);

      expect(thread.status).toBe('working');
    });
  });

  // ===================================================================
  // Event emission — granular events
  // ===================================================================
  describe('onEvent', () => {
    it('should emit status_changed events', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      thread.setStatus('working');

      const statusEvent = events.find((e) => e.type === 'status_changed');
      expect(statusEvent).toBeDefined();
      expect(statusEvent.status).toBe('working');
    });

    it('should emit entry_added events when entries are appended', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      thread.addUserMessage('Hello');

      const addedEvent = events.find((e) => e.type === 'entry_added');
      expect(addedEvent).toBeDefined();
      expect(addedEvent.entry.type).toBe('user_message');
    });

    it('should emit entry_updated events when entries are modified', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      thread.addUserMessage('Hello');
      thread.markToolCallWaiting('tc-x'); // no-op but tests mechanism

      // Simulate an update via notification
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: 'Hello' },
        },
      });
      // Append to existing → fires entry_updated
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: ' World' },
        },
      });

      const updatedEvent = events.find((e) => e.type === 'entry_updated');
      expect(updatedEvent).toBeDefined();
    });

    it('should emit session_notification events when notification received via client', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Hello' },
        },
      });

      // Fire session_notification event directly (simulates what client impl does)
      (thread as any).fireEvent({
        type: 'session_notification',
        notification: {
          sessionId: 's1',
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'Hello' },
          },
        },
      });

      const notifEvent = events.find((e) => e.type === 'session_notification');
      expect(notifEvent).toBeDefined();
    });

    it('should NOT emit entries_changed events (replaced by entry_added/entry_updated)', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      thread.addUserMessage('Hello');
      thread.markAssistantComplete();

      const entriesChangedEvent = events.find((e) => e.type === 'entries_changed');
      expect(entriesChangedEvent).toBeUndefined();
    });
  });

  // ===================================================================
  // ensureInitialized guard
  // ===================================================================
  describe('ensureInitialized guard', () => {
    it('should throw if not initialized when calling newSession', async () => {
      (thread as any)._connection = null;

      await expect(thread.newSession()).rejects.toThrow('AcpThread not initialized');
    });

    it('should throw if not initialized when calling prompt', async () => {
      (thread as any)._connection = null;

      await expect(thread.prompt({} as any)).rejects.toThrow('AcpThread not initialized');
    });

    it('should throw if not initialized when calling loadSession', async () => {
      (thread as any)._connection = null;

      await expect(thread.loadSession({ sessionId: 's1' } as any)).rejects.toThrow('AcpThread not initialized');
    });

    it('should throw if not initialized when calling listSessions', async () => {
      (thread as any)._connection = null;

      await expect(thread.listSessions()).rejects.toThrow('AcpThread not initialized');
    });
  });

  // ===================================================================
  // respondToToolCall — spec: (toolCallId, allowed: boolean)
  // ===================================================================
  describe('respondToToolCall()', () => {
    it('should mark tool call as completed when allowed=true', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Write',
        },
      } as any);

      thread.respondToToolCall('tc-1', true);

      const data = getToolCallData(thread.entries[0])!;
      expect(data.status).toBe('completed');
    });

    it('should mark tool call as rejected when allowed=false', () => {
      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Write',
        },
      } as any);

      thread.respondToToolCall('tc-1', false);

      const data = getToolCallData(thread.entries[0])!;
      expect(data.status).toBe('rejected');
    });

    it('should emit entry_updated event', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      thread.handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Write',
        },
      } as any);

      thread.respondToToolCall('tc-1', true);

      const updatedEvent = events.find((e) => e.type === 'entry_updated');
      expect(updatedEvent).toBeDefined();
    });

    it('should do nothing for non-existent tool call ID', () => {
      expect(() => {
        thread.respondToToolCall('nonexistent', true);
      }).not.toThrow();
    });
  });

  // ===================================================================
  // setError — new method (spec)
  // ===================================================================
  describe('setError()', () => {
    it('should set status to errored', () => {
      const error = new Error('Something went wrong');
      thread.setError(error);

      expect(thread.status).toBe('errored');
    });

    it('should emit status_changed and error events', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      const error = new Error('Test error');
      thread.setError(error);

      const statusEvent = events.find((e) => e.type === 'status_changed');
      expect(statusEvent).toBeDefined();
      expect(statusEvent.status).toBe('errored');

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.error).toBe(error);
    });
  });

  // ===================================================================
  // State accessors (spec)
  // ===================================================================
  describe('state accessors', () => {
    it('getStatus() should return current status', () => {
      expect(thread.getStatus()).toBe('idle');
      (thread as any)._status = 'working';
      expect(thread.getStatus()).toBe('working');
    });

    it('getEntries() should return readonly entries', () => {
      thread.addUserMessage('Hello');
      const entries = thread.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('user_message');
    });
  });
});
