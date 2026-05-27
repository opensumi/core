export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
  execute: (args: any) => Promise<any>;
}

export interface NavigatorModelContext {
  registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): { dispose(): void };
  executeTool(name: string, args: any): Promise<any>;
  getTools(): Omit<WebMCPTool, 'execute'>[];
}
