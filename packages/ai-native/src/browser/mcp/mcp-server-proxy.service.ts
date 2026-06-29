import { Autowired, Injectable } from '@opensumi/di';
import { ILogger } from '@opensumi/ide-core-browser';
import { Emitter, Event } from '@opensumi/ide-core-common';

import { BUILTIN_MCP_SERVER_NAME, ISumiMCPServerBackend, SumiMCPServerProxyServicePath } from '../../common';
import { ImageCompressionOptions, compressToolResultSmart } from '../../common/image-compression';
import { IMCPServerProxyService, IMCPToolResult } from '../../common/types';
import { IMCPServerRegistry, TokenMCPServerRegistry } from '../types';

function getJsonSchemaSourceSchema(inputSchema: any): any {
  const def = inputSchema?._def ?? inputSchema?.def;
  if (def?.type === 'pipe' && def.in) {
    return getJsonSchemaSourceSchema(def.in);
  }
  if (def?.typeName === 'ZodEffects' && def.schema) {
    return getJsonSchemaSourceSchema(def.schema);
  }
  return inputSchema;
}

function toJSONSchema(inputSchema: any): any {
  const sourceSchema = getJsonSchemaSourceSchema(inputSchema);
  if (typeof sourceSchema?.toJSONSchema === 'function') {
    return sourceSchema.toJSONSchema();
  }
  return sourceSchema;
}

function summarizeMCPTools(tools: Array<{ name: string; inputSchema: any }>) {
  const toolStats = tools.map((tool) => {
    const schemaBytes = Buffer.byteLength(JSON.stringify(tool.inputSchema ?? null), 'utf8');
    return {
      name: tool.name,
      schemaBytes,
    };
  });
  return {
    toolCount: tools.length,
    schemaBytes: toolStats.reduce((total, tool) => total + tool.schemaBytes, 0),
    largestSchemas: [...toolStats].sort((a, b) => b.schemaBytes - a.schemaBytes).slice(0, 5),
  };
}

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
  async $getBuiltinMCPTools() {
    const tools = await this.mcpServerRegistry.getMCPTools().map((tool) => {
      const jsonSchema = toJSONSchema(tool.inputSchema);

      return {
        name: tool.name,
        description: tool.description,
        inputSchema: jsonSchema,
        providerName: BUILTIN_MCP_SERVER_NAME,
      };
    });

    this.logger.log('SUMI MCP tools', summarizeMCPTools(tools));

    return tools;
  }

  // 通知前端 MCP 服务注册表发生了变化
  async $updateMCPServers() {
    this._onChangeMCPServers.fire('update');
  }

  async getAllMCPTools() {
    return this.sumiMCPServerProxyService.$getAllMCPTools();
  }

  async $getServers() {
    return this.sumiMCPServerProxyService.$getServers();
  }

  async $startServer(serverName: string) {
    await this.sumiMCPServerProxyService.$startServer(serverName);
  }

  async $stopServer(serverName: string) {
    await this.sumiMCPServerProxyService.$stopServer(serverName);
  }

  async $compressToolResult(result: IMCPToolResult, options: ImageCompressionOptions) {
    return compressToolResultSmart(result, options);
  }
}
