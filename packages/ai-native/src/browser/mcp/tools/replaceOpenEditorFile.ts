import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Autowired, Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

const inputSchema = z.object({
  text: z.string().describe('The new content to replace the entire file with'),
});

@Domain(MCPServerContribution)
export class ReplaceOpenEditorFileTool implements MCPServerContribution {
  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'replace_open_in_editor_file_text',
      description:
        'Replaces the entire content of the currently active file in the IDE editor with specified new text. ' +
        'Use this tool when you need to completely overwrite the current file\'s content. ' +
        'Requires a text parameter containing the new content. ' +
        'Returns one of three possible responses: ' +
        '"ok" if the file content was successfully replaced, ' +
        '"no file open" if no editor is active, ' +
        '"unknown error" if the operation fails.',
      inputSchema: zodToJsonSchema(inputSchema),
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema>, logger: MCPLogger) {
    try {
      const editor = this.editorService.currentEditor;
      if (!editor || !editor.monacoEditor) {
        logger.appendLine('Error: No active text editor found');
        return {
          content: [{ type: 'text', text: 'no file open' }],
          isError: true,
        };
      }

      // Get the model and its full range
      const model = editor.monacoEditor.getModel();
      if (!model) {
        logger.appendLine('Error: No model found for current editor');
        return {
          content: [{ type: 'text', text: 'unknown error' }],
          isError: true,
        };
      }

      const fullRange = model.getFullModelRange();

      // Execute the replacement
      editor.monacoEditor.executeEdits('mcp.tool.replace-file', [{
        range: fullRange,
        text: args.text,
      }]);

      logger.appendLine('Successfully replaced file content');
      return {
        content: [{ type: 'text', text: 'ok' }],
      };
    } catch (error) {
      logger.appendLine(`Error during file content replacement: ${error}`);
      return {
        content: [{ type: 'text', text: 'unknown error' }],
        isError: true,
      };
    }
  }
}
