import { Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';
import { ICursorPositionChangedEvent } from '@opensumi/ide-monaco';

import { ECodeEditsSource } from '../index';

import { BaseCodeEditsSource } from './base';

@Injectable({ multiple: true })
export class LineChangeCodeEditsSource extends BaseCodeEditsSource {
  public priority = 2;

  public mount(): IDisposable {
    let prePosition = this.monacoEditor.getPosition();

    this.addDispose(
      this.monacoEditor.onDidChangeCursorPosition((event: ICursorPositionChangedEvent) => {
        const currentPosition = event.position;
        if (prePosition && prePosition.lineNumber !== currentPosition.lineNumber) {
          this.doTrigger();
        }
        prePosition = currentPosition;
      }),
    );
    return this;
  }

  private lastEditTime: number | null = null;
  protected doTrigger() {
    const position = this.monacoEditor.getPosition();
    if (!position) {
      return;
    }

    // 如果在 60 秒内再次编辑代码，则不触发
    const currentTime = Date.now();
    if (this.lastEditTime && currentTime - this.lastEditTime < 60 * 1000) {
      return;
    }

    this.lastEditTime = currentTime;
    this.launchProvider(this.monacoEditor, position, {
      typing: ECodeEditsSource.LineChange,
      data: {},
    });
  }
}
