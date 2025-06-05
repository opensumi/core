import { Autowired, Injectable } from '@opensumi/di';
import { URI, path } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { BaseApplyService } from '../../base-apply.service';

import type { CodeBlockData } from '@opensumi/ide-ai-native/lib/common/types';

/**
 * 创建新文件处理器
 * 用于处理创建新文件并写入内容的操作
 */
@Injectable()
export class CreateNewFileWithTextHandler {
  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IFileServiceClient)
  private readonly fileService: IFileServiceClient;

  @Autowired(BaseApplyService)
  private applyService: BaseApplyService;

  async handler(params: { targetFile: string; codeEdit: string }, toolCallId: string): Promise<CodeBlockData> {
    // 获取工作区根目录
    const workspaceRoots = this.workspaceService.tryGetRoots();
    if (!workspaceRoots || workspaceRoots.length === 0) {
      throw new Error("can't find project dir");
    }

    // 构建完整的文件路径
    const rootUri = URI.parse(workspaceRoots[0].uri);
    const fullPath = path.join(rootUri.codeUri.fsPath, params.targetFile);
    const fileUri = URI.file(fullPath);

    // 创建父目录
    const parentDir = path.dirname(fullPath);
    const parentUri = URI.file(parentDir);
    await this.fileService.createFolder(parentUri.toString());

    // 创建文件
    await this.fileService.createFile(fileUri.toString());

    // 使用 applyService 写入文件内容
    const codeBlock = await this.applyService.registerCodeBlock(params.targetFile, params.codeEdit, toolCallId);
    await this.applyService.apply(codeBlock);
    return codeBlock;
  }
}
