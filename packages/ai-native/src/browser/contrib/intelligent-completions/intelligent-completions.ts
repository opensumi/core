import { isUndefined } from '@opensumi/ide-core-common';
import { InlineCompletion } from '@opensumi/ide-monaco';

export interface IIntelligentCompletionItem extends InlineCompletion {
  /**
   * 表示当前行之前需要再补全几行
   * 最大值为 3
   */
  aboveRadius?: number;
  /**
   * 表示当前行之后需要再补全几行
   * 最大值为 3
   */
  belowRadius?: number;
}

export interface IIntelligentCompletionsResult<T = any> {
  readonly items: IIntelligentCompletionItem[];
  /**
   * 定义的额外信息
   */
  extra?: T;
}

export const isMultiLineCompletion = (item: IIntelligentCompletionItem) => !isUndefined(item.aboveRadius) || !isUndefined(item.belowRadius);
