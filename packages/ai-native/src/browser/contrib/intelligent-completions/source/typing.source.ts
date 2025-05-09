import { Injectable } from '@opensumi/di';
import { AINativeSettingSectionsId, ECodeEditsSourceTyping, IDisposable } from '@opensumi/ide-core-common';
import { IModelContentChangedEvent } from '@opensumi/ide-monaco';

import { BaseCodeEditsSource } from './base';

@Injectable({ multiple: true })
export class TypingCodeEditsSource extends BaseCodeEditsSource {
  public priority = 2;

  public mount(): IDisposable {
    this.addDispose(
      this.monacoEditor.onDidChangeModelContent((event: IModelContentChangedEvent) => {
        this.doTrigger(event);
      }),
    );
    return this;
  }

  protected async doTrigger(data: IModelContentChangedEvent) {
    const isTypingEnabled = this.preferenceService.getValid(AINativeSettingSectionsId.CodeEditsTyping, false);

    if (!isTypingEnabled || !this.model) {
      return;
    }

    this.setBean({
      typing: ECodeEditsSourceTyping.Typing,
      data: {
        [ECodeEditsSourceTyping.Typing]: data,
      },
    });
  }
}
