import * as path from 'path';

import { z } from 'zod';

import { Autowired, Injectable } from '@opensumi/di';
import { Domain, URI } from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { URI as MonacoURI } from '@opensumi/monaco-editor-core/esm/vs/base/common/uri';
import { IMarkerService, MarkerSeverity } from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

const inputSchema = z.object({
  filePathInProject: z.string().describe('The relative path to the file to get diagnostics for'),
});

@Domain(MCPServerContribution)
export class GetDiagnosticsByPathTool implements MCPServerContribution {
  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IMarkerService)
  private readonly markerService: IMarkerService;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'get_diagnostics_by_path',
      label: 'Get Diagnostics',
      description:
        'Retrieves diagnostic information (errors, warnings, etc.) from a specific file in the project. ' +
        'Use this tool to get information about problems in any project file. ' +
        'IMPORTANT: This tool should be called after any code generation or modification operations to verify and fix potential issues. ' +
        'Requires a filePathInProject parameter specifying the target file path relative to project root. ' +
        'Returns a JSON-formatted list of diagnostics, where each entry contains: ' +
        '- path: The file path where the diagnostic was found ' +
        '- line: The line number (1-based) of the diagnostic ' +
        '- severity: The severity level ("error", "warning", "information", or "hint") ' +
        '- message: The diagnostic message ' +
        "Returns an empty list ([]) if no diagnostics are found or the file doesn't exist. " +
        'Best Practice: Always check diagnostics after code generation to ensure code quality and fix any issues immediately. ' +
        'Use this tool in combination with get_open_in_editor_file_diagnostics to verify all affected files after code changes. ' +
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
      // 获取工作区根目录
      const workspaceRoots = this.workspaceService.tryGetRoots();
      if (!workspaceRoots || workspaceRoots.length === 0) {
        logger.appendLine('Error: Cannot determine project directory');
        return {
          content: [{ type: 'text', text: '[]' }],
          isError: true,
        };
      }

      // 构建完整的文件路径
      const rootUri = URI.parse(workspaceRoots[0].uri);
      const fullPath = path.join(rootUri.codeUri.fsPath, args.filePathInProject);
      const uri = MonacoURI.file(fullPath);

      // 检查文件是否在项目目录内
      const relativePath = path.relative(rootUri.codeUri.fsPath, fullPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        logger.appendLine('Error: File is outside of project scope');
        return {
          content: [{ type: 'text', text: '[]' }],
          isError: true,
        };
      }

      // 获取文件的诊断信息
      const markers = this.markerService.read({ resource: uri });

      // 转换诊断信息
      const diagnosticInfos = markers.map((marker) => ({
        path: args.filePathInProject,
        line: marker.startLineNumber,
        severity: this.getSeverityString(marker.severity),
        message: marker.message,
      }));

      // 将结果转换为 JSON 字符串
      const resultJson = JSON.stringify(diagnosticInfos, null, 2);
      logger.appendLine(`Found ${diagnosticInfos.length} diagnostics in ${args.filePathInProject}`);

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
