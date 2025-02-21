import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

import { FileHandler } from './handlers/ReadFile';

const inputSchema = z
  .object({
    relative_workspace_path: z.string().describe('The path of the file to read, relative to the workspace root.'),
    should_read_entire_file: z.boolean().describe('Whether to read the entire file. Defaults to false.'),
    start_line_one_indexed: z.number().describe('The one-indexed line number to start reading from (inclusive).'),
    end_line_one_indexed_inclusive: z.number().describe('The one-indexed line number to end reading at (inclusive).'),
    explanation: z
      .string()
      .optional()
      .describe('One sentence explanation as to why this tool is being used, and how it contributes to the goal.'),
  })
  .transform((data) => ({
    relativeWorkspacePath: data.relative_workspace_path,
    readEntireFile: data.should_read_entire_file,
    startLineOneIndexed: data.start_line_one_indexed,
    endLineOneIndexedInclusive: data.end_line_one_indexed_inclusive,
  }));

@Domain(MCPServerContribution)
export class ReadFileTool implements MCPServerContribution {
  @Autowired(FileHandler)
  private readonly fileHandler: FileHandler;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'read_file',
      label: 'Read File',
      description: `Read the contents of a file (and the outline).

When using this tool to gather information, it's your responsibility to ensure you have the COMPLETE context. Each time you call this command you should:
1) Assess if contents viewed are sufficient to proceed with the task.
2) Take note of lines not shown.
3) If file contents viewed are insufficient, and you suspect they may be in lines not shown, proactively call the tool again to view those lines.
4) When in doubt, call this tool again to gather more information. Partial file views may miss critical dependencies, imports, or functionality.

If reading a range of lines is not enough, you may choose to read the entire file.
Reading entire files is often wasteful and slow, especially for large files (i.e. more than a few hundred lines). So you should use this option sparingly.
Reading the entire file is not allowed in most cases. You are only allowed to read the entire file if it has been edited or manually attached to the conversation by the user.`,
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema>, logger: MCPLogger) {
    const result = await this.fileHandler.readFile(args);
    return {
      content: [
        {
          type: 'text',
          text: result.didShortenLineRange
            ? `Contents of ${result.relativeWorkspacePath}, from line ${args.startLineOneIndexed}-${
                args.endLineOneIndexedInclusive
              }:

\`\`\`
// ${result.relativeWorkspacePath!.split('/').pop()}
${result.contents}
\`\`\``
            : `Full contents of ${args.relativeWorkspacePath}:

\`\`\`
${result.contents}
\`\`\``,
        },
      ],
    };
  }
}
