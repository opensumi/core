import { IAICompletionResultModel } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';

/**
 * 缓存的结果
 */
export interface IInlineCompletionCache {
  /**
   * The zero-based line value.
   */
  line: number;

  /**
   * The zero-based character value.
   */
  column: number;

  /**
   * last complemetion
   */
  last: any;
}

/**
 * 补全请求对象
 */
export interface CompletionRequestBean {
  /**
   * 模型输入上文
   */
  prompt: string;
  /**
   * 代码语言类型
   */
  language: string;
  sessionId: string;
  /**
   * 代码下文
   */
  suffix: string | null;
  /**
   * 文件路径
   */
  fileUrl: string | null;
}
/**
 * 补全结果缓存对象
 */
export interface CompletionResultModelCache {
  /**
   * 开发中的文件名
   */
  fileName: string | null;
  /**
   * 开发中的代码行号
   */
  line: number | null;
  /**
   * 开发中当前代码行前缀
   */
  linePrefix: string | null;
  /**
   * 当前毫秒数
   */
  time: number | null;
  /**
   * 会话id
   */
  sessionId: string | null;
  /**
   * 缓存结果
   */
  completionResultModel: IAICompletionResultModel | null;
}

/**
 * 补全结果item，继承自InlineCompletionItem
 */
export interface InlineCompletionItem extends monaco.languages.InlineCompletion {
  sessionId: string;
}
