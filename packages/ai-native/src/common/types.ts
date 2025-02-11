export enum NearestCodeBlockType {
  Block = 'block',
  Line = 'line',
}

export interface INearestCodeBlock {
  range: {
    start: {
      line: number;
      character: number;
    };
    end: {
      line: number;
      character: number;
    };
  };
  codeBlock: string;
  offset: number;
  type?: NearestCodeBlockType;
}

// SUMI MCP Server 网页部分暴露给 Node.js 部分的能力
export interface IMCPServerProxyService {
  $callMCPTool(
    name: string,
    args: any,
  ): Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
  // 获取 browser 层注册的 MCP 工具列表 (Browser tab 维度)
  $getMCPTools(): Promise<MCPTool[]>;
  // 通知前端 MCP 服务注册表发生了变化
  $updateMCPServers(): Promise<void>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  providerName: string;
}
