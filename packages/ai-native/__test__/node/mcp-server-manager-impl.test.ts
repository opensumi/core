import { MCPServerManagerImpl } from '../../src/node/mcp-server-manager-impl';
import { MCPServerDescription } from '../../src/common/mcp-server-manager';
import { MCPServer } from '../../src/node/mcp-server';

jest.mock('../../src/node/mcp-server');

describe('MCPServerManagerImpl', () => {
  let manager: MCPServerManagerImpl;
  let mockServer: jest.Mocked<MCPServer>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new MCPServerManagerImpl();
    mockServer = new MCPServer('test-server', 'test-command', [], {}) as jest.Mocked<MCPServer>;
    (MCPServer as jest.MockedClass<typeof MCPServer>).mockImplementation(() => mockServer);
  });

  describe('addOrUpdateServer', () => {
    const serverDescription: MCPServerDescription = {
      name: 'test-server',
      command: 'test-command',
      args: [],
      env: {}
    };

    it('should add a new server', () => {
      manager.addOrUpdateServer(serverDescription);
      expect(MCPServer).toHaveBeenCalledWith(
        serverDescription.name,
        serverDescription.command,
        serverDescription.args,
        serverDescription.env
      );
    });

    it('should update existing server', () => {
      manager.addOrUpdateServer(serverDescription);
      const updatedDescription = { ...serverDescription, command: 'new-command' };
      manager.addOrUpdateServer(updatedDescription);
      expect(mockServer.update).toHaveBeenCalledWith(
        updatedDescription.command,
        updatedDescription.args,
        updatedDescription.env
      );
    });
  });

  describe('startServer', () => {
    it('should start an existing server', async () => {
      manager.addOrUpdateServer({
        name: 'test-server',
        command: 'test-command',
        args: [],
        env: {}
      });
      
      await manager.startServer('test-server');
      expect(mockServer.start).toHaveBeenCalled();
    });

    it('should throw error when starting non-existent server', async () => {
      await expect(manager.startServer('non-existent')).rejects.toThrow(
        'MCP server "non-existent" not found.'
      );
    });
  });

  describe('stopServer', () => {
    it('should stop an existing server', async () => {
      manager.addOrUpdateServer({
        name: 'test-server',
        command: 'test-command',
        args: [],
        env: {}
      });

      await manager.stopServer('test-server');
      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('should throw error when stopping non-existent server', async () => {
      await expect(manager.stopServer('non-existent')).rejects.toThrow(
        'MCP server "non-existent" not found.'
      );
    });
  });

  describe('getStartedServers', () => {
    it('should return list of started servers', async () => {
      manager.addOrUpdateServer({
        name: 'server1',
        command: 'cmd1',
        args: [],
        env: {}
      });
      manager.addOrUpdateServer({
        name: 'server2',
        command: 'cmd2',
        args: [],
        env: {}
      });

      mockServer.isStarted.mockReturnValueOnce(true).mockReturnValueOnce(false);
      const startedServers = await manager.getStartedServers();
      expect(startedServers).toEqual(['server1']);
    });
  });

  describe('getServerNames', () => {
    it('should return list of all server names', async () => {
      manager.addOrUpdateServer({
        name: 'server1',
        command: 'cmd1',
        args: [],
        env: {}
      });
      manager.addOrUpdateServer({
        name: 'server2',
        command: 'cmd2',
        args: [],
        env: {}
      });

      const serverNames = await manager.getServerNames();
      expect(serverNames).toEqual(['server1', 'server2']);
    });
  });

  describe('removeServer', () => {
    it('should remove an existing server', () => {
      manager.addOrUpdateServer({
        name: 'test-server',
        command: 'test-command',
        args: [],
        env: {}
      });

      manager.removeServer('test-server');
      expect(mockServer.stop).toHaveBeenCalled();
    });

    it('should handle removing non-existent server', () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      manager.removeServer('non-existent');
      expect(consoleSpy).toHaveBeenCalledWith('MCP server "non-existent" not found.');
    });
  });

  describe('callTool', () => {
    it('should call tool on existing server', () => {
      manager.addOrUpdateServer({
        name: 'test-server',
        command: 'test-command',
        args: [],
        env: {}
      });

      manager.callTool('test-server', 'test-tool', 'test-args');
      expect(mockServer.callTool).toHaveBeenCalledWith('test-tool', 'test-args');
    });

    it('should throw error when calling tool on non-existent server', () => {
      expect(() => manager.callTool('non-existent', 'test-tool', 'test-args')).toThrow(
        'MCP server "test-tool" not found.'
      );
    });
  });

  describe('getTools', () => {
    it('should get tools from existing server', async () => {
      manager.addOrUpdateServer({
        name: 'test-server',
        command: 'test-command',
        args: [],
        env: {}
      });

      await manager.getTools('test-server');
      expect(mockServer.getTools).toHaveBeenCalled();
    });

    it('should throw error when getting tools from non-existent server', async () => {
      await expect(manager.getTools('non-existent')).rejects.toThrow(
        'MCP server "non-existent" not found.'
      );
    });
  });
}); 