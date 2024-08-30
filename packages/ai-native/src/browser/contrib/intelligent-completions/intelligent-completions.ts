import { InlineCompletion } from '@opensumi/ide-monaco';

export interface IIntelligentCompletionsResult<T = any> {
  readonly items: InlineCompletion[];
  /**
   * 是否开启多行补全
   * 开启后，items 中的 range 必填
   * 否则显示默认的 inline completion
   */
  readonly enableMultiLine?: boolean | undefined;
  /**
   * 定义的额外信息
   */
  extra?: T;
}
