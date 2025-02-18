import { Autowired, Injectable } from '@opensumi/di';

import { ApplyService } from '../../apply.service';

/**
 * TODO: 代码块改动版本号，次数，流式工具调用？
 * 基础文件编辑处理类
 * 用于处理代码改动的应用、保存等操作
 */
@Injectable()
export class EditFileHandler {
  @Autowired(ApplyService)
  private applyService: ApplyService;

  async handler(relativePath: string, updateContent: string, instructions?: string) {
    // TODO: ignore file
    this.applyService.registerCodeBlock(relativePath, updateContent);
    const blockData = await this.applyService.apply(relativePath, updateContent, instructions);
    return blockData;
  }
}
