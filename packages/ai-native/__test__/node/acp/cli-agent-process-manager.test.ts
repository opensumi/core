import { CliAgentProcessManager, ICliAgentProcessManager } from '../../../src/node/acp/cli-agent-process-manager';

describe('CliAgentProcessManager', () => {
  let processManager: ICliAgentProcessManager;
  let mockLogger: jest.Mocked<any>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    processManager = new CliAgentProcessManager();
  });

  afterEach(async () => {
    // Clean up any running processes
    await processManager.killAllAgents();
  });

  describe('startAgent', () => {
    it('should return the same processId for multiple calls with same config', async () => {
      // First call - should create a new process (use long-running command)
      const result1 = await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      // Second call with same config - should return existing process
      const result2 = await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      // Both should return the same processId (reusing existing process)
      expect(result1.processId).toBe(result2.processId);

      // Cleanup
      await processManager.killAgent();
    });

    it('should restart process when config changes', async () => {
      // First call
      const result1 = await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      // Second call with different cwd - should restart
      const result2 = await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, '/tmp');

      // Should return the new process ID after restart
      expect(result1.processId).not.toBe(result2.processId);

      // Cleanup
      await processManager.killAgent();
    });

    it('should return existing process if still running', async () => {
      // Start agent
      const result1 = await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      // Immediately call again - should return same process
      const result2 = await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      expect(result1.processId).toBe(result2.processId);
      expect(processManager.isRunning()).toBe(true);

      // Cleanup
      await processManager.killAgent();
    });
  });

  describe('isRunning', () => {
    it('should return false when no process is started', () => {
      expect(processManager.isRunning()).toBe(false);
    });

    it('should return true when process is running', async () => {
      // Start a long-running process
      await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      expect(processManager.isRunning()).toBe(true);

      // Cleanup
      await processManager.killAgent();
    });

    it('should return false after process is killed', async () => {
      // Start and kill a process
      await processManager.startAgent('node', ['-e', 'console.log("test")'], {}, process.cwd());
      await processManager.killAgent();

      // Give it a moment to actually exit
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(processManager.isRunning()).toBe(false);
    });
  });

  describe('stopAgent', () => {
    it('should stop the running process', async () => {
      // Start a long-running process
      await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      expect(processManager.isRunning()).toBe(true);

      // Stop the process
      await processManager.stopAgent();

      // Give it a moment to stop
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(processManager.isRunning()).toBe(false);
    }, 20000);

    it('should handle stopping non-existent process gracefully', async () => {
      // Should not throw
      await expect(processManager.stopAgent()).resolves.not.toThrow();
    });
  });

  describe('killAgent', () => {
    it('should force kill the running process', async () => {
      // Start a long-running process
      await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      expect(processManager.isRunning()).toBe(true);

      // Force kill
      await processManager.killAgent();

      // Give it a moment to actually exit
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(processManager.isRunning()).toBe(false);
    });
  });

  describe('listRunningAgents', () => {
    it('should return empty array when no process is running', () => {
      expect(processManager.listRunningAgents()).toEqual([]);
    });

    it('should return array with one processId when process is running', async () => {
      await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      const running = processManager.listRunningAgents();

      expect(running).toHaveLength(1);
      expect(running[0]).toBe('singleton-agent-process');

      // Cleanup
      await processManager.killAgent();
    });

    it('should return empty array after process is killed', async () => {
      await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());
      await processManager.killAgent();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(processManager.listRunningAgents()).toEqual([]);
    });
  });

  describe('getExitCode', () => {
    it('should return null for running process', async () => {
      await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      expect(processManager.getExitCode()).toBe(null);

      // Cleanup
      await processManager.killAgent();
    });

    it('should return exit code after process exits', async () => {
      // Start a process that exits with code 0
      await processManager.startAgent('node', ['-e', 'process.exit(0)'], {}, process.cwd());

      // Wait for process to complete and exit event to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(processManager.getExitCode()).toBe(0);
    });
  });

  describe('killAllAgents', () => {
    it('should kill the running process', async () => {
      await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      expect(processManager.isRunning()).toBe(true);

      await processManager.killAllAgents();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(processManager.isRunning()).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should reuse the same process for multiple startAgent calls', async () => {
      const result1 = await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());
      const result2 = await processManager.startAgent('node', ['-e', 'setInterval(() => {}, 1000)'], {}, process.cwd());

      // Second call should return the same process (not restart)
      expect(result1.processId).toBe(result2.processId);

      await processManager.killAgent();
    });
  });
});
