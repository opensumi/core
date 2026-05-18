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

// Create a mock child process for each test
function createMockChildProcess(pid = 12345) {
  const mock = new EventEmitter() as any;
  mock.pid = pid;
  mock.killed = false;
  mock.exitCode = null;
  mock.signalCode = null;
  mock.stdio = [new EventEmitter(), new EventEmitter(), new EventEmitter()];
  mock.stderr = new EventEmitter();
  return mock;
}

const mockSpawn = jest.fn();

jest.mock('child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

import { CliAgentProcessManager } from '../../src/node/acp/cli-agent-process-manager';

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

describe('CliAgentProcessManager', () => {
  let manager: CliAgentProcessManager;
  let mockChildProcess: ReturnType<typeof createMockChildProcess>;

  beforeEach(() => {
    mockChildProcess = createMockChildProcess();
    mockSpawn.mockImplementation(() => mockChildProcess);

    jest.spyOn(process, 'kill').mockImplementation((pid: number, signal: number | NodeJS.Signals): any => undefined);

    manager = new CliAgentProcessManager();
    Object.defineProperty(manager, 'logger', { value: mockLogger, writable: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('startAgent()', () => {
    it('should spawn a new process and return process info', async () => {
      const result = await manager.startAgent('npx', ['test'], {}, '/test/workspace');

      expect(result.processId).toBe('12345');
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopAgent()', () => {
    it('should do nothing when no process running', async () => {
      await manager.stopAgent();

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('killAgent()', () => {
    it('should clear references when no process', async () => {
      await manager.killAgent();

      expect((manager as any).currentProcess).toBeNull();
    });
  });

  describe('isRunning()', () => {
    it('should return false when no process', () => {
      expect(manager.isRunning()).toBe(false);
    });

    it('should return true for running process', async () => {
      await manager.startAgent('npx', ['test'], {}, '/test/workspace');

      expect(manager.isRunning()).toBe(true);
    });

    it('should return false when process killed flag is set', async () => {
      await manager.startAgent('npx', ['test'], {}, '/test/workspace');

      mockChildProcess.killed = true;
      expect(manager.isRunning()).toBe(false);
    });

    it('should return false when process has exitCode', async () => {
      await manager.startAgent('npx', ['test'], {}, '/test/workspace');

      mockChildProcess.exitCode = 0;
      expect(manager.isRunning()).toBe(false);
    });
  });

  describe('getExitCode()', () => {
    it('should return null when no process', () => {
      expect(manager.getExitCode()).toBeNull();
    });

    it('should return exitCode from process', async () => {
      await manager.startAgent('npx', ['test'], {}, '/test/workspace');

      mockChildProcess.exitCode = 42;
      expect(manager.getExitCode()).toBe(42);
    });
  });

  describe('listRunningAgents()', () => {
    it('should return singleton ID when running', async () => {
      await manager.startAgent('npx', ['test'], {}, '/test/workspace');

      const agents = manager.listRunningAgents();

      expect(agents).toEqual(['singleton-agent-process']);
    });

    it('should return empty array when not running', () => {
      expect(manager.listRunningAgents()).toEqual([]);
    });
  });

  describe('killAllAgents()', () => {
    it('should delegate to forceKillInternal', async () => {
      const forceKillSpy = jest.spyOn(manager as any, 'forceKillInternal').mockResolvedValue(undefined);

      await manager.killAllAgents();

      expect(forceKillSpy).toHaveBeenCalled();
    });
  });

  describe('handleProcessExit()', () => {
    it('should clear references on exit', async () => {
      await manager.startAgent('npx', ['test'], {}, '/test/workspace');

      mockChildProcess.emit('exit', 0, null);

      expect((manager as any).currentProcess).toBeNull();
      expect((manager as any).currentCommand).toBeNull();
      expect((manager as any).currentCwd).toBeNull();
    });
  });

  describe('killProcessGroup()', () => {
    it('should try process group kill first', () => {
      const result = (manager as any).killProcessGroup(12345, 'SIGTERM');

      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(-12345, 'SIGTERM');
    });

    it('should fallback to single process kill when group kill fails', () => {
      const mockKill = process.kill as jest.Mock;
      mockKill
        .mockImplementationOnce(() => {
          throw new Error('group not found');
        })
        .mockImplementation(() => true);

      const result = (manager as any).killProcessGroup(12345, 'SIGTERM');

      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
    });

    it('should return false when both kills fail', () => {
      (process.kill as jest.Mock).mockImplementation(() => {
        throw new Error('not found');
      });

      const result = (manager as any).killProcessGroup(12345, 'SIGTERM');

      expect(result).toBe(false);
    });
  });

  describe('wrapError()', () => {
    it('should return user-friendly message for ENOENT', () => {
      const err = new Error('spawn ENOENT');
      (err as any).code = 'ENOENT';

      const result = (manager as any).wrapError(err, 'npx');

      expect(result.message).toContain('Command not found');
      expect(result.message).toContain('npx');
    });

    it('should return user-friendly message for EACCES', () => {
      const err = new Error('spawn EACCES');
      (err as any).code = 'EACCES';

      const result = (manager as any).wrapError(err, 'npx');

      expect(result.message).toContain('Permission denied');
    });

    it('should return original error for other codes', () => {
      const err = new Error('some error');
      (err as any).code = 'OTHER';

      const result = (manager as any).wrapError(err, 'npx');

      expect(result).toBe(err);
    });
  });
});
