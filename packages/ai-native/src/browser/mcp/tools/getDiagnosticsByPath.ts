import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { Deferred, Domain, MarkerSeverity, URI, path } from '@opensumi/ide-core-common';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IMarkerService } from '@opensumi/ide-markers';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';

const inputSchema = z.object({
  filePathInProject: z.string().describe('The relative path to the file to get diagnostics for'),
});

@Domain(MCPServerContribution)
export class GetDiagnosticsTool implements MCPServerContribution {
  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(IEditorDocumentModelService)
  private readonly modelService: IEditorDocumentModelService;

  @Autowired(IMarkerService)
  protected readonly markerService: IMarkerService;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'get_diagnostics_by_path',
      label: 'Get Diagnostics By Path',
      order: 9,
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

  protected async checkFilePath(filePathInProject: string, logger: MCPLogger) {
    // Get workspace roots
    const workspaceRoots = this.workspaceService.tryGetRoots();
    if (!workspaceRoots || workspaceRoots.length === 0) {
      logger.appendLine('Error: Cannot determine project directory');
      throw new Error('Cannot determine project directory');
    }

    // Validate file path
    if (filePathInProject.startsWith('..') || filePathInProject.startsWith('/')) {
      logger.appendLine('Error: File is outside of project scope');
      throw new Error('File is outside of project scope');
    }

    // Construct full file path
    const rootUri = URI.parse(workspaceRoots[0].uri);
    const fullPathUri = URI.file(path.join(rootUri.codeUri.fsPath, filePathInProject));

    // Check if file exists
    const fileExists = await this.fileServiceClient.access(fullPathUri.toString());
    if (!fileExists) {
      logger.appendLine(`Error: File does not exist: ${fullPathUri.toString()}`);
      throw new Error('File does not exist');
    }

    return fullPathUri;
  }

  // 确保model已创建
  protected async ensureModelCreated(uri: URI) {
    const models = this.modelService.getAllModels();
    if (!models.some((model) => model.uri.isEqual(uri))) {
      const markerChangeDeferred = new Deferred<void>();
      // TODO: 诊断信息更新延迟问题如何彻底解决？现在事件都是从插件单向通知上来的
      // 首次打开文件时最大4s, 如果4s内marker没有变化，则认为marker本身就是空的
      const disposable = this.markerService.getManager().onMarkerChanged((e) => {
        if (e.some((uriStr) => uriStr === uri.toString())) {
          markerChangeDeferred.resolve();
        }
      });
      await this.modelService.createModelReference(uri);
      const timeoutId = setTimeout(() => {
        markerChangeDeferred.resolve();
      }, 4000);
      await markerChangeDeferred.promise.finally(() => {
        disposable.dispose();
        clearTimeout(timeoutId);
      });
    }
  }

  private async handler(args: z.infer<typeof inputSchema>, logger: MCPLogger) {
    try {
      const uri = await this.checkFilePath(args.filePathInProject, logger);
      await this.ensureModelCreated(uri);

      // 获取文件的诊断信息
      const markers = this.markerService.getManager().getMarkers({ resource: uri.toString() });

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
