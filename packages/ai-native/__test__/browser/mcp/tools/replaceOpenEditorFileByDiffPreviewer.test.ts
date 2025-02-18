import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IEditor, WorkbenchEditorService } from '@opensumi/ide-editor';
import { IRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { Selection, SelectionDirection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/selection';

import { ReplaceOpenEditorFileByDiffPreviewerTool } from '../../../../src/browser/mcp/tools/replaceOpenEditorFileByDiffPreviewer';
import { MCPLogger } from '../../../../src/browser/types';
import { LiveInlineDiffPreviewer } from '../../../../src/browser/widget/inline-diff/inline-diff-previewer';
import { InlineDiffController } from '../../../../src/browser/widget/inline-diff/inline-diff.controller';

jest.mock('../../../../src/browser/widget/inline-diff/inline-diff.controller');

describe('ReplaceOpenEditorFileByDiffPreviewerTool', () => {
  let tool: ReplaceOpenEditorFileByDiffPreviewerTool;
  let editorService: WorkbenchEditorService;
  let mockLogger: MCPLogger;
  let mockMonacoEditor: any;
  let mockModel: any;
  let mockDiffPreviewer: jest.Mocked<LiveInlineDiffPreviewer>;
  let mockInlineDiffHandler: any;

  beforeEach(() => {
    const injector = createBrowserInjector([]);
    mockModel = {
      getFullModelRange: jest.fn().mockReturnValue({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 10,
        endColumn: 20,
      } as IRange),
    };
    mockDiffPreviewer = {
      setValue: jest.fn(),
    } as any;
    mockInlineDiffHandler = {
      createDiffPreviewer: jest.fn().mockReturnValue(mockDiffPreviewer),
    };
    (InlineDiffController.get as jest.Mock).mockReturnValue(mockInlineDiffHandler);

    mockMonacoEditor = {
      getModel: jest.fn().mockReturnValue(mockModel),
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
    tool = injector.get(ReplaceOpenEditorFileByDiffPreviewerTool);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

  it('should successfully create diff preview', async () => {
    const newContent = 'new file content';
    const mockRange = mockModel.getFullModelRange();

    const result = await tool['handler']({ text: newContent }, mockLogger);

    expect(mockModel.getFullModelRange).toHaveBeenCalled();
    expect(InlineDiffController.get).toHaveBeenCalledWith(mockMonacoEditor);
    expect(mockInlineDiffHandler.createDiffPreviewer).toHaveBeenCalledWith(mockMonacoEditor, expect.any(Selection), {
      disposeWhenEditorClosed: false,
      renderRemovedWidgetImmediately: true,
    });
    expect(mockDiffPreviewer.setValue).toHaveBeenCalledWith(newContent);
    expect(result.content).toEqual([{ type: 'text', text: 'ok' }]);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Successfully created diff preview with new content');
  });

  it('should handle errors during diff preview creation', async () => {
    mockInlineDiffHandler.createDiffPreviewer.mockImplementation(() => {
      throw new Error('Test error');
    });

    const result = await tool['handler']({ text: 'new content' }, mockLogger);

    expect(result.content).toEqual([{ type: 'text', text: 'unknown error' }]);
    expect(result.isError).toBe(true);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Error during file content replacement: Error: Test error');
  });

  it('should verify Selection creation with correct range', async () => {
    const newContent = 'new file content';
    const mockRange = mockModel.getFullModelRange();

    await tool['handler']({ text: newContent }, mockLogger);

    expect(mockInlineDiffHandler.createDiffPreviewer).toHaveBeenCalledWith(
      mockMonacoEditor,
      Selection.fromRange(mockRange, SelectionDirection.LTR),
      expect.any(Object),
    );
  });
});
