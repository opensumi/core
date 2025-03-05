// OpenSumi as MCP Server 前端的代理服务
import { Autowired, Injectable } from '@opensumi/di';
import { AIServiceType, IAIReporter, ILogger } from '@opensumi/ide-core-common';

import { BUILTIN_MCP_SERVER_NAME } from '../../common';
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

  private _activeMessageInfo: {
    messageId: string;
    sessionId: string;
  };

  @Autowired(ILogger)
  private readonly baseLogger: ILogger;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  private get logger(): MCPLogger {
    return new LoggerAdapter(this.baseLogger);
  }

  /** 设置当前活跃的消息信息，便于toolCall打点 */
  set activeMessageInfo(params: { messageId: string; sessionId: string }) {
    this._activeMessageInfo = params;
  }

  getMCPTool(name: string, serverName = BUILTIN_MCP_SERVER_NAME): MCPToolDefinition | undefined {
    return this.tools.find((tool) => getToolName(tool.name, serverName) === name);
  }

  registerMCPTool(tool: MCPToolDefinition): void {
    this.tools.push(tool);
  }

  registerToolComponent(
    name: string,
    component: React.FC<IMCPServerToolComponentProps>,
    serverName = BUILTIN_MCP_SERVER_NAME,
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
      const toolCallId = args.toolCallId;
      args = tool.inputSchema.parse(args);
      const result = await tool.handler({ ...args, toolCallId }, this.logger);
      this.reportToolCall(name, args, result, toolCallId);
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('callMCPTool error:', error);
      this.reportToolCall(name, args, error, args.toolCallId);
      return {
        content: [{ type: 'text', text: `The tool ${name} failed to execute. Error: ${error}` }],
        isError: true,
      };
    }
  }

  private reportToolCall(name: string, args: any, result: any, toolCallId: string) {
    const tool = this.tools.find((tool) => tool.name === name);
    if (!tool) {
      throw new Error(`MCP tool ${name} not found`);
    }
    this.aiReporter.send({
      msgType: AIServiceType.ToolCall,
      message: JSON.stringify({ args, name, result }),
      messageId: this._activeMessageInfo.messageId,
      sessionId: this._activeMessageInfo.sessionId,
      relationId: toolCallId,
    });
  }
}
