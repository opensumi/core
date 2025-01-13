import { Injectable } from '@opensumi/di';
import { AINativeSettingSectionsId, ECodeEditsSourceTyping, IDisposable } from '@opensumi/ide-core-common';
import { ICursorPositionChangedEvent, Position } from '@opensumi/ide-monaco';

import { BaseCodeEditsSource } from './base';

export interface ILineChangeData {
  currentLineNumber: number;
  preLineNumber?: number;
}

@Injectable({ multiple: true })
export class LineChangeCodeEditsSource extends BaseCodeEditsSource {
  public priority = 2;

  private prePosition = this.monacoEditor.getPosition();

  public mount(): IDisposable {
    this.addDispose(
      this.monacoEditor.onDidChangeCursorPosition((event: ICursorPositionChangedEvent) => {
        const currentPosition = event.position;
        if (this.prePosition && this.prePosition.lineNumber !== currentPosition.lineNumber) {
          this.doTrigger(currentPosition);
          this.prePosition = currentPosition;
        }
      }),
    );
    return this;
  }

  protected doTrigger(position: Position) {
    const isLineChangeEnabled = this.preferenceService.getValid(AINativeSettingSectionsId.CodeEditsLineChange, false);

    if (!isLineChangeEnabled || !position) {
      return;
    }

    this.setBean({
      typing: ECodeEditsSourceTyping.LineChange,
      position,
      data: {
        preLineNumber: this.prePosition?.lineNumber,
        currentLineNumber: position.lineNumber,
      },
    });
  }
}
