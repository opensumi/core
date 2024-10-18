import { Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';
import { ICursorPositionChangedEvent } from '@opensumi/ide-monaco';

import { ECodeEditsSource } from '../index';

import { BaseCodeEditsSource } from './base';

@Injectable({ multiple: true })
export class LineChangeCodeEditsSource extends BaseCodeEditsSource {
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

  protected doTrigger() {
    const position = this.monacoEditor.getPosition();
    if (!position) {
      return;
    }

    this.launchProvider(this.monacoEditor, position, {
      typing: ECodeEditsSource.LineChange,
      data: {},
    });
  }
}
