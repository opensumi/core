import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Autowired, Injectable } from '@opensumi/di';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { Logger, ToolDefinition } from '../types';

const inputSchema = z.object({});

@Injectable()
export class GetSelectedTextTool {
    @Autowired(WorkbenchEditorService)
    private readonly editorService: WorkbenchEditorService;

    getToolDefinition(): ToolDefinition {
        return {
            name: 'get_selected_in_editor_text',
            description: 'Retrieves the currently selected text from the active editor in VS Code. ' +
                'Use this tool when you need to access and analyze text that has been highlighted/selected by the user. ' +
                'Returns an empty string if no text is selected or no editor is open.',
            inputSchema: zodToJsonSchema(inputSchema),
            handler: this.handler.bind(this),
        };
    }

    private async handler(args: z.infer<typeof inputSchema>, logger: Logger) {
        const editor = this.editorService.currentEditor;
        if (!editor || !editor.monacoEditor) {
            logger.appendLine('Error: No active text editor found');
            return {
                content: [{ type: 'text', text: '' }],
            };
        }

        const selection = editor.monacoEditor.getSelection();
        if (!selection) {
            logger.appendLine('No text is currently selected');
            return {
                content: [{ type: 'text', text: '' }],
            };
        }

        const selectedText = editor.monacoEditor.getModel()?.getValueInRange(selection) || '';
        logger.appendLine(`Retrieved selected text of length: ${selectedText.length}`);

        return {
            content: [{ type: 'text', text: selectedText }],
        };
    }
} 