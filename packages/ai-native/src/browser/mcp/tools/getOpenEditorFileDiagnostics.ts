import * as path from 'path';

import { z } from 'zod';

import { Autowired, Injectable } from '@opensumi/di';
import { Domain, URI } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { URI as MonacoURI } from '@opensumi/monaco-editor-core/esm/vs/base/common/uri';
import { IMarkerService, MarkerSeverity } from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

const inputSchema = z.object({});

@Domain(MCPServerContribution)
export class GetOpenEditorFileDiagnosticsTool implements MCPServerContribution {
  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IMarkerService)
  private readonly markerService: IMarkerService;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'get_open_in_editor_file_diagnostics',
      description:
        'Retrieves diagnostic information (errors, warnings, etc.) from the currently active file in VS Code editor. ' +
        'Use this tool to get information about problems in your current file. ' +
        'IMPORTANT: This tool should be called after any code generation or modification operations to verify and fix potential issues. ' +
        'Returns a JSON-formatted list of diagnostics, where each entry contains: ' +
        '- path: The file path where the diagnostic was found ' +
        '- line: The line number (1-based) of the diagnostic ' +
        '- severity: The severity level ("error", "warning", "information", or "hint") ' +
        '- message: The diagnostic message ' +
        'Returns an empty list ([]) if no diagnostics are found or no file is open. ' +
        'Best Practice: Always check diagnostics after code generation to ensure code quality and fix any issues immediately. ' +
        'Diagnostic Severity Handling Guidelines: ' +
        '- "error": Must be fixed immediately as they indicate critical issues that will prevent code from working correctly. ' +
        '- "warning": For user code, preserve unless the warning indicates a clear improvement opportunity. For generated code, optimize to remove warnings. ' +
        '- "information"/"hint": For user code, preserve as they might reflect intentional patterns. For generated code, optimize if it improves code quality without changing functionality.',
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema>, logger: MCPLogger) {
    try {
      // 获取当前活动的编辑器
      const editor = this.editorService.currentEditor;
      if (!editor || !editor.currentUri) {
        logger.appendLine('Error: No active text editor found');
        return {
          content: [{ type: 'text', text: '[]' }],
          isError: true,
        };
      }

      // 获取工作区根目录
      const workspaceRoots = this.workspaceService.tryGetRoots();
      if (!workspaceRoots || workspaceRoots.length === 0) {
        logger.appendLine('Error: Cannot determine project directory');
        return {
          content: [{ type: 'text', text: '[]' }],
          isError: true,
        };
      }

      // 获取当前文件的诊断信息
      const monacoUri = MonacoURI.parse(editor.currentUri.toString());
      const markers = this.markerService.read({ resource: monacoUri });
      const rootUri = URI.parse(workspaceRoots[0].uri);
      const relativePath = path.relative(rootUri.codeUri.fsPath, editor.currentUri.codeUri.fsPath);

      // 转换诊断信息
      const diagnosticInfos = markers.map((marker) => ({
        path: relativePath,
        line: marker.startLineNumber,
        severity: this.getSeverityString(marker.severity),
        message: marker.message,
      }));

      // 将结果转换为 JSON 字符串
      const resultJson = JSON.stringify(diagnosticInfos, null, 2);
      logger.appendLine(`Found ${diagnosticInfos.length} diagnostics in current file`);

      return {
        content: [{ type: 'text', text: resultJson }],
      };
    } catch (error) {
      logger.appendLine(`Error getting diagnostics: ${error}`);
      return {
        content: [{ type: 'text', text: '[]' }],
        isError: true,
      };
    }
  }

  private getSeverityString(severity: MarkerSeverity): string {
    switch (severity) {
      case MarkerSeverity.Error:
        return 'error';
      case MarkerSeverity.Warning:
        return 'warning';
      case MarkerSeverity.Info:
        return 'information';
      case MarkerSeverity.Hint:
        return 'hint';
      default:
        return 'unknown';
    }
  }
}
