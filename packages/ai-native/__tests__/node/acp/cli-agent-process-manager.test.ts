import { EventEmitter } from 'events';

// Mock child_process module before importing the class under test
const mockSpawn = jest.fn();

jest.mock('child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

import { CliAgentProcessManager } from '../../../src/node/acp/cli-agent-process-manager';

// Mock dependencies
const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

jest.mock('@opensumi/di', () => ({
  Injectable: () => jest.fn(),
  Autowired: () => jest.fn(),
}));

jest.mock('@opensumi/ide-core-node', () => ({
  INodeLogger: Symbol('INodeLogger'),
}));

// Helper: create a mock ChildProcess with controllable behavior
function createMockChildProcess(opts?: { pid?: number; killed?: boolean; exitCode?: number | null }): any {
  const mock = new EventEmitter() as any;
  mock.pid = opts?.pid ?? 12345;
  mock.killed = opts?.killed ?? false;
  mock.exitCode = opts?.exitCode ?? null;
  mock.signalCode = null;
  mock.stdin = { write: jest.fn(), on: jest.fn(), pipe: jest.fn() };
  mock.stdout = new EventEmitter();
  mock.stderr = new EventEmitter();
  mock.kill = jest.fn().mockReturnValue(true);
  mock.stdio = [mock.stdin, mock.stdout, mock.stderr];
  return mock;
}

describe('CliAgentProcessManager', () => {
  let manager: CliAgentProcessManager;
  let mockProcessKill: jest.SpyInstance;

  const defaultCommand = '/usr/bin/agent';
  const defaultArgs = ['--mode', 'cli'];
  const defaultEnv = { KEY: 'value' };
  const defaultCwd = '/tmp/workspace';

  beforeEach(() => {
    jest.useFakeTimers();
    mockSpawn.mockClear();

    mockProcessKill = jest.spyOn(process, 'kill').mockImplementation(() => true as any);

    manager = new CliAgentProcessManager();
    (manager as any).logger = mockLogger;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ==================== startAgent ====================

  describe('startAgent', () => {
    it('should create a new process when none exists', async () => {
      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      const startPromise = manager.startAgent(defaultCommand, defaultArgs, defaultEnv, defaultCwd);
      jest.advanceTimersByTime(100);
      const result = await startPromise;

      expect(mockSpawn).toHaveBeenCalledWith(defaultCommand, defaultArgs, {
        cwd: defaultCwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        shell: false,
        env: expect.objectContaining({ KEY: 'value' }),
      });
      expect(result.processId).toBe('12345');
      expect(result.stdout).toBe(mockChild.stdio[1]);
      expect(result.stdin).toBe(mockChild.stdio[0]);
    });

    it('should reject with wrapped error when command not found (ENOENT)', async () => {
      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      const promise = manager.startAgent('nonexistent', [], {}, '/tmp');

      // Emit error event (simulates spawn failing immediately)
      const err: any = new Error('spawn ENOENT');
      err.code = 'ENOENT';
      mockChild.emit('error', err);

      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow(
        'Command not found: nonexistent. Please ensure the CLI agent is installed.',
      );
    });

    it('should reject with wrapped error when permission denied (EACCES)', async () => {
      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      const promise = manager.startAgent('/bin/restricted', [], {}, '/tmp');

      const err: any = new Error('spawn EACCES');
      err.code = 'EACCES';
      mockChild.emit('error', err);

      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Permission denied when executing: /bin/restricted');
    });

    it('should reject when child process has no PID', async () => {
      const mockChild = createMockChildProcess({ pid: 0 });
      mockSpawn.mockReturnValue(mockChild);

      const promise = manager.startAgent(defaultCommand, defaultArgs, defaultEnv, defaultCwd);
      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Failed to get PID for agent process');
    });

    it('should reuse existing process when config is the same', async () => {
      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      const p1 = manager.startAgent(defaultCommand, defaultArgs, defaultEnv, defaultCwd);
      jest.advanceTimersByTime(100);
      const result1 = await p1;

      mockSpawn.mockClear();
      const p2 = manager.startAgent(defaultCommand, defaultArgs, defaultEnv, defaultCwd);
      const result2 = await p2;

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(result2.processId).toBe(result1.processId);
    });

    it('should clean up exited process and create new one', async () => {
      const mockChild1 = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild1);

      const p1 = manager.startAgent(defaultCommand, defaultArgs, defaultEnv, defaultCwd);
      jest.advanceTimersByTime(100);
      await p1;

      // Simulate process exit
      mockChild1.killed = true;
      mockChild1.exitCode = 0;
      mockChild1.emit('exit', 0, null);

      const mockChild2 = createMockChildProcess({ pid: 99999 });
      mockSpawn.mockReturnValue(mockChild2);
      mockSpawn.mockClear();

      const p2 = manager.startAgent(defaultCommand, defaultArgs, defaultEnv, defaultCwd);
      jest.advanceTimersByTime(100);
      const result = await p2;

      expect(result.processId).toBe('99999');
    });

    it('should use SUMI_ACP_AGENT_PATH env var to override command', async () => {
      const originalEnv = process.env.SUMI_ACP_AGENT_PATH;
      process.env.SUMI_ACP_AGENT_PATH = '/custom/agent/path';

      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      const p = manager.startAgent(defaultCommand, defaultArgs, defaultEnv, defaultCwd);
      jest.advanceTimersByTime(100);
      await p;

      expect(mockSpawn).toHaveBeenCalledWith('/custom/agent/path', defaultArgs, expect.any(Object));

      if (originalEnv !== undefined) {
        process.env.SUMI_ACP_AGENT_PATH = originalEnv;
      } else {
        delete process.env.SUMI_ACP_AGENT_PATH;
      }
    });

    it('should set NODE and PATH in env based on SUMI_ACP_NODE_PATH', async () => {
      const originalNodePath = process.env.SUMI_ACP_NODE_PATH;
      process.env.SUMI_ACP_NODE_PATH = '/opt/node/v18/bin/node';

      const mockChild = createMockChildProcess();
      mockSpawn.mockReturnValue(mockChild);

      const p = manager.startAgent(defaultCommand, defaultArgs, defaultEnv, defaultCwd);
      jest.advanceTimersByTime(100);
      await p;

      const spawnOpts = mockSpawn.mock.calls[0][2];
      expect(spawnOpts.env.NODE).toBe('/opt/node/v18/bin/node');
      expect(spawnOpts.env.PATH).toContain('/opt/node/v18');

      if (originalNodePath !== undefined) {
        process.env.SUMI_ACP_NODE_PATH = originalNodePath;
      } else {
        delete process.env.SUMI_ACP_NODE_PATH;
      }
    });
  });

  // ==================== isRunning ====================

  describe('isRunning', () => {
    it('should return false when no process exists', () => {
      expect(manager.isRunning()).toBe(false);
    });

    it('should return false when process is killed', () => {
      const mockChild = createMockChildProcess({ killed: true });
      (manager as any).currentProcess = mockChild;

      expect(manager.isRunning()).toBe(false);
    });

    it('should return false when process has exit code', () => {
      const mockChild = createMockChildProcess({ exitCode: 1 });
      (manager as any).currentProcess = mockChild;

      expect(manager.isRunning()).toBe(false);
    });

    it('should return false when process has no pid', () => {
      const mockChild = createMockChildProcess({ pid: 0 });
      (manager as any).currentProcess = mockChild;

      expect(manager.isRunning()).toBe(false);
    });

    it('should return true when process exists and is alive', () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      expect(manager.isRunning()).toBe(true);
    });

    it('should return false when process.kill(pid, 0) throws', () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      mockProcessKill.mockImplementation(() => {
        throw new Error('kill ESRCH');
      });

      expect(manager.isRunning()).toBe(false);
    });
  });

  // ==================== getExitCode ====================

  describe('getExitCode', () => {
    it('should return null when no process exists', () => {
      expect(manager.getExitCode()).toBeNull();
    });

    it('should return exit code when process has one', () => {
      const mockChild = createMockChildProcess({ exitCode: 42 });
      (manager as any).currentProcess = mockChild;

      expect(manager.getExitCode()).toBe(42);
    });

    it('should return null when process has no exit code yet', () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      expect(manager.getExitCode()).toBeNull();
    });
  });

  // ==================== listRunningAgents ====================

  describe('listRunningAgents', () => {
    it('should return empty array when no process', () => {
      expect(manager.listRunningAgents()).toEqual([]);
    });

    it('should return singleton ID when process is running', () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      expect(manager.listRunningAgents()).toEqual(['singleton-agent-process']);
    });
  });

  // ==================== stopAgent ====================

  describe('stopAgent', () => {
    it('should return immediately when no process exists', async () => {
      await manager.stopAgent();
      expect(mockProcessKill).not.toHaveBeenCalled();
    });

    it('should send SIGTERM to process group and wait for graceful exit', async () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      const stopPromise = manager.stopAgent();

      expect(mockProcessKill).toHaveBeenCalledWith(-12345, 'SIGTERM');

      mockChild.emit('exit', 0, null);

      await stopPromise;
    });

    it('should force kill after graceful shutdown timeout', async () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      const stopPromise = manager.stopAgent();

      expect(mockProcessKill).toHaveBeenCalledWith(-12345, 'SIGTERM');

      jest.advanceTimersByTime(5000);

      expect(mockProcessKill).toHaveBeenCalledWith(-12345, 'SIGKILL');

      await stopPromise;
    });
  });

  // ==================== killAgent ====================

  describe('killAgent', () => {
    it('should send SIGKILL to process group immediately', async () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      const killPromise = manager.killAgent();

      expect(mockProcessKill).toHaveBeenCalledWith(-12345, 'SIGKILL');

      mockChild.emit('exit', null, 'SIGKILL');

      await killPromise;
    });

    it('should resolve after timeout even if process does not exit', async () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      const killPromise = manager.killAgent();

      jest.advanceTimersByTime(3000);

      await killPromise;

      expect((manager as any).currentProcess).toBeNull();
    });

    it('should resolve immediately when no process', async () => {
      await manager.killAgent();
      expect(mockProcessKill).not.toHaveBeenCalled();
    });
  });

  // ==================== killAllAgents ====================

  describe('killAllAgents', () => {
    it('should delegate to forceKillInternal', async () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      const killPromise = manager.killAllAgents();

      expect(mockProcessKill).toHaveBeenCalledWith(-12345, 'SIGKILL');

      mockChild.emit('exit', null, 'SIGKILL');

      await killPromise;
    });
  });

  // ==================== killProcessGroup ====================

  describe('killProcessGroup', () => {
    it('should try process group kill first', () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      (manager as any).killProcessGroup(12345, 'SIGTERM');

      expect(mockProcessKill).toHaveBeenNthCalledWith(1, -12345, 'SIGTERM');
    });

    it('should fallback to single process kill when group kill fails', () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      let callCount = 0;
      mockProcessKill.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('ESRCH');
        }
        return true as any;
      });

      const result = (manager as any).killProcessGroup(12345, 'SIGTERM');

      expect(mockProcessKill).toHaveBeenNthCalledWith(1, -12345, 'SIGTERM');
      expect(mockProcessKill).toHaveBeenNthCalledWith(2, 12345, 'SIGTERM');
      expect(result).toBe(true);
    });

    it('should return false when both kills fail', () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;

      mockProcessKill.mockImplementation(() => {
        throw new Error('ESRCH');
      });

      const result = (manager as any).killProcessGroup(12345, 'SIGTERM');

      expect(result).toBe(false);
    });
  });

  // ==================== handleProcessExit ====================

  describe('handleProcessExit', () => {
    it('should clear all state on exit', async () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;
      (manager as any).currentCommand = defaultCommand;
      (manager as any).currentCwd = defaultCwd;

      // Directly call the private method
      (manager as any).handleProcessExit(1, null);

      expect((manager as any).currentProcess).toBeNull();
      expect((manager as any).currentCommand).toBeNull();
      expect((manager as any).currentCwd).toBeNull();
    });

    it('should clear state even with null code and signal', () => {
      const mockChild = createMockChildProcess();
      (manager as any).currentProcess = mockChild;
      (manager as any).currentCommand = defaultCommand;
      (manager as any).currentCwd = defaultCwd;

      (manager as any).handleProcessExit(null, null);

      expect((manager as any).currentProcess).toBeNull();
      expect((manager as any).currentCommand).toBeNull();
      expect((manager as any).currentCwd).toBeNull();
    });
  });

  // ==================== wrapError ====================

  describe('wrapError', () => {
    it('should wrap ENOENT error', () => {
      const err: any = new Error('spawn ENOENT');
      err.code = 'ENOENT';

      const wrapped = (manager as any).wrapError(err, 'my-agent');

      expect(wrapped.message).toBe('Command not found: my-agent. Please ensure the CLI agent is installed.');
    });

    it('should wrap EACCES error', () => {
      const err: any = new Error('spawn EACCES');
      err.code = 'EACCES';

      const wrapped = (manager as any).wrapError(err, 'my-agent');

      expect(wrapped.message).toBe('Permission denied when executing: my-agent');
    });

    it('should wrap EPERM error', () => {
      const err: any = new Error('spawn EPERM');
      err.code = 'EPERM';

      const wrapped = (manager as any).wrapError(err, 'my-agent');

      expect(wrapped.message).toBe('Permission denied when executing: my-agent');
    });

    it('should return original error for other codes', () => {
      const err = new Error('some other error');

      const wrapped = (manager as any).wrapError(err, 'my-agent');

      expect(wrapped).toBe(err);
    });
  });
});
