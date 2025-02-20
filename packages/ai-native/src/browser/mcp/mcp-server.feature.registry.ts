// OpenSumi as MCP Server 前端的代理服务
import { Autowired, Injectable } from '@opensumi/di';
import { ILogger } from '@opensumi/ide-core-common';

import { getToolName } from '../../common/utils';
import { IMCPServerRegistry, IMCPServerToolComponentProps, MCPLogger, MCPToolDefinition } from '../types';

class LoggerAdapter implements MCPLogger {
  constructor(private readonly logger: ILogger) {}

  appendLine(message: string): void {
    this.logger.log(message);
  }
}

@Injectable()
export class MCPServerRegistry implements IMCPServerRegistry {
  private tools: MCPToolDefinition[] = [];
  private toolComponents: Record<string, React.FC<IMCPServerToolComponentProps>> = {};

  @Autowired(ILogger)
  private readonly baseLogger: ILogger;

  private get logger(): MCPLogger {
    return new LoggerAdapter(this.baseLogger);
  }

  getMCPTool(name: string, serverName = 'sumi-builtin'): MCPToolDefinition | undefined {
    return this.tools.find((tool) => getToolName(tool.name, serverName) === name);
  }

  registerMCPTool(tool: MCPToolDefinition): void {
    this.tools.push(tool);
  }

  registerToolComponent(
    name: string,
    component: React.FC<IMCPServerToolComponentProps>,
    serverName = 'sumi-builtin',
  ): void {
    this.toolComponents[getToolName(name, serverName)] = component;
  }

  getToolComponent(name: string): React.FC<IMCPServerToolComponentProps> | undefined {
    return this.toolComponents[name];
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
      // 统一校验并转换
      args = tool.inputSchema.parse(args);
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
