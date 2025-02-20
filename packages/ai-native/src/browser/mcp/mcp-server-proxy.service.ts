import { Autowired, Injectable } from '@opensumi/di';
import { ILogger } from '@opensumi/ide-core-browser';
import { Emitter, Event } from '@opensumi/ide-core-common';

import { ISumiMCPServerBackend, SumiMCPServerProxyServicePath } from '../../common';
import { IMCPServerProxyService } from '../../common/types';
import { IMCPServerRegistry, TokenMCPServerRegistry } from '../types';

@Injectable()
export class MCPServerProxyService implements IMCPServerProxyService {
  @Autowired(TokenMCPServerRegistry)
  private readonly mcpServerRegistry: IMCPServerRegistry;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(SumiMCPServerProxyServicePath)
  private readonly sumiMCPServerProxyService: ISumiMCPServerBackend;

  private readonly _onChangeMCPServers = new Emitter<any>();
  public readonly onChangeMCPServers: Event<any> = this._onChangeMCPServers.event;

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
        providerName: 'sumi-builtin',
      }),
    );

    this.logger.log('SUMI MCP tools', tools);

    return tools;
  }

  // 通知前端 MCP 服务注册表发生了变化
  async $updateMCPServers() {
    this._onChangeMCPServers.fire('update');
  }

  async getAllMCPTools() {
    return this.sumiMCPServerProxyService.getAllMCPTools();
  }
}
