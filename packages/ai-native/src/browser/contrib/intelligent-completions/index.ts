import { Disposable } from '@opensumi/ide-core-common';
import { IRange, InlineCompletion } from '@opensumi/ide-monaco';

import type { ILineChangeData } from './source/line-change.source';
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
  | { typing: ECodeEditsSource.LinterErrors; data: ILinterErrorData }
  | { typing: ECodeEditsSource.LineChange; data: ILineChangeData };

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

export class CodeEditsResultValue extends Disposable {
  constructor(private readonly raw: ICodeEditsResult) {
    super();
  }

  public get items(): ICodeEdit[] {
    return this.raw.items;
  }
}
