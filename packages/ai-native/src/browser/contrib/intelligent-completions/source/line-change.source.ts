import { Injectable } from '@opensumi/di';
import { AINativeSettingSectionsId, ECodeEditsSourceTyping, IDisposable } from '@opensumi/ide-core-common';
import { ICursorPositionChangedEvent } from '@opensumi/ide-monaco';
import { autorunDelta, observableFromEvent } from '@opensumi/ide-monaco/lib/common/observable';

import { BaseCodeEditsSource } from './base';

export interface ILineChangeData {
  currentLineNumber: number;
  preLineNumber?: number;
}

@Injectable({ multiple: true })
export class LineChangeCodeEditsSource extends BaseCodeEditsSource {
  public priority = 1;

  public mount(): IDisposable {
    const positionChangeObs = observableFromEvent<ICursorPositionChangedEvent>(
      this,
      this.monacoEditor.onDidChangeCursorPosition,
      (event: ICursorPositionChangedEvent) => event,
    );

    this.addDispose(
      autorunDelta(positionChangeObs, ({ lastValue, newValue }) => {
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
            data: {
              [ECodeEditsSourceTyping.LineChange]: {
                preLineNumber: prePosition.lineNumber,
                currentLineNumber: currentPosition.lineNumber,
              },
            },
          });
        }
      }),
    );

    return this;
  }
}
