import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

import { EditFileToolComponent } from './components/EditFile';
import { CreateNewFileWithTextHandler } from './handlers/CreateNewFileWithText';

const inputSchema = z
  .object({
    target_file: z.string().describe('The relative path where the file should be created'),
    code_edit: z.string().describe('The content to write into the new file'),
  })
  .transform((data) => ({
    targetFile: data.target_file,
    codeEdit: data.code_edit,
  }));

@Domain(MCPServerContribution)
export class CreateNewFileWithTextTool implements MCPServerContribution {
  @Autowired(CreateNewFileWithTextHandler)
  private readonly createNewFileWithTextHandler: CreateNewFileWithTextHandler;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
    registry.registerToolComponent('create_new_file_with_text', EditFileToolComponent);
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'create_new_file_with_text',
      label: 'Create File',
      order: 7,
      description:
        'Creates a new file at the specified path within the project directory and populates it with the provided text. ' +
        'Use this tool to generate new files in your project structure. ' +
        'Returns one of two possible responses: ' +
        '"ok" if the file was successfully created and populated, ' +
        '"can\'t find project dir" if the project directory cannot be determined. ' +
        'Note: This tool creates any necessary parent directories automatically.',
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema> & { toolCallId: string }, logger: MCPLogger) {
    try {
      await this.createNewFileWithTextHandler.handler(args, args.toolCallId, logger);
      return {
        content: [{ type: 'text', text: 'create file with text success' }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true,
      };
    }
  }
}
