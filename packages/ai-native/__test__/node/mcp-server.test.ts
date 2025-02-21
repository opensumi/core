import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { ILogger } from '@opensumi/ide-core-common';

import { StdioMCPServerImpl } from '../../src/node/mcp-server';

jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');

describe('StdioMCPServerImpl', () => {
  let server: StdioMCPServerImpl;
  const mockLogger: ILogger = {
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

  beforeEach(() => {
    jest.clearAllMocks();
    server = new StdioMCPServerImpl('test-server', 'test-command', ['arg1', 'arg2'], { ENV: 'test' }, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(server.getServerName()).toBe('test-server');
      expect(server.isStarted()).toBe(false);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      (Client as jest.Mock).mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        onerror: jest.fn(),
      }));
      (StdioClientTransport as jest.Mock).mockImplementation(() => ({
        onerror: jest.fn(),
      }));
    });

    it('should start the server successfully', async () => {
      await server.start();
      expect(server.isStarted()).toBe(true);
      expect(StdioClientTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'test-command',
          args: ['arg1', 'arg2'],
          env: expect.objectContaining({ ENV: 'test' }),
        }),
      );
    });

    it('should not start server if already started', async () => {
      await server.start();
      const firstCallCount = (StdioClientTransport as jest.Mock).mock.calls.length;
      await server.start();
      expect((StdioClientTransport as jest.Mock).mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('callTool', () => {
    const mockClient = {
      connect: jest.fn(),
      callTool: jest.fn(),
      onerror: jest.fn(),
    };

    beforeEach(async () => {
      (Client as jest.Mock).mockImplementation(() => mockClient);
      await server.start();
    });

    it('should call tool with parsed arguments', async () => {
      const toolName = 'test-tool';
      const argString = '{"key": "value"}';
      await server.callTool(toolName, 'toolCallId', argString);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: toolName,
        toolCallId: 'toolCallId',
        arguments: { key: 'value' },
      });
    });

    it('should handle invalid JSON arguments', async () => {
      const toolName = 'test-tool';
      const invalidArgString = '{invalid json}';
      await server.callTool(toolName, 'toolCallId', invalidArgString);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    const mockClient = {
      connect: jest.fn(),
      close: jest.fn(),
      onerror: jest.fn(),
    };

    beforeEach(async () => {
      (Client as jest.Mock).mockImplementation(() => mockClient);
      await server.start();
    });

    it('should stop the server successfully', () => {
      server.stop();
      expect(mockClient.close).toHaveBeenCalled();
      expect(server.isStarted()).toBe(false);
    });

    it('should not attempt to stop if server is not started', () => {
      server.stop(); // First stop
      mockClient.close.mockClear();
      server.stop(); // Second stop
      expect(mockClient.close).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update server configuration', () => {
      const newCommand = 'new-command';
      const newArgs = ['new-arg'];
      const newEnv = { NEW_ENV: 'test' };

      server.update(newCommand, newArgs, newEnv);

      // Start server to verify new config is used
      const transportMock = StdioClientTransport as jest.Mock;
      server.start();

      expect(transportMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          command: newCommand,
          args: newArgs,
          env: expect.objectContaining(newEnv),
        }),
      );
    });
  });
});
