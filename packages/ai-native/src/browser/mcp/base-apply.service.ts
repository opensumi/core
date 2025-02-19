import { Autowired } from '@opensumi/di';
import { ChatMessageRole } from '@opensumi/ide-core-browser';

import { IChatInternalService } from '../../common';
import { ChatInternalService } from '../chat/chat.internal.service';
import { BaseInlineDiffPreviewer } from '../widget/inline-diff';

import { FileHandler } from './tools/handlers/ReadFile';

// 提供代码块的唯一索引，迭代轮次，生成状态管理（包括取消），关联文件位置这些信息的记录，后续并行 apply 的支持
export abstract class BaseApplyService {
  @Autowired(FileHandler)
  fileHandler: FileHandler;

  @Autowired(IChatInternalService)
  chatInternalService: ChatInternalService;

  private codeBlockMap = new Map<string, CodeBlockData>();

  private activePreviewer: BaseInlineDiffPreviewer<any> | undefined;

  getCodeBlock(blockId: string): CodeBlockData | undefined {
    return this.codeBlockMap.get(blockId);
  }

  /**
   * Register a new code block and return its unique ID
   */
  registerCodeBlock(relativePath: string, content: string): string {
    const blockId = this.generateBlockId(relativePath);

    if (!this.codeBlockMap.has(blockId)) {
      this.codeBlockMap.set(blockId, {
        id: blockId,
        content,
        status: 'generating',
        iterationCount: 0,
        createdAt: Date.now(),
      });
    }

    return blockId;
  }

  /**
   * Apply changes of a code block
   */
  async apply(relativePath: string, newContent: string, instructions?: string): Promise<CodeBlockData> {
    const blockId = this.generateBlockId(relativePath);
    const blockData = this.getCodeBlock(blockId);
    if (!blockData) {
      throw new Error('Code block not found');
    }
    try {
      blockData.iterationCount++;
      blockData.content = newContent;
      const applyDiffResult = await this.doApply(relativePath, newContent, instructions);
      blockData.applyResult = applyDiffResult;
      return blockData;
    } catch (err) {
      blockData.status = 'failed';
      throw err;
    }
  }

  /**
   * Cancel an ongoing apply operation
   */
  cancelApply(relativePath: string): void {
    const blockId = this.generateBlockId(relativePath);
    const blockData = this.getCodeBlock(blockId);
    if (blockData && blockData.status === 'generating') {
      if (this.activePreviewer) {
        this.activePreviewer.dispose();
      }
      blockData.status = 'cancelled';
    }
  }

  protected abstract doApply(
    relativePath: string,
    newContent: string,
    instructions?: string,
  ): Promise<string | undefined>;

  protected generateBlockId(relativePath: string): string {
    const sessionId = this.chatInternalService.sessionModel.sessionId;
    const lastUserMessageId = this.chatInternalService.sessionModel.history
      .getMessages()
      .findLast((msg) => msg.role === ChatMessageRole.User)?.id;
    return `${sessionId}:${relativePath}:${lastUserMessageId || '-'}`;
  }
}

export interface CodeBlockData {
  id: string;
  content: string;
  status: CodeBlockStatus;
  iterationCount: number;
  createdAt: number;
  applyResult?: string;
}

export type CodeBlockStatus = 'generating' | 'pending' | 'success' | 'rejected' | 'failed' | 'cancelled';
