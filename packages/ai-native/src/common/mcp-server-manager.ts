import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface IMCPServer {
  isStarted(): boolean;
  start(): Promise<void>;
  getServerName(): string;
  callTool(toolName: string, toolCallId: string, arg_string: string): ReturnType<Client['callTool']>;
  getTools(): ReturnType<Client['listTools']>;
  update(command: string, args?: string[], env?: { [key: string]: string }): void;
  stop(): void;
}

export interface MCPServerManager {
  callTool(
    serverName: string,
    toolName: string,
    toolCallId: string,
    arg_string: string,
  ): ReturnType<Client['callTool']>;
  removeServer(name: string): void;
  addOrUpdateServer(description: MCPServerDescription): void;
  // invoke in node.js only
  addOrUpdateServerDirectly(server: any): void;
  initBuiltinServer(builtinMCPServer: any, enabled: boolean): void;
  getTools(serverName: string): ReturnType<Client['listTools']>;
  getServerNames(): Promise<string[]>;
  startServer(serverName: string): Promise<void>;
  stopServer(serverName: string): Promise<void>;
  getStartedServers(): Promise<string[]>;
  registerTools(serverName: string): Promise<void>;
  addExternalMCPServers(servers: MCPServerDescription[]): void;
  getServers(): Map<string, IMCPServer>;
}

export type MCPTool = Awaited<ReturnType<MCPServerManager['getTools']>>['tools'][number];

export type MCPToolParameter = Awaited<ReturnType<MCPServerManager['getTools']>>['tools'][number]['inputSchema'];

export interface MCPServerDescription {
  /**
   * The unique name of the MCP server.
   */
  name: string;

  /**
   * The command to execute the MCP server.
   */
  command: string;

  /**
   * An array of arguments to pass to the command.
   */
  args?: string[];

  /**
   * Optional environment variables to set when starting the server.
   */
  env?: { [key: string]: string };

  /**
   * Whether to enable the MCP server.
   */
  enabled?: boolean;
}

export const MCPServerManager = Symbol('MCPServerManager');
export const MCPServerManagerPath = 'ServicesMCPServerManager';
