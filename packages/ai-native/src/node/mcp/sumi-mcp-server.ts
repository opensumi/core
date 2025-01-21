// 想要通过 MCP 的方式暴露 Opensumi 的 IDE 能力，就需要 Node.js 层打通 MCP 的通信
// 因为大部分 MCP 功能的实现在前端，因此需要再这里做前后端通信

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';

import { IMCPServerProxyService } from '../../common/types';
// @ts-ignore
// @ts-ignore

@Injectable()
export class SumiMCPServerBackend extends RPCService<IMCPServerProxyService> {
  private server: Server | undefined;

  async getMCPTools() {
    if (!this.client) {
      throw new Error('SUMI MCP RPC Client not initialized');
    }
    // 获取 MCP 工具
    return await this.client.$getMCPTools();
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

  async initMCPServer() {
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
