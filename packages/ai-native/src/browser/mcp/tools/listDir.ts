import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

import { ListDirHandler } from './handlers/ListDir';

const inputSchema = z
  .object({
    relative_workspace_path: z
      .string()
      .describe("Path to list contents of, relative to the workspace root. Ex: './' is the root of the workspace"),
    explanation: z
      .string()
      .describe('One sentence explanation as to why this tool is being used, and how it contributes to the goal.'),
  })
  .transform((data) => ({
    relativeWorkspacePath: data.relative_workspace_path,
  }));

@Domain(MCPServerContribution)
export class ListDirTool implements MCPServerContribution {
  @Autowired(ListDirHandler)
  private readonly listDirHandler: ListDirHandler;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'list_dir',
      label: 'List Directory',
      description:
        'List the contents of a directory. The quick tool to use for discovery, before using more targeted tools like semantic search or file reading. Useful to try to understand the file structure before diving deeper into specific files. Can be used to explore the codebase.',
      inputSchema: zodToJsonSchema(inputSchema),
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema>, logger: MCPLogger) {
    const result = await this.listDirHandler.handler(args);
    return {
      content: [
        {
          type: 'text',
          text: `Contents of directory:


          ${result.files
            .map(
              (file) =>
                `[${file.isDirectory ? 'dir' : 'file'}] ${file.name} ${
                  file.isDirectory ? `(${file.numChildren ?? '?'} items)` : `(${file.size}KB, ${file.numLines} lines)`
                } - ${new Date(file.lastModified).toLocaleString()}`,
            )
            .join('\n')}`,
        },
      ],
    };
  }
}
