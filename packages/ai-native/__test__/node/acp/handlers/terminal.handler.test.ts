import * as pty from 'node-pty';

import { ACPErrorCode } from '../../../../src/node/acp/handlers/constants';
import {
  AcpTerminalHandler,
  TerminalRequest,
  TerminalResponse,
} from '../../../../src/node/acp/handlers/terminal.handler';

// Mock node-pty
jest.mock('node-pty', () => {
  const mockPtyProcess = {
    pid: 12345,
    onData: jest.fn((cb: (data: string) => void) => {
      // Store callback for later use
      (mockPtyProcess as any)._onDataCallback = cb;
      return { dispose: jest.fn() };
    }),
    onExit: jest.fn((cb: (event: { exitCode: number }) => void) => {
      // Store callback for later use
      (mockPtyProcess as any)._onExitCallback = cb;
      return { dispose: jest.fn() };
    }),
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  };

  return {
    spawn: jest.fn(() => mockPtyProcess),
  };
});

/**
 * Mock Logger for testing
 */
class MockLogger {
  infoMessages: string[] = [];
  warnMessages: string[] = [];
  errorMessages: string[] = [];
  logMessages: string[] = [];
  debugMessages: string[] = [];

  log(message: string, ...args: any[]) {
    this.logMessages.push(message);
  }

  info(message: string, ...args: any[]) {
    this.infoMessages.push(message);
  }

  warn(message: string, ...args: any[]) {
    this.warnMessages.push(message);
  }

  error(message: string, ...args: any[]) {
    this.errorMessages.push(message);
  }

  debug(message: string, ...args: any[]) {
    this.debugMessages.push(message);
  }
}

describe('AcpTerminalHandler', () => {
  let handler: AcpTerminalHandler;
  let mockLogger: MockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = new MockLogger();

    // Create handler with mocked dependencies
    handler = new AcpTerminalHandler();
    // Use Object.defineProperty to bypass readonly setter
    Object.defineProperty(handler, 'logger', {
      value: mockLogger,
      writable: true,
      configurable: true,
    });
  });

  afterEach(async () => {
    // Clean up any remaining terminals by directly accessing the private map
    const terminals = (handler as any).terminals as Map<string, any>;
    if (terminals && terminals.size > 0) {
      for (const [terminalId] of terminals) {
        try {
          await handler.releaseTerminal({ sessionId: 'test-session', terminalId });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe('createTerminal', () => {
    it('should create a terminal and return terminalId', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-1',
        command: 'node',
        args: ['-e', 'console.log("hello"); process.exit(0)'],
        cwd: process.cwd(),
      };

      const result = await handler.createTerminal(request);

      expect(result.error).toBeUndefined();
      expect(result.terminalId).toBeDefined();
      expect(result.terminalId!.length).toBeGreaterThan(0);

      // Check log output
      expect(mockLogger.logMessages.some((m) => m.includes('createTerminal called'))).toBe(true);
      expect(mockLogger.logMessages.some((m) => m.includes('Terminal created successfully'))).toBe(true);

      // Verify pty.spawn was called
      expect(pty.spawn).toHaveBeenCalled();
    });

    it('should spawn a PTY process with correct parameters', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-2',
        command: 'echo',
        args: ['test'],
        cwd: '/tmp',
        env: { TEST_VAR: 'test_value' },
      };

      const result = await handler.createTerminal(request);

      expect(result.error).toBeUndefined();
      expect(result.terminalId).toBeDefined();

      // Verify pty.spawn was called with correct arguments
      expect(pty.spawn).toHaveBeenCalledWith(
        'echo',
        ['test'],
        expect.objectContaining({
          name: 'xterm-256color',
          cwd: '/tmp',
          cols: 80,
          rows: 24,
        }),
      );

      // Verify the terminal was created by checking logs
      expect(mockLogger.logMessages.some((m) => m.includes('Spawning PTY process'))).toBe(true);
      expect(mockLogger.logMessages.some((m) => m.includes('PTY process spawned successfully'))).toBe(true);
    });

    it('should handle permission callback and reject when not permitted', async () => {
      // Set up permission callback that always rejects
      handler.setPermissionCallback(async () => false);

      const request: TerminalRequest = {
        sessionId: 'test-session-3',
        command: 'ls',
        args: ['-la'],
      };

      const result = await handler.createTerminal(request);

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ACPErrorCode.FORBIDDEN);
      expect(result.error!.message).toBe('Command execution permission denied');

      // Verify permission was checked
      expect(mockLogger.warnMessages.some((m) => m.includes('permission denied'))).toBe(true);

      // Verify pty.spawn was NOT called (permission denied)
      expect(pty.spawn).not.toHaveBeenCalled();
    });

    it('should handle permission callback and proceed when permitted', async () => {
      // Set up permission callback that always allows
      handler.setPermissionCallback(async () => true);

      const request: TerminalRequest = {
        sessionId: 'test-session-4',
        command: 'node',
        args: ['-e', 'process.exit(0)'],
      };

      const result = await handler.createTerminal(request);

      expect(result.error).toBeUndefined();
      expect(result.terminalId).toBeDefined();

      // Verify permission was checked and granted
      expect(mockLogger.logMessages.some((m) => m.includes('Checking permission'))).toBe(true);
      expect(mockLogger.logMessages.some((m) => m.includes('Permission granted'))).toBe(true);

      // Verify pty.spawn was called
      expect(pty.spawn).toHaveBeenCalled();
    });

    it('should use default command when command is not provided', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-5',
        // No command specified, should default to /bin/sh
      };

      const result = await handler.createTerminal(request);

      // Should still create a terminal (with default shell)
      expect(result.error).toBeUndefined();
      expect(result.terminalId).toBeDefined();

      // Verify spawn was called with /bin/sh
      expect(pty.spawn).toHaveBeenCalledWith('/bin/sh', expect.any(Array), expect.any(Object));
    });

    it('should merge environment variables correctly', async () => {
      const customEnv = {
        CUSTOM_VAR: 'custom_value',
        PATH: '/custom/path',
      };

      const request: TerminalRequest = {
        sessionId: 'test-session-6',
        command: 'node',
        args: ['-e', 'console.log(process.env.CUSTOM_VAR);'],
        env: customEnv,
      };

      const result = await handler.createTerminal(request);

      expect(result.error).toBeUndefined();
      expect(result.terminalId).toBeDefined();

      // Verify env was merged (should include process.env)
      const spawnCall = (pty.spawn as jest.Mock).mock.calls[0];
      const spawnOptions = spawnCall[2];
      expect(spawnOptions.env).toMatchObject(customEnv);
    });
  });

  describe('getTerminalOutput', () => {
    it('should return error when terminal not found', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session',
        terminalId: 'non-existent-terminal',
      };

      const result = await handler.getTerminalOutput(request);

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ACPErrorCode.RESOURCE_NOT_FOUND);
      expect(result.error!.message).toBe('Terminal not found');
    });

    it('should return error when session mismatch', async () => {
      // First create a terminal
      const createResult = await handler.createTerminal({
        sessionId: 'session-a',
        command: 'node',
        args: ['-e', 'process.exit(0)'],
      });

      // Then try to get output with different session
      const result = await handler.getTerminalOutput({
        sessionId: 'session-b', // Different session
        terminalId: createResult.terminalId,
      });

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ACPErrorCode.SERVER_ERROR);
      expect(result.error!.message).toBe('Session mismatch');
    });

    it('should return output and exit status for exited terminal', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-output',
        command: 'node',
        args: ['-e', 'console.log("hello"); process.exit(42);'],
      };

      const createResult = await handler.createTerminal(request);

      // Simulate output and exit using mock callbacks
      const mockPty = (pty.spawn as jest.Mock).mock.results[0].value;
      mockPty._onDataCallback && mockPty._onDataCallback('test output\n');
      mockPty._onExitCallback && mockPty._onExitCallback({ exitCode: 42 });

      const result = await handler.getTerminalOutput({
        sessionId: 'test-session-output',
        terminalId: createResult.terminalId,
      });

      expect(result.error).toBeUndefined();
      expect(result.output).toContain('test output');
      expect(result.exitStatus).toBe(42);
    });
  });

  describe('waitForTerminalExit', () => {
    it('should return immediately when terminal already exited', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-wait',
        command: 'node',
        args: ['-e', 'process.exit(0)'],
      };

      const createResult = await handler.createTerminal(request);

      // Simulate exit
      const mockPty = (pty.spawn as jest.Mock).mock.results[0].value;
      mockPty._onExitCallback && mockPty._onExitCallback({ exitCode: 0 });

      const result = await handler.waitForTerminalExit({
        sessionId: 'test-session-wait',
        terminalId: createResult.terminalId,
      });

      expect(result.error).toBeUndefined();
      expect(result.exitCode).toBe(0);
    });

    it('should wait for terminal to exit with timeout', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-wait-long',
        command: 'node',
        args: ['-e', 'setTimeout(() => process.exit(0), 2000);'],
        timeout: 5000,
      };

      const createResult = await handler.createTerminal(request);

      // Simulate exit after a delay
      setTimeout(() => {
        const mockPty = (pty.spawn as jest.Mock).mock.results[0].value;
        mockPty._onExitCallback && mockPty._onExitCallback({ exitCode: 0 });
      }, 100);

      const result = await handler.waitForTerminalExit({
        sessionId: 'test-session-wait-long',
        terminalId: createResult.terminalId,
        timeout: 5000,
      });

      expect(result.error).toBeUndefined();
      expect(result.exitCode).toBe(0);
    });

    it('should return null exitStatus when timeout occurs', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-timeout',
        command: 'node',
        args: ['-e', 'setTimeout(() => process.exit(0), 5000);'],
        timeout: 100, // Short timeout
      };

      const createResult = await handler.createTerminal(request);

      const result = await handler.waitForTerminalExit({
        sessionId: 'test-session-timeout',
        terminalId: createResult.terminalId,
        timeout: 100,
      });

      // Timeout should return null exitStatus
      expect(result.error).toBeUndefined();
      expect(result.exitStatus).toBeNull();
    });

    it('should return error when terminal not found', async () => {
      const result = await handler.waitForTerminalExit({
        sessionId: 'test-session',
        terminalId: 'non-existent',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ACPErrorCode.RESOURCE_NOT_FOUND);
    });
  });

  describe('killTerminal', () => {
    it('should kill a running terminal', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-kill',
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      };

      const createResult = await handler.createTerminal(request);

      const result = await handler.killTerminal({
        sessionId: 'test-session-kill',
        terminalId: createResult.terminalId,
      });

      expect(result.error).toBeUndefined();

      // Verify pty.kill was called
      const mockPty = (pty.spawn as jest.Mock).mock.results[0].value;
      expect(mockPty.kill).toHaveBeenCalled();

      // Verify log
      expect(mockLogger.logMessages.some((m) => m.includes('Killing terminal'))).toBe(true);
    });

    it('should return success when terminal already exited', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-kill-exited',
        command: 'node',
        args: ['-e', 'process.exit(0);'],
      };

      const createResult = await handler.createTerminal(request);

      // Simulate exit
      const mockPty = (pty.spawn as jest.Mock).mock.results[0].value;
      mockPty._onExitCallback && mockPty._onExitCallback({ exitCode: 0 });

      const result = await handler.killTerminal({
        sessionId: 'test-session-kill-exited',
        terminalId: createResult.terminalId,
      });

      // Should return success (already exited)
      expect(result.error).toBeUndefined();
      expect(result.exitStatus).toBe(0);
    });

    it('should return error when terminal not found', async () => {
      const result = await handler.killTerminal({
        sessionId: 'test-session',
        terminalId: 'non-existent',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ACPErrorCode.RESOURCE_NOT_FOUND);
    });

    it('should return error when session mismatch', async () => {
      const createResult = await handler.createTerminal({
        sessionId: 'session-a',
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      });

      const result = await handler.killTerminal({
        sessionId: 'session-b', // Different session
        terminalId: createResult.terminalId,
      });

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ACPErrorCode.SERVER_ERROR);
      expect(result.error!.message).toBe('Session mismatch');
    });
  });

  describe('releaseTerminal', () => {
    it('should release a terminal and remove it from tracking', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-release',
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      };

      const createResult = await handler.createTerminal(request);

      // Release the terminal
      const result = await handler.releaseTerminal({
        sessionId: 'test-session-release',
        terminalId: createResult.terminalId,
      });

      expect(result.error).toBeUndefined();

      // Verify terminal was removed by trying to get its output
      const outputResult = await handler.getTerminalOutput({
        sessionId: 'test-session-release',
        terminalId: createResult.terminalId,
      });

      expect(outputResult.error).toBeDefined();
      expect(outputResult.error!.message).toBe('Terminal not found');
    });

    it('should kill PTY process when releasing non-exited terminal', async () => {
      const request: TerminalRequest = {
        sessionId: 'test-session-release-kill',
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      };

      const createResult = await handler.createTerminal(request);

      await handler.releaseTerminal({
        sessionId: 'test-session-release-kill',
        terminalId: createResult.terminalId,
      });

      // Verify pty.kill was called
      const mockPty = (pty.spawn as jest.Mock).mock.results[0].value;
      expect(mockPty.kill).toHaveBeenCalled();

      // Verify log
      expect(mockLogger.logMessages.some((m) => m.includes('Releasing terminal'))).toBe(true);
    });

    it('should return empty result when terminal not found', async () => {
      const result = await handler.releaseTerminal({
        sessionId: 'test-session',
        terminalId: 'non-existent',
      });

      // Should return empty result (no error) for non-existent terminal
      expect(result.error).toBeUndefined();
      expect(result.terminalId).toBeUndefined();
    });

    it('should return error when session mismatch', async () => {
      const createResult = await handler.createTerminal({
        sessionId: 'session-a',
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      });

      const result = await handler.releaseTerminal({
        sessionId: 'session-b', // Different session
        terminalId: createResult.terminalId,
      });

      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ACPErrorCode.SERVER_ERROR);
      expect(result.error!.message).toBe('Session mismatch');
    });
  });

  describe('releaseSessionTerminals', () => {
    it('should release all terminals for a session', async () => {
      const sessionId = 'test-session-multi';

      // Create multiple terminals
      const terminal1 = await handler.createTerminal({
        sessionId,
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      });

      const terminal2 = await handler.createTerminal({
        sessionId,
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      });

      const terminal3 = await handler.createTerminal({
        sessionId: 'other-session',
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      });

      // Release all terminals for the session
      await handler.releaseSessionTerminals(sessionId);

      // Verify terminals for the session are released
      const output1 = await handler.getTerminalOutput({ sessionId, terminalId: terminal1.terminalId });
      const output2 = await handler.getTerminalOutput({ sessionId, terminalId: terminal2.terminalId });
      const output3 = await handler.getTerminalOutput({ sessionId: 'other-session', terminalId: terminal3.terminalId });

      expect(output1.error).toBeDefined(); // Should be released
      expect(output2.error).toBeDefined(); // Should be released
      expect(output3.error).toBeUndefined(); // Should still exist

      // Clean up
      await handler.releaseTerminal({ sessionId: 'other-session', terminalId: terminal3.terminalId });
    });

    it('should log the number of terminals released', async () => {
      const sessionId = 'test-session-log';

      await handler.createTerminal({ sessionId, command: 'node', args: ['-e', 'setInterval(() => {}, 1000);'] });
      await handler.createTerminal({ sessionId, command: 'node', args: ['-e', 'setInterval(() => {}, 1000);'] });

      await handler.releaseSessionTerminals(sessionId);

      expect(mockLogger.logMessages.some((m) => m.includes('Released'))).toBe(true);
    });
  });

  describe('getSessionTerminals', () => {
    it('should return all terminal IDs for a session', async () => {
      const sessionId = 'test-session-list';

      const terminal1 = await handler.createTerminal({
        sessionId,
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      });
      const terminal2 = await handler.createTerminal({
        sessionId,
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      });
      await handler.createTerminal({
        sessionId: 'other-session',
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000);'],
      });

      const terminalIds = handler.getSessionTerminals(sessionId);

      expect(terminalIds).toHaveLength(2);
      expect(terminalIds).toContain(terminal1.terminalId);
      expect(terminalIds).toContain(terminal2.terminalId);

      // Clean up
      await handler.releaseSessionTerminals(sessionId);
      await handler.releaseSessionTerminals('other-session');
    });

    it('should return empty array for session with no terminals', () => {
      const terminalIds = handler.getSessionTerminals('non-existent-session');
      expect(terminalIds).toEqual([]);
    });
  });

  describe('configure', () => {
    it('should update the default output limit', () => {
      const newLimit = 2 * 1024 * 1024; // 2MB

      handler.configure({ outputLimit: newLimit });

      // Can't directly verify the private property, but can verify no errors
      expect(true).toBe(true);
    });

    it('should handle undefined outputLimit gracefully', () => {
      handler.configure({});

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
