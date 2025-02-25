import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { MCPServerDescription, MCPServerManager } from '../../src/common/mcp-server-manager';

describe('MCPServerManager Interface', () => {
  let mockManager: MCPServerManager;
  const mockClient = {
    callTool: jest.fn(),
    listTools: jest.fn(),
  };

  const mockServer: MCPServerDescription = {
    name: 'test-server',
    command: 'test-command',
    args: ['arg1', 'arg2'],
    env: { TEST_ENV: 'value' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockManager = {
      callTool: jest.fn(),
      removeServer: jest.fn(),
      addOrUpdateServer: jest.fn(),
      addOrUpdateServerDirectly: jest.fn(),
      initBuiltinServer: jest.fn(),
      getTools: jest.fn(),
      getServerNames: jest.fn(),
      startServer: jest.fn(),
      stopServer: jest.fn(),
      getStartedServers: jest.fn(),
      registerTools: jest.fn(),
      addExternalMCPServers: jest.fn(),
      getServers: jest.fn(),
    };
  });

  describe('Server Management', () => {
    it('should add or update server', async () => {
      await mockManager.addOrUpdateServer(mockServer);
      expect(mockManager.addOrUpdateServer).toHaveBeenCalledWith(mockServer);
    });

    it('should remove server', async () => {
      await mockManager.removeServer('test-server');
      expect(mockManager.removeServer).toHaveBeenCalledWith('test-server');
    });

    it('should get server names', async () => {
      const expectedServers = ['server1', 'server2'];
      (mockManager.getServerNames as jest.Mock).mockResolvedValue(expectedServers);

      const servers = await mockManager.getServerNames();
      expect(servers).toEqual(expectedServers);
      expect(mockManager.getServerNames).toHaveBeenCalled();
    });

    it('should get started servers', async () => {
      const expectedStartedServers = ['server1'];
      (mockManager.getStartedServers as jest.Mock).mockResolvedValue(expectedStartedServers);

      const startedServers = await mockManager.getStartedServers();
      expect(startedServers).toEqual(expectedStartedServers);
      expect(mockManager.getStartedServers).toHaveBeenCalled();
    });
  });

  describe('Server Operations', () => {
    it('should start server', async () => {
      await mockManager.startServer('test-server');
      expect(mockManager.startServer).toHaveBeenCalledWith('test-server');
    });

    it('should stop server', async () => {
      await mockManager.stopServer('test-server');
      expect(mockManager.stopServer).toHaveBeenCalledWith('test-server');
    });

    it('should register tools for server', async () => {
      await mockManager.registerTools('test-server');
      expect(mockManager.registerTools).toHaveBeenCalledWith('test-server');
    });
  });

  describe('Tool Operations', () => {
    it('should call tool on server', async () => {
      const toolName = 'test-tool';
      const argString = '{"key": "value"}';
      await mockManager.callTool('test-server', toolName, 'call-x', argString);
      expect(mockManager.callTool).toHaveBeenCalledWith('test-server', toolName, 'call-x', argString);
    });

    it('should get tools from server', async () => {
      const expectedTools = {
        tools: [
          {
            name: 'test-tool',
            description: 'Test tool description',
            inputSchema: {},
          },
        ],
      };
      (mockManager.getTools as jest.Mock).mockResolvedValue(expectedTools);

      const tools = await mockManager.getTools('test-server');
      expect(tools).toEqual(expectedTools);
      expect(mockManager.getTools).toHaveBeenCalledWith('test-server');
    });
  });

  describe('External Servers', () => {
    it('should add external MCP servers', async () => {
      const externalServers: MCPServerDescription[] = [
        {
          name: 'external-server',
          command: 'external-command',
          args: ['ext-arg'],
          env: { EXT_ENV: 'value' },
        },
      ];

      await mockManager.addExternalMCPServers(externalServers);
      expect(mockManager.addExternalMCPServers).toHaveBeenCalledWith(externalServers);
    });
  });
});
