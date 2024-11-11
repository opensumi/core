import { Disposable, ECodeEditsSourceTyping } from '@opensumi/ide-core-common';
import { IDisposable, IPosition, IRange, InlineCompletion } from '@opensumi/ide-monaco';
import { ISettableObservable } from '@opensumi/ide-monaco/lib/common/observable';
import { IGhostTextWidgetModel } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/ghostTextWidget';
import { InlineCompletionsModel } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/inlineCompletionsModel';


import type { ILineChangeData } from './source/line-change.source';
import type { ILinterErrorData } from './source/lint-error.source';

export interface IGhostTextWidgetModelEnhanced extends IGhostTextWidgetModel {
  readonly targetCompletionModel: ISettableObservable<InlineCompletionsModel | undefined, void> & IDisposable;
}

export interface IIntelligentCompletionsResult<T = any> {
  readonly items: InlineCompletion[];
  /**
   * 定义的额外信息
   */
  extra?: T;
}

export type ICodeEditsContextBean =
  | { typing: ECodeEditsSourceTyping.LinterErrors; position: IPosition; data: ILinterErrorData }
  | { typing: ECodeEditsSourceTyping.LineChange; position: IPosition; data: ILineChangeData };

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
