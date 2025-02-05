import { Autowired, Injectable } from '@opensumi/di';
import { ILogger } from '@opensumi/ide-core-browser';

import { ISumiMCPServerBackend, SumiMCPServerProxyServicePath } from '../../common';
import { IMCPServerRegistry, TokenMCPServerRegistry } from '../types';

@Injectable()
export class MCPServerProxyService {
  @Autowired(TokenMCPServerRegistry)
  private readonly mcpServerRegistry: IMCPServerRegistry;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(SumiMCPServerProxyServicePath)
  private readonly sumiMCPServerProxyService: ISumiMCPServerBackend;

  // 调用 OpenSumi 内部注册的 MCP 工具
  $callMCPTool(name: string, args: any) {
    return this.mcpServerRegistry.callMCPTool(name, args);
  }

  // 获取 OpenSumi 内部注册的 MCP tools
  async $getMCPTools() {
    const tools = await this.mcpServerRegistry.getMCPTools().map((tool) =>
      // 不要传递 handler
       ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }),
    );

    this.logger.log('SUMI MCP tools', tools);

    return tools;
  }

  async getAllMCPTools() {
    return this.sumiMCPServerProxyService.getAllMCPTools();
  }
}
