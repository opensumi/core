import { z } from 'zod';

import { Autowired } from '@opensumi/di';
import { Domain, URI, path } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IMCPServerRegistry, MCPLogger, MCPServerContribution, MCPToolDefinition } from '../../types';
import { BaseApplyService } from '../base-apply.service';

import { EditFileToolComponent } from './components/EditFile';

const inputSchema = z.object({
  target_file: z.string().describe('The relative path where the file should be created'),
  code_edit: z.string().describe('The content to write into the new file'),
});

@Domain(MCPServerContribution)
export class CreateNewFileWithTextTool implements MCPServerContribution {
  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IFileServiceClient)
  private readonly fileService: IFileServiceClient;

  @Autowired(BaseApplyService)
  private applyService: BaseApplyService;

  registerMCPServer(registry: IMCPServerRegistry): void {
    registry.registerMCPTool(this.getToolDefinition());
    registry.registerToolComponent('create_new_file_with_text', EditFileToolComponent);
  }

  getToolDefinition(): MCPToolDefinition {
    return {
      name: 'create_new_file_with_text',
      label: 'Create File',
      description:
        'Creates a new file at the specified path within the project directory and populates it with the provided text. ' +
        'Use this tool to generate new files in your project structure. ' +
        'Returns one of two possible responses: ' +
        '"ok" if the file was successfully created and populated, ' +
        '"can\'t find project dir" if the project directory cannot be determined. ' +
        'Note: This tool creates any necessary parent directories automatically.',
      inputSchema,
      handler: this.handler.bind(this),
    };
  }

  private async handler(args: z.infer<typeof inputSchema> & { toolCallId: string }, logger: MCPLogger) {
    try {
      // 获取工作区根目录
      const workspaceRoots = this.workspaceService.tryGetRoots();
      if (!workspaceRoots || workspaceRoots.length === 0) {
        logger.appendLine('Error: Cannot determine project directory');
        return {
          content: [{ type: 'text', text: "can't find project dir" }],
          isError: true,
        };
      }

      // 构建完整的文件路径
      const rootUri = URI.parse(workspaceRoots[0].uri);
      const fullPath = path.join(rootUri.codeUri.fsPath, args.target_file);
      const fileUri = URI.file(fullPath);

      // 创建父目录
      const parentDir = path.dirname(fullPath);
      const parentUri = URI.file(parentDir);
      await this.fileService.createFolder(parentUri.toString());

      // 创建文件
      await this.fileService.createFile(fileUri.toString());

      // 使用 applyService 写入文件内容
      const codeBlock = await this.applyService.registerCodeBlock(args.target_file, args.code_edit, args.toolCallId);
      await this.applyService.apply(codeBlock);

      logger.appendLine(`Successfully created file at: ${args.target_file}`);
      return {
        content: [{ type: 'text', text: 'ok' }],
      };
    } catch (error) {
      logger.appendLine(`Error during file creation: ${error}`);
      return {
        content: [{ type: 'text', text: error.message }],
        isError: true,
      };
    }
  }
}
