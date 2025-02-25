import { Disposable, ECodeEditsSourceTyping } from '@opensumi/ide-core-common';
import {
  IModelContentChangedEvent,
  IPosition,
  IRange,
  InlineCompletion,
  InlineCompletions,
} from '@opensumi/ide-monaco';

import { ITriggerData } from './source/trigger.source';

import type { ILineChangeData } from './source/line-change.source';
import type { ILinterErrorData } from './source/lint-error.source';

export enum CodeEditsRenderType {
  Legacy = 'legacy',
  Default = 'default',
}

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

export interface ICodeEdit extends InlineCompletion {
  /**
   * 插入的文本
   */
  readonly insertText: string;
  /**
   * 替换的文本范围
   */
  readonly range: IRange;
}

export interface ICodeEditsResult<T extends ICodeEdit = ICodeEdit> extends InlineCompletions<T> {
  readonly items: readonly T[];
}

export class CodeEditsResultValue<T extends ICodeEdit = ICodeEdit> extends Disposable {
  constructor(private readonly raw: ICodeEditsResult<T>) {
    super();
  }

  public get items(): T[] {
    return this.raw.items.map((item) => ({
      ...item,
      isInlineEdit: true,
    }));
  }

  public get firstRange(): IRange {
    return this.raw.items[0].range;
  }

  public get firstText(): string {
    return this.raw.items[0].insertText;
  }
}
