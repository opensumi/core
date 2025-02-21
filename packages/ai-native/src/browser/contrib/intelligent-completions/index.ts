import { Disposable, ECodeEditsSourceTyping } from '@opensumi/ide-core-common';
import { IModelContentChangedEvent, IPosition, IRange, InlineCompletion } from '@opensumi/ide-monaco';

import { ITriggerData } from './source/trigger.source';

import type { ILineChangeData } from './source/line-change.source';
import type { ILinterErrorData } from './source/lint-error.source';

/**
 * 有效弃用时间（毫秒）
 * 在可见的情况下超过 750ms 弃用才算有效数据，否则视为无效数据
 */
export const VALID_TIME = 750;

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
    [ECodeEditsSourceTyping.Trigger]?: ITriggerData;
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
