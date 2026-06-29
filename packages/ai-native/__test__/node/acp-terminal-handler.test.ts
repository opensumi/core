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

// Mock node-pty
const mockPtyProcess = {
  pid: 12345,
  onData: jest.fn(),
  onExit: jest.fn(),
  kill: jest.fn(),
};

jest.mock('node-pty', () => ({
  spawn: jest.fn(() => mockPtyProcess),
}));

import pty from 'node-pty';

import { AcpTerminalHandler, AcpTerminalHandlerToken } from '../../src/node/acp/handlers/terminal.handler';

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

describe('AcpTerminalHandler', () => {
  let handler: AcpTerminalHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockPtyProcess.onData = jest.fn();
    mockPtyProcess.onExit = jest.fn();
    mockPtyProcess.kill = jest.fn();

    handler = new AcpTerminalHandler();
    Object.defineProperty(handler, 'logger', { value: mockLogger, writable: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('configure()', () => {
    it('should set output limit', () => {
      handler.configure({ outputLimit: 2048 });

      expect((handler as any).defaultOutputLimit).toBe(2048);
    });

    it('should not change limit if not provided', () => {
      const original = (handler as any).defaultOutputLimit;
      handler.configure({});

      expect((handler as any).defaultOutputLimit).toBe(original);
    });
  });

  describe('createTerminal()', () => {
    const baseRequest = {
      sessionId: 'sess-1',
      command: 'bash',
      args: ['-c', 'echo hello'],
    };

    it('should create terminal and return terminalId', async () => {
      const result = await handler.createTerminal(baseRequest);

      expect(result.terminalId).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(pty.spawn).toHaveBeenCalledWith('bash', ['-c', 'echo hello'], expect.any(Object));
    });

    it('should merge environment variables', async () => {
      await handler.createTerminal({
        sessionId: 'sess-1',
        command: 'bash',
        env: { MY_VAR: 'test' },
      });

      const spawnCall = (pty.spawn as jest.Mock).mock.calls[0];
      expect(spawnCall[2].env).toHaveProperty('MY_VAR', 'test');
      expect(spawnCall[2].env).toHaveProperty('PATH', process.env.PATH);
    });

    it('should use custom cwd', async () => {
      await handler.createTerminal({
        sessionId: 'sess-1',
        command: 'bash',
        cwd: '/custom/path',
      });

      const spawnCall = (pty.spawn as jest.Mock).mock.calls[0];
      expect(spawnCall[2].cwd).toBe('/custom/path');
    });

    it('should use default cwd when not provided', async () => {
      await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });

      const spawnCall = (pty.spawn as jest.Mock).mock.calls[0];
      expect(spawnCall[2].cwd).toBe(process.cwd());
    });

    it('should set outputByteLimit from request', async () => {
      const result = await handler.createTerminal({
        sessionId: 'sess-1',
        command: 'bash',
        outputByteLimit: 512,
      });

      const terminalId = result.terminalId!;
      const session = (handler as any).terminals.get(terminalId);
      expect(session.outputByteLimit).toBe(512);
    });

    it('should use default outputByteLimit when not provided', async () => {
      const result = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });

      const terminalId = result.terminalId!;
      const session = (handler as any).terminals.get(terminalId);
      expect(session.outputByteLimit).toBe((handler as any).defaultOutputLimit);
    });

    it('should handle spawn error', async () => {
      (pty.spawn as jest.Mock).mockImplementationOnce(() => {
        throw new Error('spawn failed');
      });

      const result = await handler.createTerminal(baseRequest);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('spawn failed');
    });
  });

  describe('getTerminalOutput()', () => {
    it('should return terminal not found error for unknown terminal', async () => {
      const result = await handler.getTerminalOutput('unknown', 'sess-1');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Terminal not found');
    });

    it('should return session mismatch error', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const result = await handler.getTerminalOutput(terminalId, 'sess-2');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Session mismatch');
    });

    it('should return output buffer', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      // Simulate output
      const session = (handler as any).terminals.get(terminalId);
      session.outputBuffer = 'hello world';

      const result = await handler.getTerminalOutput(terminalId, 'sess-1');

      expect(result.output).toBe('hello world');
      expect(result.truncated).toBe(false);
    });

    it('should return truncated flag when buffer exceeds limit', async () => {
      const createResult = await handler.createTerminal({
        sessionId: 'sess-1',
        command: 'bash',
        outputByteLimit: 10,
      });
      const terminalId = createResult.terminalId!;

      const session = (handler as any).terminals.get(terminalId);
      session.outputBuffer = 'This is a long output string that exceeds the limit';

      const result = await handler.getTerminalOutput(terminalId, 'sess-1');

      expect(result.truncated).toBe(true);
    });

    it('should return exitStatus when terminal has exited', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const session = (handler as any).terminals.get(terminalId);
      session.exited = true;
      session.exitCode = 0;

      const result = await handler.getTerminalOutput(terminalId, 'sess-1');

      expect(result.exitStatus).toBe(0);
    });

    it('should return undefined exitStatus when still running', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const result = await handler.getTerminalOutput(terminalId, 'sess-1');

      expect(result.exitStatus).toBeUndefined();
    });
  });

  describe('waitForTerminalExit()', () => {
    it('should return immediately when already exited', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const session = (handler as any).terminals.get(terminalId);
      session.exited = true;
      session.exitCode = 42;

      const result = await handler.waitForTerminalExit(terminalId, 'sess-1');

      expect(result.exitCode).toBe(42);
    });

    it('should return terminal not found error', async () => {
      const result = await handler.waitForTerminalExit('unknown', 'sess-1');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Terminal not found');
    });

    it('should return session mismatch error', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const result = await handler.waitForTerminalExit(terminalId, 'sess-2');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Session mismatch');
    });

    it('should return empty object on timeout', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const exitPromise = handler.waitForTerminalExit(terminalId, 'sess-1');

      jest.advanceTimersByTime(31000);

      const result = await exitPromise;
      expect(result.exitCode).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should return exitCode when terminal exits within timeout', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const exitPromise = handler.waitForTerminalExit(terminalId, 'sess-1');

      // Simulate terminal exit
      const session = (handler as any).terminals.get(terminalId);
      session.exited = true;
      session.exitCode = 0;

      jest.advanceTimersByTime(200);

      const result = await exitPromise;
      expect(result.exitCode).toBe(0);
    });
  });

  describe('killTerminal()', () => {
    it('should return terminal not found error', async () => {
      const result = await handler.killTerminal('unknown', 'sess-1');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Terminal not found');
    });

    it('should return session mismatch error', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const result = await handler.killTerminal(terminalId, 'sess-2');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Session mismatch');
    });

    it('should return empty when already exited', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const session = (handler as any).terminals.get(terminalId);
      session.exited = true;
      session.exitCode = 1;

      const result = await handler.killTerminal(terminalId, 'sess-1');

      expect(result.error).toBeUndefined();
      expect(mockPtyProcess.kill).not.toHaveBeenCalled();
    });

    it('should kill the PTY process', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const killPromise = handler.killTerminal(terminalId, 'sess-1');

      // Simulate exit after kill
      jest.advanceTimersByTime(50);
      const session = (handler as any).terminals.get(terminalId);
      session.exited = true;
      session.exitCode = -1;

      jest.advanceTimersByTime(200);

      const result = await killPromise;
      expect(mockPtyProcess.kill).toHaveBeenCalled();
    });
  });

  describe('releaseTerminal()', () => {
    it('should return empty when terminal does not exist', async () => {
      const result = await handler.releaseTerminal('unknown', 'sess-1');

      expect(result).toEqual({});
    });

    it('should return session mismatch error', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      const result = await handler.releaseTerminal(terminalId, 'sess-2');

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Session mismatch');
    });

    it('should remove terminal from tracking map', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      await handler.releaseTerminal(terminalId, 'sess-1');

      expect((handler as any).terminals.has(terminalId)).toBe(false);
    });

    it('should kill PTY process if not exited', async () => {
      const createResult = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const terminalId = createResult.terminalId!;

      await handler.releaseTerminal(terminalId, 'sess-1');

      expect(mockPtyProcess.kill).toHaveBeenCalled();
    });
  });

  describe('releaseSessionTerminals()', () => {
    it('should release all terminals for a session', async () => {
      const r1 = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const r2 = await handler.createTerminal({ sessionId: 'sess-1', command: 'ls' });
      await handler.createTerminal({ sessionId: 'sess-2', command: 'bash' });

      const termId1 = r1.terminalId!;
      const termId2 = r2.terminalId!;

      await handler.releaseSessionTerminals('sess-1');

      expect((handler as any).terminals.has(termId1)).toBe(false);
      expect((handler as any).terminals.has(termId2)).toBe(false);
      expect((handler as any).terminals.size).toBe(1);
    });

    it('should do nothing when no terminals exist for session', async () => {
      await handler.releaseSessionTerminals('non-existent');

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Released 0 terminals'));
    });
  });

  describe('getSessionTerminals()', () => {
    it('should return terminal IDs for a session', async () => {
      const r1 = await handler.createTerminal({ sessionId: 'sess-1', command: 'bash' });
      const r2 = await handler.createTerminal({ sessionId: 'sess-1', command: 'ls' });
      await handler.createTerminal({ sessionId: 'sess-2', command: 'bash' });

      const ids = handler.getSessionTerminals('sess-1');

      expect(ids).toContain(r1.terminalId);
      expect(ids).toContain(r2.terminalId);
      expect(ids).toHaveLength(2);
    });

    it('should return empty array for session with no terminals', () => {
      const ids = handler.getSessionTerminals('non-existent');
      expect(ids).toEqual([]);
    });
  });
});
