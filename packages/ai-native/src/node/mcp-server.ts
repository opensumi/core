// have to import with extension since the exports map is ./* -> ./dist/cjs/*
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface IMCPServer {
    isStarted(): boolean;
    start(): Promise<void>;
    getServerName(): string;
    callTool(toolName: string, arg_string: string): Promise<ReturnType<Client['callTool']>>;
    getTools(): Promise<ReturnType<Client['listTools']>>;
    update(command: string, args?: string[], env?: { [key: string]: string }): void;
    stop(): void;
}

export class MCPServerImpl implements IMCPServer {
    private name: string;
    private command: string;
    private args?: string[];
    private client: Client;
    private env?: { [key: string]: string };
    private started: boolean = false;

  constructor(name: string, command: string, args?: string[], env?: Record<string, string>) {
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
    console.log(
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
      console.error('Error: ' + error);
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
      console.error('Error in MCP client: ' + error);
    };

    await this.client.connect(transport);
    this.started = true;
  }

  async callTool(toolName: string, arg_string: string) {
    let args;
    try {
      args = JSON.parse(arg_string);
    } catch (error) {
      console.error(
        `Failed to parse arguments for calling tool "${toolName}" in MCP server "${this.name}" with command "${this.command}".
                Invalid JSON: ${arg_string}`,
        error,
      );
    }
    const params = {
      name: toolName,
      arguments: args,
    };
    return this.client.callTool(params);
  }

  async getTools() {
    return this.client.listTools();
  }

  update(command: string, args?: string[], env?: { [key: string]: string }): void {
    this.command = command;
    this.args = args;
    this.env = env;
  }

  stop(): void {
    if (!this.started || !this.client) {
      return;
    }
    console.log(`Stopping MCP server "${this.name}"`);
    this.client.close();
    this.started = false;
  }
}
