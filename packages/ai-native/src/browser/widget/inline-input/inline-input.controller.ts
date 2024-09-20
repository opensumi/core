import { Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';

import { BaseAIMonacoEditorController } from '../../contrib/base';

import { InlineInputHandler } from './inline-input.handler';

@Injectable()
export class InlineInputController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.inline.input';

  public static get(editor: ICodeEditor): InlineInputController | null {
    return editor.getContribution<InlineInputController>(InlineInputController.ID);
  }

  private inlineInputHandler: InlineInputHandler;
  mount(): IDisposable {
    this.inlineInputHandler = this.injector.get(InlineInputHandler);
    this.inlineInputHandler.mountEditor(this.monacoEditor);
    this.inlineInputHandler.load();

    return this.inlineInputHandler;
  }
}
