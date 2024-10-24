import * as monaco from '@opensumi/ide-monaco';

import { IIntelligentCompletionsResult } from '../../intelligent-completions';

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
  completionResultModel: IIntelligentCompletionsResult | null;
}

/**
 * 补全结果item，继承自InlineCompletionItem
 */
export interface InlineCompletionItem extends monaco.languages.InlineCompletion {
  sessionId: string;
  relationId: string;
}
