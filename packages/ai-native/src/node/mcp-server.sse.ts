// have to import with extension since the exports map is ./* -> ./dist/cjs/*
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { EventSource } from 'eventsource';

import { ILogger } from '@opensumi/ide-core-common';

import pkg from '../../package.json';
import { IMCPServer } from '../common/mcp-server-manager';

global.EventSource = EventSource as any;
export class SSEMCPServer implements IMCPServer {
  private name: string;
  public serverHost: string;
  private client: Client;
  private started: boolean = false;

  constructor(name: string, serverHost: string, private readonly logger?: ILogger) {
    this.name = name;
    this.serverHost = serverHost;
  }

  isStarted(): boolean {
    return this.started;
  }

  getServerName(): string {
    return this.name;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.logger?.log(`Starting server "${this.name}" with serverHost: ${this.serverHost}`);

    const SSEClientTransport = (await import('@modelcontextprotocol/sdk/client/sse.js')).SSEClientTransport;

    const transport = new SSEClientTransport(new URL(this.serverHost));
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

    await this.client.connect(transport);
    this.started = true;
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
    const params = {
      name: toolName,
      arguments: args,
      toolCallId,
    };
    return this.client.callTool(params);
  }

  async getTools() {
    const tools = await this.client.listTools();
    this.logger?.log(`Got tools from MCP server "${this.name}" with serverHost "${this.serverHost}":`, tools);
    return tools;
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
