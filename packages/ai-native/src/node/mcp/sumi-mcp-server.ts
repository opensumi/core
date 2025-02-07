// 想要通过 MCP 的方式暴露 Opensumi 的 IDE 能力，就需要 Node.js 层打通 MCP 的通信
// 因为大部分 MCP 功能的实现在前端，因此需要再这里做前后端通信

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';

import { ISumiMCPServerBackend } from '../../common';
import { MCPServerManager } from '../../common/mcp-server-manager';
import { IMCPServerProxyService, MCPTool } from '../../common/types';
import { IMCPServer } from '../mcp-server';
import { MCPServerManagerImpl } from '../mcp-server-manager-impl';

// 每个 BrowserTab 都对应了一个 SumiMCPServerBackend 实例
// SumiMCPServerBackend 需要做的事情：
// 维护 Browser 端工具的注册和调用
// 处理第三方 MCP Server 的注册和调用

@Injectable({ multiple: true })
export class SumiMCPServerBackend extends RPCService<IMCPServerProxyService> implements ISumiMCPServerBackend {

  // 这里需要考虑不同的 BrowserTab 的区分问题，目前的 POC 所有的 Tab 都会注册到 tools 中
  // 后续需要区分不同的 Tab 对应的实例
  @Autowired(MCPServerManager)
  private readonly mcpServerManager: MCPServerManagerImpl;

  private server: Server | undefined;

  async getMCPTools() {
    if (!this.client) {
      throw new Error('SUMI MCP RPC Client not initialized');
    }
    // 获取 MCP 工具
    const tools =  await this.client.$getMCPTools();
    console.log('[Node backend] SUMI MCP tools', tools);
    return tools;
  }

  async callMCPTool(name: string, args: any) {
    if (!this.client) {
      throw new Error('SUMI MCP RPC Client not initialized');
    }
    return await this.client.$callMCPTool(name, args);
  }

  getServer() {
    return this.server;
  }

  // TODO 这里涉及到 Chat Stream Call 中带上 ClientID，具体方案需要进一步讨论
  async getAllMCPTools(): Promise<MCPTool[]> {
    return [];
  }

  initBuiltinMCPServer() {
    const builtinMCPServer = new BuiltinMCPServer(this);
    this.mcpServerManager.initBuiltinServer(builtinMCPServer);
  }

  async initExposedMCPServer() {
    // 初始化 MCP Server
    this.server = new Server(
      {
        name: 'sumi-ide-mcp-server',
        version: '0.2.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // 设置工具列表请求处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = await this.getMCPTools();
      return { tools };
    });

    // 设置工具调用请求处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        return await this.callMCPTool(name, args);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    });

    return this.server;
  }
}


export const TokenBuiltinMCPServer = Symbol('TokenBuiltinMCPServer');

export class BuiltinMCPServer implements IMCPServer {

  constructor(
    private readonly sumiMCPServer: SumiMCPServerBackend,
  ) {}

  private started: boolean = true;

  isStarted(): boolean {
    return this.started;
  }

  getServerName(): string {
    return 'sumi-builtin';
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    // TODO 考虑 MCP Server 的对外暴露
    // await this.sumiMCPServer.initMCPServer();
    this.started = true;
  }

  async callTool(toolName: string, arg_string: string): Promise<any> {
    if (!this.started) {
      throw new Error('MCP Server not started');
    }
    let args;
    try {
      args = JSON.parse(arg_string);
    } catch (error) {
      console.error(
        `Failed to parse arguments for calling tool "${toolName}" in Builtin MCP server.
        Invalid JSON: ${arg_string}`,
        error,
      );
      throw error;
    }
    return this.sumiMCPServer.callMCPTool(toolName, args);
  }

  async getTools(): ReturnType<Client['listTools']> {
    if (!this.started) {
      throw new Error('MCP Server not started');
    }
    const tools = await this.sumiMCPServer.getMCPTools();
    return { tools } as any;
  }

  update(_command: string, _args?: string[], _env?: { [key: string]: string }): void {
    // No-op for builtin server as it doesn't need command/args/env updates
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    // No explicit cleanup needed for in-memory server
    this.started = false;
  }
}

