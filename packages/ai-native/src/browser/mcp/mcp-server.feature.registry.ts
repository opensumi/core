// OpenSumi as MCP Server 前端的代理服务
import { Autowired, Injectable } from '@opensumi/di';
import { IAIBackService, ILogger } from '@opensumi/ide-core-common';

import { IMCPServerRegistry, MCPLogger, MCPToolDefinition } from '../types';

class LoggerAdapter implements MCPLogger {
  constructor(private readonly logger: ILogger) {}

  appendLine(message: string): void {
    this.logger.log(message);
  }
}

@Injectable()
export class MCPServerRegistry implements IMCPServerRegistry {
  private tools: MCPToolDefinition[] = [];

  @Autowired(ILogger)
  private readonly baseLogger: ILogger;

  private get logger(): MCPLogger {
    return new LoggerAdapter(this.baseLogger);
  }

  registerMCPTool(tool: MCPToolDefinition): void {
    this.tools.push(tool);
  }

  getMCPTools(): MCPToolDefinition[] {
    return this.tools;
  }

  async callMCPTool(
    name: string,
    args: any,
  ): Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }> {
    try {
      const tool = this.tools.find((tool) => tool.name === name);
      if (!tool) {
        throw new Error(`MCP tool ${name} not found`);
      }
      return await tool.handler(args, this.logger);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('callMCPTool error:', error);
      return {
        content: [{ type: 'text', text: `The tool ${name} failed to execute. Error: ${error}` }],
        isError: true,
      };
    }
  }
}
