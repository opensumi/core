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

import { AcpAgentRequestHandler, AcpAgentRequestHandlerToken } from '../../src/node/acp/handlers/agent-request.handler';

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
  readTextFile: jest.fn(),
  writeTextFile: jest.fn(),
  getFileMeta: jest.fn(),
  listDirectory: jest.fn(),
  createDirectory: jest.fn(),
};

const mockTerminalHandler = {
  createTerminal: jest.fn(),
  getTerminalOutput: jest.fn(),
  waitForTerminalExit: jest.fn(),
  killTerminal: jest.fn(),
  releaseTerminal: jest.fn(),
  releaseSessionTerminals: jest.fn(),
};

const mockPermissionCaller = {
  requestPermission: jest.fn(),
  cancelRequest: jest.fn(),
};

describe('AcpAgentRequestHandler', () => {
  let handler: AcpAgentRequestHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    handler = new AcpAgentRequestHandler();
    Object.defineProperty(handler, 'logger', { value: mockLogger, writable: true });
    Object.defineProperty(handler, 'fileSystemHandler', { value: mockFileSystemHandler, writable: true });
    Object.defineProperty(handler, 'terminalHandler', { value: mockTerminalHandler, writable: true });
    Object.defineProperty(handler, 'permissionCaller', { value: mockPermissionCaller, writable: true });
  });

  describe('initialize()', () => {
    it('should set initialized flag', () => {
      handler.initialize();

      expect((handler as any).initialized).toBe(true);
    });

    it('should be idempotent', () => {
      handler.initialize();
      handler.initialize();

      expect((handler as any).initialized).toBe(true);
    });
  });

  describe('handlePermissionRequest()', () => {
    it('should delegate to permissionCaller and return response', async () => {
      const expected = { outcome: { outcome: 'selected', optionId: 'allow_once' } };
      mockPermissionCaller.requestPermission.mockResolvedValue(expected);

      const result = await handler.handlePermissionRequest({
        sessionId: 'sess-1',
        toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
        options: [{ optionId: 'allow_once', name: 'Allow', kind: 'allow_once' as const }],
      });

      expect(result).toBe(expected);
      expect(mockPermissionCaller.requestPermission).toHaveBeenCalled();
    });

    it('should return cancelled on error', async () => {
      mockPermissionCaller.requestPermission.mockRejectedValue(new Error('RPC failed'));

      const result = await handler.handlePermissionRequest({
        sessionId: 'sess-1',
        toolCall: { toolCallId: 'tc-1', title: 'Test', kind: 'read', status: 'pending' } as any,
        options: [],
      });

      expect(result.outcome.outcome).toBe('cancelled');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('handleReadTextFile()', () => {
    it('should delegate to fileSystemHandler and return content', async () => {
      mockFileSystemHandler.readTextFile.mockResolvedValue({ content: 'Hello World' });

      const result = await handler.handleReadTextFile({
        sessionId: 'sess-1',
        path: 'test.txt',
      });

      expect(result.content).toBe('Hello World');
      expect(mockFileSystemHandler.readTextFile).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          path: 'test.txt',
        }),
      );
    });

    it('should pass through line and limit params', async () => {
      mockFileSystemHandler.readTextFile.mockResolvedValue({ content: 'line1' });

      await handler.handleReadTextFile({
        sessionId: 'sess-1',
        path: 'test.txt',
        line: 5,
        limit: 10,
      });

      expect(mockFileSystemHandler.readTextFile).toHaveBeenCalledWith(expect.objectContaining({ line: 5, limit: 10 }));
    });

    it('should throw error when file read fails', async () => {
      mockFileSystemHandler.readTextFile.mockResolvedValue({
        error: { code: -32000, message: 'File not found' },
      });

      await expect(handler.handleReadTextFile({ sessionId: 'sess-1', path: 'nonexistent.txt' })).rejects.toThrow(
        'File not found',
      );
    });
  });

  describe('handleWriteTextFile()', () => {
    it('should check permission before writing', async () => {
      mockPermissionCaller.requestPermission.mockResolvedValue({
        outcome: { outcome: 'selected', optionId: 'allow_once' },
      });
      mockFileSystemHandler.writeTextFile.mockResolvedValue({});

      const result = await handler.handleWriteTextFile({
        sessionId: 'sess-1',
        path: 'test.txt',
        content: 'Hello',
      });

      expect(result).toEqual({});
      expect(mockPermissionCaller.requestPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCall: expect.objectContaining({
            title: expect.stringContaining('Write file'),
            kind: 'write',
          }),
        }),
      );
    });

    it('should deny when permission rejected', async () => {
      mockPermissionCaller.requestPermission.mockResolvedValue({
        outcome: { outcome: 'selected', optionId: 'reject_once' },
      });

      await expect(
        handler.handleWriteTextFile({
          sessionId: 'sess-1',
          path: 'test.txt',
          content: 'Hello',
        }),
      ).rejects.toThrow('Write permission denied');
    });

    it('should throw when write fails', async () => {
      mockPermissionCaller.requestPermission.mockResolvedValue({
        outcome: { outcome: 'selected', optionId: 'allow_once' },
      });
      mockFileSystemHandler.writeTextFile.mockResolvedValue({
        error: { code: -32000, message: 'Disk full' },
      });

      await expect(
        handler.handleWriteTextFile({ sessionId: 'sess-1', path: 'test.txt', content: 'Hello' }),
      ).rejects.toThrow('Disk full');
    });
  });

  describe('handleCreateTerminal()', () => {
    it('should check permission before creating', async () => {
      mockPermissionCaller.requestPermission.mockResolvedValue({
        outcome: { outcome: 'selected', optionId: 'allow_once' },
      });
      mockTerminalHandler.createTerminal.mockResolvedValue({ terminalId: 'term-1' });

      const result = await handler.handleCreateTerminal({
        sessionId: 'sess-1',
        command: 'bash',
        args: ['-c', 'ls'],
      });

      expect(result.terminalId).toBe('term-1');
      expect(mockPermissionCaller.requestPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCall: expect.objectContaining({
            title: expect.stringContaining('Run command'),
          }),
        }),
      );
    });

    it('should pass env and cwd to terminal handler', async () => {
      mockPermissionCaller.requestPermission.mockResolvedValue({
        outcome: { outcome: 'selected', optionId: 'allow_once' },
      });
      mockTerminalHandler.createTerminal.mockResolvedValue({ terminalId: 'term-1' });

      await handler.handleCreateTerminal({
        sessionId: 'sess-1',
        command: 'bash',
        args: ['-c', 'echo $MY_VAR'],
        env: [{ name: 'MY_VAR', value: 'hello' }],
        cwd: '/custom',
      });

      expect(mockTerminalHandler.createTerminal).toHaveBeenCalledWith(
        expect.objectContaining({
          env: { MY_VAR: 'hello' },
          cwd: '/custom',
        }),
      );
    });

    it('should deny when permission rejected', async () => {
      mockPermissionCaller.requestPermission.mockResolvedValue({
        outcome: { outcome: 'cancelled' },
      });

      await expect(
        handler.handleCreateTerminal({ sessionId: 'sess-1', command: 'rm', args: ['-rf', '/'] }),
      ).rejects.toThrow('permission denied');
    });

    it('should throw when terminal creation fails', async () => {
      mockPermissionCaller.requestPermission.mockResolvedValue({
        outcome: { outcome: 'selected', optionId: 'allow_once' },
      });
      mockTerminalHandler.createTerminal.mockResolvedValue({
        error: { code: -32000, message: 'Shell not found' },
      });

      await expect(handler.handleCreateTerminal({ sessionId: 'sess-1', command: 'nonexistent' })).rejects.toThrow(
        'Shell not found',
      );
    });
  });

  describe('handleTerminalOutput()', () => {
    it('should delegate to terminalHandler', async () => {
      mockTerminalHandler.getTerminalOutput.mockResolvedValue({
        output: 'hello\nworld',
        truncated: false,
        exitStatus: null,
      });

      const result = await handler.handleTerminalOutput({
        sessionId: 'sess-1',
        terminalId: 'term-1',
      });

      expect(result.output).toBe('hello\nworld');
      expect(result.truncated).toBe(false);
      expect(result.exitStatus).toBe(undefined);
    });

    it('should map exitStatus from exitStatus field', async () => {
      mockTerminalHandler.getTerminalOutput.mockResolvedValue({
        output: 'done',
        exitStatus: 0,
      });

      const result = await handler.handleTerminalOutput({
        sessionId: 'sess-1',
        terminalId: 'term-1',
      });

      expect(result.exitStatus).toEqual({ exitCode: 0 });
    });

    it('should throw when handler returns error', async () => {
      mockTerminalHandler.getTerminalOutput.mockResolvedValue({
        error: { code: -32002, message: 'Terminal not found' },
      });

      await expect(handler.handleTerminalOutput({ sessionId: 'sess-1', terminalId: 'unknown' })).rejects.toThrow(
        'Terminal not found',
      );
    });
  });

  describe('handleWaitForTerminalExit()', () => {
    it('should delegate to terminalHandler', async () => {
      mockTerminalHandler.waitForTerminalExit.mockResolvedValue({
        exitCode: 0,
        signal: null,
      });

      const result = await handler.handleWaitForTerminalExit({
        sessionId: 'sess-1',
        terminalId: 'term-1',
      });

      expect(result.exitCode).toBe(0);
      expect(result.signal).toBe(null);
    });

    it('should throw when handler returns error', async () => {
      mockTerminalHandler.waitForTerminalExit.mockResolvedValue({
        error: { code: -32002, message: 'Terminal not found' },
      });

      await expect(handler.handleWaitForTerminalExit({ sessionId: 'sess-1', terminalId: 'unknown' })).rejects.toThrow(
        'Terminal not found',
      );
    });
  });

  describe('handleKillTerminal()', () => {
    it('should delegate to terminalHandler', async () => {
      mockTerminalHandler.killTerminal.mockResolvedValue({ exitCode: -1 });

      const result = await handler.handleKillTerminal({
        sessionId: 'sess-1',
        terminalId: 'term-1',
      });

      expect(result).toEqual({});
    });

    it('should throw when handler returns error', async () => {
      mockTerminalHandler.killTerminal.mockResolvedValue({
        error: { code: -32002, message: 'Terminal not found' },
      });

      await expect(handler.handleKillTerminal({ sessionId: 'sess-1', terminalId: 'unknown' })).rejects.toThrow(
        'Terminal not found',
      );
    });
  });

  describe('handleReleaseTerminal()', () => {
    it('should delegate to terminalHandler', async () => {
      mockTerminalHandler.releaseTerminal.mockResolvedValue({});

      const result = await handler.handleReleaseTerminal({
        sessionId: 'sess-1',
        terminalId: 'term-1',
      });

      expect(result).toEqual({});
    });

    it('should throw when handler returns error', async () => {
      mockTerminalHandler.releaseTerminal.mockResolvedValue({
        error: { code: -32002, message: 'Terminal not found' },
      });

      await expect(handler.handleReleaseTerminal({ sessionId: 'sess-1', terminalId: 'unknown' })).rejects.toThrow(
        'Terminal not found',
      );
    });
  });

  describe('disposeSession()', () => {
    it('should release all session terminals', async () => {
      await handler.disposeSession('sess-1');

      expect(mockTerminalHandler.releaseSessionTerminals).toHaveBeenCalledWith('sess-1');
    });
  });
});
