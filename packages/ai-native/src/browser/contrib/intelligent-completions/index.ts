import { IRange, InlineCompletion } from '@opensumi/ide-monaco';

import type { ILinterErrorData } from './source/lint-error.source';

export interface IIntelligentCompletionsResult<T = any> {
  readonly items: InlineCompletion[];
  /**
   * 定义的额外信息
   */
  extra?: T;
}

export enum ECodeEditsSource {
  LinterErrors = 'lint_errors',
  LineChange = 'line_change',
}

export type ICodeEditsContextBean =
  | {
      typing: ECodeEditsSource.LinterErrors;
      data: ILinterErrorData;
    }
  | {
      typing: ECodeEditsSource.LineChange;
      data: unknown;
    };

export interface ICodeEdit {
  /**
   * 插入的文本
   */
  readonly insertText: string;
  /**
   * 替换的文本范围
   */
  readonly range: IRange;
}
export interface ICodeEditsResult {
  readonly items: ICodeEdit[];
}
