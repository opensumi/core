import { Autowired, Injectable } from '@opensumi/di';

import { BaseApplyService } from '../../base-apply.service';

/**
 * TODO: 代码块改动版本号，次数，流式工具调用？
 * 基础文件编辑处理类
 * 用于处理代码改动的应用、保存等操作
 */
@Injectable()
export class EditFileHandler {
  @Autowired(BaseApplyService)
  private applyService: BaseApplyService;

  async handler(params: { targetFile: string; codeEdit: string; instructions?: string }, toolCallId: string) {
    const { targetFile, codeEdit } = params;
    const block = await this.applyService.registerCodeBlock(targetFile, codeEdit, toolCallId);
    const blockData = await this.applyService.apply(block);
    return blockData;
  }
}
