import * as path from 'path';

import { URI } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { IMarkerService, MarkerSeverity } from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

import { GetOpenEditorFileDiagnosticsTool } from '../../../../src/browser/mcp/tools/getOpenEditorFileDiagnostics';
import { MCPLogger } from '../../../../src/browser/types';

describe('GetOpenEditorFileDiagnosticsTool', () => {
  let tool: GetOpenEditorFileDiagnosticsTool;
  let editorService: WorkbenchEditorService;
  let workspaceService: IWorkspaceService;
  let markerService: IMarkerService;
  let mockLogger: MCPLogger;

  const mockWorkspaceRoot = '/workspace/root';
  const mockFilePath = '/workspace/root/src/test.ts';
  const mockRelativePath = path.relative(mockWorkspaceRoot, mockFilePath);

  beforeEach(() => {
    const injector = createBrowserInjector([]);

    editorService = {
      currentEditor: {
        currentUri: URI.file(mockFilePath),
      },
    } as any;

    workspaceService = {
      tryGetRoots: jest.fn().mockReturnValue([
        {
          uri: URI.file(mockWorkspaceRoot).toString(),
        },
      ]),
    } as any;

    markerService = {
      read: jest.fn(),
    } as any;

    injector.addProviders(
      {
        token: WorkbenchEditorService,
        useValue: editorService,
      },
      {
        token: IWorkspaceService,
        useValue: workspaceService,
      },
      {
        token: IMarkerService,
        useValue: markerService,
      },
    );

    mockLogger = {
      appendLine: jest.fn(),
    } as any;

    tool = injector.get(GetOpenEditorFileDiagnosticsTool);
  });

  it('should register tool with correct name and description', () => {
    const definition = tool.getToolDefinition();
    expect(definition.name).toBe('get_open_in_editor_file_diagnostics');
    expect(definition.description).toContain('Retrieves diagnostic information');
  });

  it('should return empty array when no editor is open', async () => {
    editorService.currentEditor = null;
    const result = await tool['handler']({}, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: '[]' }]);
    expect(result.isError).toBe(true);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Error: No active text editor found');
  });

  it('should return empty array when no workspace roots found', async () => {
    (workspaceService.tryGetRoots as jest.Mock).mockReturnValue([]);
    const result = await tool['handler']({}, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: '[]' }]);
    expect(result.isError).toBe(true);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Error: Cannot determine project directory');
  });

  it('should return diagnostics with correct severity mappings', async () => {
    const mockMarkers = [
      {
        startLineNumber: 1,
        severity: MarkerSeverity.Error,
        message: 'Error message',
      },
      {
        startLineNumber: 2,
        severity: MarkerSeverity.Warning,
        message: 'Warning message',
      },
      {
        startLineNumber: 3,
        severity: MarkerSeverity.Info,
        message: 'Info message',
      },
      {
        startLineNumber: 4,
        severity: MarkerSeverity.Hint,
        message: 'Hint message',
      },
    ];

    (markerService.read as jest.Mock).mockReturnValue(mockMarkers);

    const result = await tool['handler']({}, mockLogger);
    const diagnostics = JSON.parse(result.content[0].text);

    expect(diagnostics).toHaveLength(4);
    expect(diagnostics[0]).toEqual({
      path: mockRelativePath,
      line: 1,
      severity: 'error',
      message: 'Error message',
    });
    expect(diagnostics[1]).toEqual({
      path: mockRelativePath,
      line: 2,
      severity: 'warning',
      message: 'Warning message',
    });
    expect(diagnostics[2]).toEqual({
      path: mockRelativePath,
      line: 3,
      severity: 'information',
      message: 'Info message',
    });
    expect(diagnostics[3]).toEqual({
      path: mockRelativePath,
      line: 4,
      severity: 'hint',
      message: 'Hint message',
    });

    expect(mockLogger.appendLine).toHaveBeenCalledWith('Found 4 diagnostics in current file');
  });

  it('should handle errors during diagnostic retrieval', async () => {
    (markerService.read as jest.Mock).mockImplementation(() => {
      throw new Error('Test error');
    });

    const result = await tool['handler']({}, mockLogger);
    expect(result.content).toEqual([{ type: 'text', text: '[]' }]);
    expect(result.isError).toBe(true);
    expect(mockLogger.appendLine).toHaveBeenCalledWith('Error getting diagnostics: Error: Test error');
  });

  it('should handle unknown severity levels', async () => {
    const mockMarkers = [
      {
        startLineNumber: 1,
        severity: 999, // Unknown severity
        message: 'Unknown severity message',
      },
    ];

    (markerService.read as jest.Mock).mockReturnValue(mockMarkers);

    const result = await tool['handler']({}, mockLogger);
    const diagnostics = JSON.parse(result.content[0].text);

    expect(diagnostics[0]).toEqual({
      path: mockRelativePath,
      line: 1,
      severity: 'unknown',
      message: 'Unknown severity message',
    });
  });
});
