import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { GetSelectedTextTool } from '../../../../src/browser/mcp/tools/getSelectedText';
import { MCPLogger } from '../../../../src/browser/types';

describe('GetSelectedTextTool', () => {
  let tool: GetSelectedTextTool;
  let editorService: WorkbenchEditorService;
  let mockLogger: MCPLogger;
  let mockMonacoEditor: any;

  beforeEach(() => {
    const injector = createBrowserInjector([]);
    mockMonacoEditor = {
      getSelection: jest.fn(),
      getModel: jest.fn(),
    };
    editorService = {
      currentEditor: {
        monacoEditor: mockMonacoEditor,
      },
    } as any;
    injector.addProviders({
      token: WorkbenchEditorService,
      useValue: editorService,
    });
    mockLogger = {
      appendLine: jest.fn(),
    } as any;
    tool = injector.get(GetSelectedTextTool);
  });

  it('should register tool with correct name and description', () => {
    const definition = tool.getToolDefinition();
    expect(definition.name).toBe('get_selected_in_editor_text');
    expect(definition.description).toContain('Retrieves the currently selected text');
  });

  it('should return empty string when no editor is open', async () => {
    editorService.currentEditor = null;
    const result = await tool['handler']({}, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: '' }]);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Error: No active text editor found');
  });

  it('should return empty string when no text is selected', async () => {
    mockMonacoEditor.getSelection.mockReturnValue(null);
    const result = await tool['handler']({}, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: '' }]);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('No text is currently selected');
  });

  it('should return selected text when text is selected', async () => {
    const mockSelection: IRange = {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 10,
    };
    const mockText = 'selected text';
    mockMonacoEditor.getSelection.mockReturnValue(mockSelection);
    mockMonacoEditor.getModel.mockReturnValue({
      getValueInRange: jest.fn().mockReturnValue(mockText),
    });

    const result = await tool['handler']({}, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: mockText }]);
    expect(mockLogger.appendLine).toHaveBeenCalledWith(`Retrieved selected text of length: ${mockText.length}`);
  });
});
