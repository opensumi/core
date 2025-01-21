import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Autowired, Injectable } from '@opensumi/di';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { Logger, ToolDefinition } from '../types';

const inputSchema = z.object({});

@Injectable()
export class GetOpenEditorFileTextTool {
    @Autowired(WorkbenchEditorService)
    private readonly editorService: WorkbenchEditorService;

    getToolDefinition(): ToolDefinition {
        return {
            name: 'get_open_in_editor_file_text',
            description: 'Retrieves the complete text content of the currently active file in the IDE editor. ' +
                'Use this tool to access and analyze the file\'s contents for tasks such as code review, content inspection, or text processing. ' +
                'Returns empty string if no file is currently open.',
            inputSchema: zodToJsonSchema(inputSchema),
            handler: this.handler.bind(this),
        };
    }

    private async handler(args: z.infer<typeof inputSchema>, logger: Logger) {
        const editor = this.editorService.currentEditor;
        if (!editor || !editor.currentDocumentModel) {
            logger.appendLine('Error: No active text editor found');
            return {
                content: [{ type: 'text', text: '' }],
            };
        }

        const document = editor.currentDocumentModel;
        logger.appendLine(`Reading content from: ${document.uri.toString()}`);
        const content = document.getText();

        return {
            content: [{ type: 'text', text: content }],
        };
    }
} 