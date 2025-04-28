// have to import with extension since the exports map is ./* -> ./dist/cjs/*
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { EventSource } from 'eventsource';

import { ILogger } from '@opensumi/ide-core-common';

import pkg from '../../package.json';
import { IMCPServer } from '../common/mcp-server-manager';
import { SSEClientTransportOptions } from '../common/types';

global.EventSource = EventSource as any;
export class SSEMCPServer implements IMCPServer {
  private name: string;
  public serverHost: string;
  private transportOptions?: SSEClientTransportOptions;
  private client: Client;
  private started: boolean = false;
  private toolNameMap: Map<string, string> = new Map(); // Map sanitized tool names to original names

  constructor(
    name: string,
    serverHost: string,
    private readonly logger?: ILogger,
    private readonly options?: SSEClientTransportOptions,
  ) {
    this.name = name;
    this.serverHost = serverHost;
    this.transportOptions = options;
  }

  isStarted(): boolean {
    return this.started;
  }

  getServerName(): string {
    return this.name;
  }

  getClient(): Client | null {
    return this.client;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.logger?.log(`Starting server "${this.name}" with serverHost: ${this.serverHost}`);

    const SSEClientTransport = (await import('@modelcontextprotocol/sdk/client/sse.js')).SSEClientTransport;

    const transport = new SSEClientTransport(new URL(this.serverHost), this.transportOptions);

    transport.onerror = (error) => {
      this.logger?.error('Transport Error:', error);
    };

    this.client = new Client(
      {
        name: 'sumi-ide-sse-mcp-client',
        version: pkg.version,
      },
      {
        capabilities: {},
      },
    );
    this.client.onerror = (error) => {
      this.logger?.error('Error in MCP client:', error);
    };

    try {
      await this.client.connect(transport);
      this.started = true;
    } catch (error) {
      this.logger?.error(`Error in startServer for ${this.name}:`, error);
      throw error;
    }
  }

  async callTool(toolName: string, toolCallId: string, arg_string: string) {
    let args;
    try {
      args = JSON.parse(arg_string);
    } catch (error) {
      this.logger?.error(
        `Failed to parse arguments for calling tool "${toolName}" in MCP server "${this.name}" with serverHost "${this.serverHost}".
                Invalid JSON: ${arg_string}`,
        error,
      );
    }
    // Convert sanitized tool name back to original name if it exists in the map
    const originalToolName = this.toolNameMap.get(toolName) || toolName;
    const params = {
      name: originalToolName,
      arguments: args,
      toolCallId,
    };
    return this.client.callTool(params);
  }

  async getTools() {
    const originalTools = await this.client.listTools();
    this.toolNameMap.clear();
    const toolsArray = originalTools.tools || [];
    const sanitizedToolsArray = toolsArray.map((tool) => {
      const originalName = tool.name;
      // Remove Chinese characters from the tool name
      // Claude 3.5+ Sonnet 不支持中文 Tool Name
      const sanitizedName = originalName.replace(/[\u4e00-\u9fa5]/g, '');
      // If the name changed, store the mapping
      if (sanitizedName !== originalName) {
        this.toolNameMap.set(sanitizedName, originalName);
        return { ...tool, name: sanitizedName };
      }
      return tool;
    });
    const sanitizedTools = {
      ...originalTools,
      tools: sanitizedToolsArray,
    };
    this.logger?.log(`Got tools from MCP server "${this.name}" with serverHost "${this.serverHost}":`, sanitizedTools);
    this.logger?.log('Tool name mapping: ', Object.fromEntries(this.toolNameMap));
    return sanitizedTools;
  }

  update(serverHost: string): void {
    this.serverHost = serverHost;
  }

  async stop(): Promise<void> {
    if (!this.started || !this.client) {
      return;
    }
    this.logger?.log(`Stopping MCP server "${this.name}"`);
    try {
      await this.client.close();
    } catch (error) {
      this.logger?.error(`Failed to stop MCP server "${this.name}":`, error);
    }
    this.logger?.log(`MCP server "${this.name}" stopped`);
    this.started = false;
  }
}
