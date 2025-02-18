import { URI } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IEditor, WorkbenchEditorService } from '@opensumi/ide-editor';

import { GetOpenEditorFileTextTool } from '../../../../src/browser/mcp/tools/getOpenEditorFileText';
import { MCPLogger } from '../../../../src/browser/types';

describe('GetOpenEditorFileTextTool', () => {
  let tool: GetOpenEditorFileTextTool;
  let editorService: WorkbenchEditorService;
  let mockLogger: MCPLogger;

  beforeEach(() => {
    const injector = createBrowserInjector([]);
    editorService = {
      currentEditor: null,
    } as any;
    injector.addProviders({
      token: WorkbenchEditorService,
      useValue: editorService,
    });
    mockLogger = {
      appendLine: jest.fn(),
    } as any;
    tool = injector.get(GetOpenEditorFileTextTool);
  });

  it('should register tool with correct name and description', () => {
    const definition = tool.getToolDefinition();
    expect(definition.name).toBe('get_open_in_editor_file_text');
    expect(definition.description).toContain('Retrieves the complete text content');
  });

  it('should return empty string when no editor is open', async () => {
    editorService.currentEditor = null;
    const result = await tool['handler']({}, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: '' }]);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Error: No active text editor found');
  });

  it('should return file content when editor is open', async () => {
    const mockContent = 'test file content';
    editorService.currentEditor = {
      currentDocumentModel: {
        uri: URI.parse('file:///test.ts'),
        getText: () => mockContent,
      },
    } as IEditor;
    const result = await tool['handler']({}, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: mockContent }]);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Reading content from: file:///test.ts');
  });
});
