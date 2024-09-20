import { Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';

import { BaseAIMonacoEditorController } from '../../contrib/base';

import { InlineHintHandler } from './inline-hint.handler';

@Injectable()
export class InlineHintController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.inline.hint';

  public static get(editor: ICodeEditor): InlineHintController | null {
    return editor.getContribution<InlineHintController>(InlineHintController.ID);
  }

  private inlineHintHandler: InlineHintHandler;
  mount(): IDisposable {
    this.inlineHintHandler = this.injector.get(InlineHintHandler);
    this.inlineHintHandler.mountEditor(this.monacoEditor);
    this.inlineHintHandler.load();

    return this.inlineHintHandler;
  }
}
