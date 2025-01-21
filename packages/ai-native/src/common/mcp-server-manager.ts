// @ts-ignore
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface MCPServer {
    callTool(toolName: string, arg_string: string): ReturnType<Client['callTool']>;
    getTools(): ReturnType<Client['listTools']>;
}

export interface MCPServerManager {
    callTool(serverName: string, toolName: string, arg_string: string): ReturnType<MCPServer['callTool']>;
    removeServer(name: string): void;
    addOrUpdateServer(description: MCPServerDescription): void;
    getTools(serverName: string): ReturnType<MCPServer['getTools']>
    getServerNames(): Promise<string[]>;
    startServer(serverName: string): Promise<void>;
    stopServer(serverName: string): Promise<void>;
    getStartedServers(): Promise<string[]>;
    collectTools(serverName: string): Promise<void>;
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
}

export const MCPServerManager = Symbol('MCPServerManager');
export const MCPServerManagerPath = 'ServicesMCPServerManager';
