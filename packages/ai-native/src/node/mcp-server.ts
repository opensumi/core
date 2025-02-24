// have to import with extension since the exports map is ./* -> ./dist/cjs/*
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { ILogger } from '@opensumi/ide-core-common';

import { IMCPServer } from '../common/mcp-server-manager';

export class StdioMCPServerImpl implements IMCPServer {
  private name: string;
  public command: string;
  public args?: string[];
  private client: Client;
  private env?: { [key: string]: string };
  private started: boolean = false;

  constructor(
    name: string,
    command: string,
    args?: string[],
    env?: Record<string, string>,
    private readonly logger?: ILogger,
  ) {
    this.name = name;
    this.command = command;
    this.args = args;
    this.env = env;
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
    this.logger?.log(
      `Starting server "${this.name}" with command: ${this.command} and args: ${this.args?.join(
        ' ',
      )} and env: ${JSON.stringify(this.env)}`,
    );
    // Filter process.env to exclude undefined values
    const sanitizedEnv: Record<string, string> = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    const mergedEnv: Record<string, string> = {
      ...sanitizedEnv,
      ...(this.env || {}),
    };
    const transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      env: mergedEnv,
    });
    transport.onerror = (error) => {
      this.logger?.error('Transport Error:', error);
    };

    this.client = new Client(
      {
        name: 'opensumi-mcp-client',
        version: '1.0.0',
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
        `Failed to parse arguments for calling tool "${toolName}" in MCP server "${this.name}" with command "${this.command}".
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
    return await this.client.listTools();
  }

  update(command: string, args?: string[], env?: { [key: string]: string }): void {
    this.command = command;
    this.args = args;
    this.env = env;
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
