import { Injectable } from '@opensumi/di';
import { AINativeSettingSectionsId, ECodeEditsSourceTyping, IDisposable } from '@opensumi/ide-core-common';
import { ICursorPositionChangedEvent, IModelContentChangedEvent } from '@opensumi/ide-monaco';
import {
  autorunDelta,
  derivedHandleChanges,
  observableFromEvent,
  recomputeInitiallyAndOnChange,
} from '@opensumi/ide-monaco/lib/common/observable';

import { BaseCodeEditsSource } from './base';

export interface ILineChangeData {
  currentLineNumber: number;
  preLineNumber?: number;
  change?: IModelContentChangedEvent;
}

@Injectable({ multiple: true })
export class LineChangeCodeEditsSource extends BaseCodeEditsSource {
  public priority = 2;

  public mount(): IDisposable {
    const modelContentChangeObs = observableFromEvent<IModelContentChangedEvent>(
      this,
      this.monacoEditor.onDidChangeModelContent,
      (event: IModelContentChangedEvent) => event,
    );
    const positionChangeObs = observableFromEvent<ICursorPositionChangedEvent>(
      this,
      this.monacoEditor.onDidChangeCursorPosition,
      (event: ICursorPositionChangedEvent) => event,
    );

    const latestModelContentChangeObs = derivedHandleChanges(
      {
        owner: this,
        createEmptyChangeSummary: () => ({ change: undefined }),
        handleChange: (ctx, changeSummary: { change: IModelContentChangedEvent | undefined }) => {
          // 如果只是改了光标则设置 change 为空，避免获取到缓存的 change
          if (ctx.didChange(positionChangeObs)) {
            changeSummary.change = undefined;
          } else {
            changeSummary.change = modelContentChangeObs.get();
          }
          return true;
        },
      },
      (reader, changeSummary) => {
        positionChangeObs.read(reader);
        modelContentChangeObs.read(reader);
        return changeSummary.change;
      },
    );

    this.addDispose(recomputeInitiallyAndOnChange(latestModelContentChangeObs));

    let lastModelContent: IModelContentChangedEvent | undefined;
    this.addDispose(
      /**
       * 由于 monaco 的 changeModelContent 事件比 changeCursorPosition 事件先触发，所以这里需要拿上一次的值进行消费
       * 否则永远返回 undefined
       */
      autorunDelta(latestModelContentChangeObs, ({ lastValue }) => {
        lastModelContent = lastValue;
      }),
    );

    this.addDispose(
      autorunDelta(positionChangeObs, ({ lastValue, newValue }) => {
        const contentChange = lastModelContent;

        const isLineChangeEnabled = this.preferenceService.getValid(
          AINativeSettingSectionsId.CodeEditsLineChange,
          false,
        );
        if (!isLineChangeEnabled) {
          return false;
        }

        const prePosition = lastValue?.position;
        const currentPosition = newValue?.position;
        if (prePosition && prePosition.lineNumber !== currentPosition?.lineNumber) {
          this.setBean({
            typing: ECodeEditsSourceTyping.LineChange,
            position: currentPosition,
            data: {
              preLineNumber: prePosition.lineNumber,
              currentLineNumber: currentPosition.lineNumber,
              change: contentChange,
            },
          });
        }

        // 消费完之后设置为 undefined，避免下次获取到缓存的值
        lastModelContent = undefined;
      }),
    );

    return this;
  }
}
