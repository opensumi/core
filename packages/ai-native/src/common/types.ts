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
  $getMCPTools(): Promise<
    {
      name: string;
      description: string;
      inputSchema: any;
    }[]
  >;
}
