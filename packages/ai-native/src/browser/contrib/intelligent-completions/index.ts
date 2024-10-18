import { IRange, InlineCompletion } from '@opensumi/ide-monaco';

import type { ILinterErrorData } from './lint-error.source';

export interface IIntelligentCompletionsResult<T = any> {
  readonly items: InlineCompletion[];
  /**
   * 定义的额外信息
   */
  extra?: T;
}

export enum ECodeEditsSource {
  LinterErrors = 'lint_errors',
}

export interface ICodeEditsContextBean { typing: ECodeEditsSource.LinterErrors; data: ILinterErrorData }

export interface ICodeEdit {
  /**
   * 插入的文本
   */
  readonly insertText: string;
  /**
   * 替换的文本范围
   */
  readonly range?: IRange;
}
export interface ICodeEditsResult {
  readonly items: ICodeEdit[];
}
