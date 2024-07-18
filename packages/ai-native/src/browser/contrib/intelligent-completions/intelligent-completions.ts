export interface IIntelligentCompletionsResult {
  readonly items: IIntelligentCompletionItem[];
}

export interface IIntelligentCompletionItem {
  /**
   * 补全的内容
   */
  content: string;
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
  /**
   * 定义的额外信息
   */
  extra?: any;
}
