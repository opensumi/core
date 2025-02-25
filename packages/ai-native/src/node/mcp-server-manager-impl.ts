import { ToolExecutionOptions } from 'ai';

import { ILogger } from '@opensumi/ide-core-common';

import { IMCPServer, MCPServerDescription, MCPServerManager, MCPTool } from '../common/mcp-server-manager';
import { IToolInvocationRegistryManager, ToolRequest } from '../common/tool-invocation-registry';
import { getToolName } from '../common/utils';

import { BuiltinMCPServer } from './mcp/sumi-mcp-server';
import { StdioMCPServerImpl } from './mcp-server';
// 这应该是 Browser Tab 维度的，每个 Tab 对应一个 MCPServerManagerImpl
export class MCPServerManagerImpl implements MCPServerManager {
  protected servers: Map<string, IMCPServer> = new Map();

  // 当前实例对应的 clientId
  private clientId: string;

  getServers(): Map<string, IMCPServer> {
    return this.servers;
  }

  constructor(
    private readonly toolInvocationRegistryManager: IToolInvocationRegistryManager,
    private readonly logger: ILogger,
  ) {}

  setClientId(clientId: string) {
    this.clientId = clientId;
  }

  private unregisterServerTools(serverName: string) {
    const registry = this.toolInvocationRegistryManager.getRegistry(this.clientId);
    registry.unregisterProviderTools(serverName);
  }

  async stopServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not found.`);
    }
    await server.stop();
    // 停止服务器后，需要从注册表中移除该服务器的所有工具
    this.unregisterServerTools(serverName);
    this.logger.log(`MCP server "${serverName}" stopped and tools unregistered.`);
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

  callTool(
    serverName: string,
    toolName: string,
    toolCallId: string,
    arg_string: string,
  ): ReturnType<IMCPServer['callTool']> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${toolName}" not found.`);
    }
    return server.callTool(toolName, toolCallId, arg_string);
  }

  async startServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server "${serverName}" not found.`);
    }
    await server.start();
    await this.registerTools(serverName);
  }

  async getServerNames(): Promise<string[]> {
    return Array.from(this.servers.keys());
  }

  private convertToToolRequest(tool: MCPTool, serverName: string): ToolRequest {
    const id = getToolName(tool.name, serverName);

    return {
      id,
      name: id,
      providerName: serverName,
      parameters: tool.inputSchema,
      description: tool.description,
      handler: async (arg_string: string, options?: ToolExecutionOptions) => {
        try {
          const res = await this.callTool(serverName, tool.name, options?.toolCallId || '', arg_string);
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
      const newServer = new StdioMCPServerImpl(name, command, args, env, this.logger);
      this.servers.set(name, newServer);
    }
  }

  addOrUpdateServerDirectly(server: IMCPServer): void {
    this.servers.set(server.getServerName(), server);
  }

  // enabled 为 true 时，会自动启动内置服务器, 并注册工具
  async initBuiltinServer(builtinMCPServer: BuiltinMCPServer, enabled: boolean = true): Promise<void> {
    this.addOrUpdateServerDirectly(builtinMCPServer);
    if (enabled) {
      await builtinMCPServer.start();
      await this.registerTools(builtinMCPServer.getServerName());
    }
  }

  async addExternalMCPServers(servers: MCPServerDescription[]): Promise<void> {
    for (const server of servers) {
      this.addOrUpdateServer(server);
      if (!server.enabled) {
        // 如果是 enabled 为 false 的 server，则不进行启动
        continue;
      }
      await this.startServer(server.name);
    }
  }

  removeServer(name: string): void {
    const server = this.servers.get(name);
    if (server) {
      server.stop();
      // 移除服务器时，也需要从注册表中移除该服务器的所有工具
      this.unregisterServerTools(name);
      this.servers.delete(name);
      this.logger.log(`MCP server "${name}" removed and tools unregistered.`);
    } else {
      this.logger.warn(`MCP server "${name}" not found.`);
    }
  }
}
