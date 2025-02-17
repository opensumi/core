import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Autowired, Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

const inputSchema = z.object({});

@Domain(MCPServerContribution)
export class GetCurrentFilePathTool implements MCPServerContribution {
  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'get_open_in_editor_file_path',
      description:
        'Retrieves the absolute path of the currently active file in the VS Code editor. ' +
        'Use this tool to get the file location for tasks requiring file path information. ' +
        'Returns an empty string if no file is currently open.',
      inputSchema: zodToJsonSchema(inputSchema),
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema>, logger: MCPLogger) {
    const editor = this.editorService.currentEditor;
    if (!editor || !editor.currentUri) {
      logger.appendLine('Error: No active text editor found');
      return {
        content: [{ type: 'text', text: '' }],
      };
    }

    const path = editor.currentUri.toString();
    logger.appendLine(`Current file path: ${path}`);

    return {
      content: [{ type: 'text', text: path }],
    };
  }
}
