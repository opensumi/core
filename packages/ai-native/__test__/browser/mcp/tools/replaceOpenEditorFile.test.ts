import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IEditor, WorkbenchEditorService } from '@opensumi/ide-editor';
import { IRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { ReplaceOpenEditorFileTool } from '../../../../src/browser/mcp/tools/replaceOpenEditorFile';
import { MCPLogger } from '../../../../src/browser/types';

describe('ReplaceOpenEditorFileTool', () => {
  let tool: ReplaceOpenEditorFileTool;
  let editorService: WorkbenchEditorService;
  let mockLogger: MCPLogger;
  let mockMonacoEditor: any;
  let mockModel: any;

  beforeEach(() => {
    const injector = createBrowserInjector([]);
    mockModel = {
      getFullModelRange: jest.fn(),
    };
    mockMonacoEditor = {
      getModel: jest.fn().mockReturnValue(mockModel),
      executeEdits: jest.fn(),
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
    tool = injector.get(ReplaceOpenEditorFileTool);
  });

  it('should register tool with correct name and description', () => {
    const definition = tool.getToolDefinition();
    expect(definition.name).toBe('replace_open_in_editor_file_text');
    expect(definition.description).toContain('Replaces the entire content');
  });

  it('should return error when no editor is open', async () => {
    editorService.currentEditor = null;
    const result = await tool['handler']({ text: 'new content' }, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: 'no file open' }]);
    expect(result.isError).toBe(true);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Error: No active text editor found');
  });

  it('should return error when no model is found', async () => {
    mockMonacoEditor.getModel.mockReturnValue(null);
    const result = await tool['handler']({ text: 'new content' }, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: 'unknown error' }]);
    expect(result.isError).toBe(true);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Error: No model found for current editor');
  });

  it('should successfully replace file content', async () => {
    const mockRange: IRange = {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 10,
      endColumn: 20,
    };
    const newContent = 'new file content';
    mockModel.getFullModelRange.mockReturnValue(mockRange);

    const result = await tool['handler']({ text: newContent }, mockLogger);

    expect(mockModel.getFullModelRange).toHaveBeenCalled();
    expect(mockMonacoEditor.executeEdits).toHaveBeenCalledWith('mcp.tool.replace-file', [
      {
        range: mockRange,
        text: newContent,
      },
    ]);
    expect(result.content).toEqual([{ type: 'text', text: 'ok' }]);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Successfully replaced file content');
  });

  it('should handle errors during replacement', async () => {
    mockMonacoEditor.executeEdits.mockImplementation(() => {
      throw new Error('Test error');
    });
    const mockRange: IRange = {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 10,
      endColumn: 20,
    };
    mockModel.getFullModelRange.mockReturnValue(mockRange);

    const result = await tool['handler']({ text: 'new content' }, mockLogger);

    expect(result.content).toEqual([{ type: 'text', text: 'unknown error' }]);
    expect(result.isError).toBe(true);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Error during file content replacement: Error: Test error');
  });
});
