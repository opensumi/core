import { Autowired, Injectable } from '@opensumi/di';

import { IMCPServerRegistry, TokenMCPServerRegistry } from '../types';

@Injectable()
export class MCPServerProxyService {
  @Autowired(TokenMCPServerRegistry)
  private readonly mcpServerRegistry: IMCPServerRegistry;

  $callMCPTool(name: string, args: any) {
    return this.mcpServerRegistry.callMCPTool(name, args);
  }

  async $getMCPTools() {
    return this.mcpServerRegistry.getMCPTools().map((tool) =>
      // 不要传递 handler
       ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }),
    );
  }
}
