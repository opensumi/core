import { Disposable, ECodeEditsSourceTyping } from '@opensumi/ide-core-common';
import { IModelContentChangedEvent, IPosition, IRange, InlineCompletion } from '@opensumi/ide-monaco';

import type { ILineChangeData } from './source/line-change.source';
import type { ILinterErrorData } from './source/lint-error.source';

export interface IIntelligentCompletionsResult<T = any> {
  readonly items: InlineCompletion[];
  /**
   * 定义的额外信息
   */
  extra?: T;
}

export interface ICodeEditsContextBean {
  typing: ECodeEditsSourceTyping;
  position: IPosition;
  data: {
    [ECodeEditsSourceTyping.LinterErrors]?: ILinterErrorData;
    [ECodeEditsSourceTyping.LineChange]?: ILineChangeData;
    [ECodeEditsSourceTyping.Typing]?: IModelContentChangedEvent;
  };
}

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
