import { Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';
import { ICursorPositionChangedEvent, Position } from '@opensumi/ide-monaco';

import { ECodeEditsSource } from '../index';

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

  private lastEditTime: number | null = null;
  protected doTrigger(position: Position) {
    if (!position) {
      return;
    }

    // 如果在 60 秒内再次编辑代码，则不触发
    const currentTime = Date.now();
    if (this.lastEditTime && currentTime - this.lastEditTime < 60 * 1000) {
      return;
    }

    this.lastEditTime = currentTime;
    this.setBean({
      typing: ECodeEditsSource.LineChange,
      data: {
        preLineNumber: this.prePosition?.lineNumber,
        currentLineNumber: position.lineNumber,
      },
    });
  }
}
