// @ts-ignore
import type Client from '@modelcontextprotocol/sdk/client/index';


export class MCPServer {
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

    async start(): Promise<void> {
        if (this.started) {
            return;
        }
        console.log(`Starting server "${this.name}" with command: ${this.command} and args: ${this.args?.join(' ')} and env: ${JSON.stringify(this.env)}`);
        // Filter process.env to exclude undefined values
        const sanitizedEnv: Record<string, string> = Object.fromEntries(
            Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
        );

        const mergedEnv: Record<string, string> = {
            ...sanitizedEnv,
            ...(this.env || {})
        };
        const StdioClientTransport = (await import('@modelcontextprotocol/sdk/client/stdio.js')).StdioClientTransport;
        const transport = new StdioClientTransport({
            command: this.command,
            args: this.args,
            env: mergedEnv,
        });
        transport.onerror = error => {
            console.error('Error: ' + error);
        };

        const Client = (await import('@modelcontextprotocol/sdk/client/index.js')).Client;
        this.client = new Client({
            name: 'opensumi-mcp-client',
            version: '1.0.0',
        }, {
            capabilities: {}
        });
        this.client.onerror = error => {
            console.error('Error in MCP client: ' + error);
        };

        await this.client.connect(transport);
        this.started = true;
    }

    async callTool(toolName: string, arg_string: string): Promise<ReturnType<Client['callTool']>> {
        let args;
        try {
            args = JSON.parse(arg_string);
        } catch (error) {
            console.error(
                `Failed to parse arguments for calling tool "${toolName}" in MCP server "${this.name}" with command "${this.command}".
                Invalid JSON: ${arg_string}`,
                error
            );
        }
        const params = {
            name: toolName,
            arguments: args,
        };
        return this.client.callTool(params);
    }

    async getTools(): Promise<ReturnType<Client['listTools']>> {
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
