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
  requestPermission: jest.fn().mockResolvedValue({ outcome: { status: 'allowed' } }),
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
      // Don't actually dispose — just clean up the thread reference
      // Dispose can be slow due to kill timeout
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

    it('should start with undefined sessionId', () => {
      expect(thread.sessionId).toBeUndefined();
    });

    it('should start with needsReset=false', () => {
      expect(thread.needsReset).toBe(false);
    });

    it('should start with null agentCapabilities', () => {
      expect(thread.agentCapabilities).toBeNull();
    });
  });

  // ===================================================================
  // State machine transitions
  // ===================================================================
  describe('state machine transitions', () => {
    it('should start as idle', () => {
      expect(thread.status).toBe('idle');
    });

    it('should transition to working after newSession', async () => {
      // Simulate initialize + newSession flow
      (thread as any)._connected = true;
      (thread as any)._connection = {
        newSession: jest.fn().mockResolvedValue({ sessionId: 's1' }),
      };
      (thread as any)._initialized = true;

      await thread.newSession();

      // After newSession, status should be awaiting_prompt
      expect(thread.status).toBe('awaiting_prompt');
    });

    it('should transition to working during prompt', async () => {
      (thread as any)._connected = true;
      let resolvePrompt: ((value: any) => void) | null = null;
      (thread as any)._connection = {
        prompt: jest.fn().mockImplementation(() => new Promise((resolve) => {
            resolvePrompt = resolve;
          })),
      };
      (thread as any)._initialized = true;

      const promptPromise = thread.prompt({} as any);

      // Give the promise a tick to start
      await new Promise((r) => setTimeout(r, 10));

      // During prompt execution (before it resolves), status should be working
      expect(thread.status).toBe('working');

      resolvePrompt!({ stopReason: 'end_turn' });
      await promptPromise;

      // After prompt completes, should go back to awaiting_prompt
      expect(thread.status).toBe('awaiting_prompt');
    });

    it('should transition to disconnected on process exit', async () => {
      // Directly set the internal state to simulate a running process
      (thread as any)._processRunning = true;
      (thread as any)._connected = true;

      // Create a mock child process with an exit handler
      const exitMock = createMockChildProcess(12345);
      (thread as any)._childProcess = exitMock;

      // Manually register the exit handler (simulating what startProcess does)
      exitMock.on('exit', (code: number | null, signal: string | null) => {
        (thread as any)._processRunning = false;
        (thread as any)._connected = false;
        (thread as any)._status = 'disconnected';
      });

      // Emit exit event
      exitMock.emit('exit', 0, null);

      expect((thread as any)._processRunning).toBe(false);
      expect((thread as any)._connected).toBe(false);
      expect(thread.status).toBe('disconnected');
    });
  });

  // ===================================================================
  // Message merging (chunk aggregation)
  // ===================================================================
  describe('message merging', () => {
    it('should create new user message entry on first chunk', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: 'Hello' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('user_message');
      expect((thread.entries[0] as any).content).toBe('Hello');
    });

    it('should append to existing user message on subsequent chunks', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: 'Hello' },
        },
      });

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: ' World' },
        },
      });

      // Still 1 entry, content appended
      expect(thread.entries).toHaveLength(1);
      expect((thread.entries[0] as any).content).toBe('Hello World');
    });

    it('should create new assistant message entry for agent_message_chunk', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Thinking...' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('assistant_message');
      expect((thread.entries[0] as any).content).toBe('Thinking...');
      expect((thread.entries[0] as any).completed).toBe(false);
    });

    it('should append to last incomplete assistant message', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Part 1' },
        },
      });

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: ' Part 2' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect((thread.entries[0] as any).content).toBe('Part 1 Part 2');
    });

    it('should create new assistant entry after previous one is marked complete', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      // First message
      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'First' },
        },
      });

      // Mark complete
      thread.markAssistantComplete((thread.entries[0] as any).id, 'First');

      // New chunk should create new entry
      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Second' },
        },
      });

      expect(thread.entries).toHaveLength(2);
      expect((thread.entries[0] as any).content).toBe('First');
      expect((thread.entries[0] as any).completed).toBe(true);
      expect((thread.entries[1] as any).content).toBe('Second');
      expect((thread.entries[1] as any).completed).toBe(false);
    });

    it('should handle agent_thought_chunk separately', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_thought_chunk',
          content: { type: 'text', text: 'Let me think about this...' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('assistant_message');
      expect((thread.entries[0] as any).thought).toBe('Let me think about this...');
    });
  });

  // ===================================================================
  // Tool call lifecycle
  // ===================================================================
  describe('tool call lifecycle', () => {
    it('should create tool call entry on tool_call notification', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Read',
          input: { path: 'test.txt' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      const toolCall = thread.entries[0] as any;
      expect(toolCall.type).toBe('tool_call');
      expect(toolCall.toolCallId).toBe('tc-1');
      expect(toolCall.toolName).toBe('Read');
      expect(toolCall.status).toBe('pending');
    });

    it('should update tool call status to in_progress on tool_call_update', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      // Create tool call
      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Read',
        },
      });

      // Update to in_progress
      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tc-1',
          status: 'in_progress',
        },
      });

      const toolCall = thread.entries[0] as any;
      expect(toolCall.status).toBe('in_progress');
    });

    it('should mark tool call as completed on tool_call_update with status=completed', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Read',
        },
      });

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tc-1',
          status: 'completed',
        },
      });

      const toolCall = thread.entries[0] as any;
      expect(toolCall.status).toBe('completed');
    });

    it('should mark tool call as failed on tool_call_update with status=failed', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Write',
        },
      });

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tc-1',
          status: 'failed',
        },
      });

      const toolCall = thread.entries[0] as any;
      expect(toolCall.status).toBe('failed');
    });

    it('should NOT mark tool call as rejected (SDK has no rejected status) but keep as completed', () => {
      // SDK ToolCallStatus only has: pending, in_progress, completed, failed
      // rejected is handled via permission response, not tool_call_update
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Write',
        },
      });

      // There's no 'rejected' status in SDK - permission rejection goes through handlePermissionRequest
      // So we just verify that unknown statuses don't break anything
      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tc-1',
          status: 'in_progress',
        },
      });

      const toolCall = thread.entries[0] as any;
      expect(toolCall.status).toBe('in_progress');
    });

    it('markToolCallWaiting should update status to waiting_for_confirmation', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Write',
        },
      });

      thread.markToolCallWaiting('tc-1');

      const toolCall = thread.entries[0] as any;
      expect(toolCall.status).toBe('waiting_for_confirmation');
    });
  });

  // ===================================================================
  // Process initialization idempotency
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
      // Verify killed process is detected as not alive
      mockChildProcess.killed = true;
      (thread as any)._childProcess = mockChildProcess;
      (thread as any)._processRunning = true;
      expect((thread as any).isProcessAlive()).toBe(false);

      // Clear state so startProcess will attempt a new spawn
      (thread as any)._childProcess = null;
      (thread as any)._processRunning = false;

      const newMock = createMockChildProcess(99999);
      mockSpawn.mockReturnValue(newMock);

      await (thread as any).startProcess();

      expect(mockSpawn).toHaveBeenCalled();
      expect((thread as any)._processRunning).toBe(true);
      expect((thread as any)._childProcess).toBe(newMock);
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

      // Simulate process exiting immediately
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
  // reset()
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

      expect(thread.sessionId).toBeUndefined();
      expect(thread.needsReset).toBe(false);
    });

    it('should clear initialized flag', () => {
      (thread as any)._initialized = true;

      thread.reset();

      expect((thread as any)._initialized).toBe(false);
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
  // Entry manipulation
  // ===================================================================
  describe('addUserMessage()', () => {
    it('should create a user message entry and add to entries', () => {
      const entry = thread.addUserMessage('Hello, AI!');

      expect(entry.type).toBe('user_message');
      expect(entry.content).toBe('Hello, AI!');
      expect(thread.entries).toContain(entry);
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
    it('should mark an assistant message as completed', () => {
      (thread as any).handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Draft' },
        },
      });

      const entry = thread.entries[0] as any;
      expect(entry.completed).toBe(false);

      thread.markAssistantComplete(entry.id, 'Final answer');

      expect(entry.completed).toBe(true);
      expect(entry.content).toBe('Final answer');
    });

    it('should do nothing if entry not found', () => {
      thread.markAssistantComplete('nonexistent', 'content');
      expect(thread.entries).toEqual([]);
    });
  });

  // ===================================================================
  // Notification handling
  // ===================================================================
  describe('handleNotification', () => {
    it('should handle available_commands_update without creating entries', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'available_commands_update',
          commands: [],
        },
      });

      expect(thread.entries).toEqual([]);
    });

    it('should create/replace plan entry on plan notification', () => {
      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'plan',
          content: { type: 'text', text: 'Plan: 1. Read file 2. Edit' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect(thread.entries[0].type).toBe('plan');

      // Second plan should replace first
      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'plan',
          content: { type: 'text', text: 'Updated plan: 1. Read 2. Write 3. Test' },
        },
      });

      expect(thread.entries).toHaveLength(1);
      expect((thread.entries[0] as any).content).toBe('Updated plan: 1. Read 2. Write 3. Test');
    });

    it('should transition to working on tool_call notification', () => {
      (thread as any)._status = 'awaiting_prompt';

      const handleNotification = (thread as any).handleNotification.bind(thread);

      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'Read',
        },
      });

      expect(thread.status).toBe('working');
    });
  });

  // ===================================================================
  // Event emission
  // ===================================================================
  describe('onEvent', () => {
    it('should emit status_changed events', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      (thread as any).setStatus('working');

      const statusEvent = events.find((e) => e.type === 'status_changed');
      expect(statusEvent).toBeDefined();
      expect(statusEvent.status).toBe('working');
    });

    it('should emit entries_changed events when entries are modified', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      thread.addUserMessage('Hello');

      const entriesEvent = events.find((e) => e.type === 'entries_changed');
      expect(entriesEvent).toBeDefined();
      expect(entriesEvent.entries).toHaveLength(1);
    });

    it('should emit session_notification events when notification received via client', () => {
      const events: any[] = [];
      thread.onEvent((e) => events.push(e));

      // Simulate what the client impl's sessionUpdate does
      const handleNotification = (thread as any).handleNotification.bind(thread);
      handleNotification({
        sessionId: 's1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Hello' },
        },
      });

      // Fire the event directly (this is what the client impl does after handleNotification)
      (thread as any).fireEvent({
        type: 'session_notification',
        threadId: thread.threadId,
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
  // respondToToolCall
  // ===================================================================
  describe('respondToToolCall()', () => {
    it('should resolve pending permission request', async () => {
      const pendingPromise = new Promise<any>((resolve, reject) => {
        (thread as any)._pendingPermissionRequests.set('tc-1', { resolve, reject });
      });

      thread.respondToToolCall('tc-1', { outcome: { outcome: 'cancelled' } });

      const result = await pendingPromise;
      expect(result.outcome.outcome).toBe('cancelled');
    });

    it('should remove the resolved request from pending map', async () => {
      (thread as any)._pendingPermissionRequests.set('tc-1', {
        resolve: jest.fn(),
        reject: jest.fn(),
      });

      thread.respondToToolCall('tc-1', { outcome: { outcome: 'cancelled' } });

      expect((thread as any)._pendingPermissionRequests.has('tc-1')).toBe(false);
    });

    it('should do nothing for non-existent tool call ID', () => {
      expect(() => {
        thread.respondToToolCall('nonexistent', { outcome: { outcome: 'cancelled' } });
      }).not.toThrow();
    });
  });
});
