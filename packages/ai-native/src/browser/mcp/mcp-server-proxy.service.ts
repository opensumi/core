import { Autowired, Injectable } from '@opensumi/di';
import { ILogger } from '@opensumi/ide-core-browser';

import { IMCPServerRegistry, TokenMCPServerRegistry } from '../types';

@Injectable()
export class MCPServerProxyService {
  @Autowired(TokenMCPServerRegistry)
  private readonly mcpServerRegistry: IMCPServerRegistry;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  $callMCPTool(name: string, args: any) {
    return this.mcpServerRegistry.callMCPTool(name, args);
  }

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
}
