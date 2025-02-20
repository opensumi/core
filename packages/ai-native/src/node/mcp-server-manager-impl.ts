import { ILogger } from '@opensumi/ide-core-common';

import { MCPServerDescription, MCPServerManager, MCPTool } from '../common/mcp-server-manager';
import { IToolInvocationRegistryManager, ToolRequest } from '../common/tool-invocation-registry';

import { BuiltinMCPServer } from './mcp/sumi-mcp-server';
import { IMCPServer, MCPServerImpl } from './mcp-server';

// 这应该是 Browser Tab 维度的，每个 Tab 对应一个 MCPServerManagerImpl
export class MCPServerManagerImpl implements MCPServerManager {
  protected servers: Map<string, IMCPServer> = new Map();

  // 当前实例对应的 clientId
  private clientId: string;

  constructor(
    private readonly toolInvocationRegistryManager: IToolInvocationRegistryManager,
    private readonly logger: ILogger,
  ) {}

  setClientId(clientId: string) {
    this.clientId = clientId;
  }

  async stopServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not found.`);
    }
    server.stop();
    this.logger.log(`MCP server "${serverName}" stopped.`);
  }

  async getStartedServers(): Promise<string[]> {
    const startedServers: string[] = [];
    for (const [name, server] of this.servers.entries()) {
      if (server.isStarted()) {
        startedServers.push(name);
      }
    }
    return startedServers;
  }

  callTool(serverName: string, toolName: string, arg_string: string): ReturnType<IMCPServer['callTool']> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${toolName}" not found.`);
    }
    return server.callTool(toolName, arg_string);
  }

  async startServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not found.`);
    }
    await server.start();
  }

  async getServerNames(): Promise<string[]> {
    return Array.from(this.servers.keys());
  }

  private convertToToolRequest(tool: MCPTool, serverName: string): ToolRequest {
    const id = `mcp_${serverName}_${tool.name}`;

    return {
      id,
      name: id,
      providerName: serverName,
      parameters: tool.inputSchema,
      description: tool.description,
      handler: async (arg_string: string) => {
        try {
          const res = await this.callTool(serverName, tool.name, arg_string);
          this.logger.debug(`[MCP: ${serverName}] ${tool.name} called with ${arg_string}`);
          this.logger.debug('Tool execution result:', res);
          return JSON.stringify(res);
        } catch (error) {
          this.logger.error(`Error in tool handler for ${tool.name} on MCP server ${serverName}:`, error);
          throw error;
        }
      },
    };
  }

  public async registerTools(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not found.`);
    }

    const { tools } = await server.getTools();
    const toolRequests: ToolRequest[] = tools.map((tool) => this.convertToToolRequest(tool, serverName));

    const registry = this.toolInvocationRegistryManager.getRegistry(this.clientId);
    for (const toolRequest of toolRequests) {
      registry.registerTool(toolRequest);
    }
  }

  public async getTools(serverName: string): ReturnType<IMCPServer['getTools']> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not found.`);
    }
    return server.getTools();
  }

  addOrUpdateServer(description: MCPServerDescription): void {
    const { name, command, args, env } = description;
    const existingServer = this.servers.get(name);

    if (existingServer) {
      existingServer.update(command, args, env);
    } else {
      const newServer = new MCPServerImpl(name, command, args, env, this.logger);
      this.servers.set(name, newServer);
    }
  }

  addOrUpdateServerDirectly(server: IMCPServer): void {
    this.servers.set(server.getServerName(), server);
  }

  async initBuiltinServer(builtinMCPServer: BuiltinMCPServer): Promise<void> {
    this.addOrUpdateServerDirectly(builtinMCPServer);
    await this.registerTools(builtinMCPServer.getServerName());
  }

  async addExternalMCPServers(servers: MCPServerDescription[]): Promise<void> {
    for (const server of servers) {
      this.addOrUpdateServer(server);
      await this.startServer(server.name);
      await this.registerTools(server.name);
    }
  }

  removeServer(name: string): void {
    const server = this.servers.get(name);
    if (server) {
      server.stop();
      this.servers.delete(name);
    } else {
      this.logger.warn(`MCP server "${name}" not found.`);
    }
  }
}
