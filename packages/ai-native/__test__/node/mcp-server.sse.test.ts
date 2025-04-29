import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { ILogger } from '@opensumi/ide-core-common';

import { SSEMCPServer } from '../../src/node/mcp-server.sse';

jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: jest.fn().mockImplementation(() => ({
    onerror: jest.fn(),
  })),
}));

describe('SSEMCPServer', () => {
  let server: SSEMCPServer;
  let mockSSEClientTransport: jest.Mock;
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
    jest.resetModules();
    server = new SSEMCPServer('test-server', 'http://localhost:3000', mockLogger);
    mockSSEClientTransport = require('@modelcontextprotocol/sdk/client/sse.js').SSEClientTransport;
  });

  describe('constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(server.getServerName()).toBe('test-server');
      expect(server.url).toBe('http://localhost:3000');
      expect(server.isStarted()).toBe(false);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      (Client as jest.Mock).mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        onerror: jest.fn(),
      }));
    });

    it('should start the server successfully', async () => {
      await server.start();
      expect(server.isStarted()).toBe(true);
      expect(mockSSEClientTransport).toHaveBeenCalledWith(expect.any(URL), undefined);
    });

    it('should not start server if already started', async () => {
      await server.start();
      const firstCallCount = mockSSEClientTransport.mock.calls.length;
      await server.start();
      expect(mockSSEClientTransport.mock.calls.length).toBe(firstCallCount);
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

  describe('getTools', () => {
    const mockClient = {
      connect: jest.fn(),
      listTools: jest.fn().mockResolvedValue(['tool1', 'tool2']),
      onerror: jest.fn(),
    };

    beforeEach(async () => {
      (Client as jest.Mock).mockImplementation(() => mockClient);
      await server.start();
    });

    it('should return list of available tools', async () => {
      const tools = await server.getTools();
      expect(mockClient.listTools).toHaveBeenCalled();
      expect(tools).toEqual(['tool1', 'tool2']);
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

    it('should stop the server successfully', async () => {
      await server.stop();
      expect(mockClient.close).toHaveBeenCalled();
      expect(server.isStarted()).toBe(false);
    });

    it('should not attempt to stop if server is not started', async () => {
      await server.stop(); // First stop
      mockClient.close.mockClear();
      await server.stop(); // Second stop
      expect(mockClient.close).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update server configuration', () => {
      const newUrl = 'http://localhost:4000';
      server.update(newUrl);
      expect(server.url).toBe(newUrl);
    });
  });
});
