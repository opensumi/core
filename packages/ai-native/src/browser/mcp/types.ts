
export interface Logger {
  appendLine(message: string): void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any, logger: Logger) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}
