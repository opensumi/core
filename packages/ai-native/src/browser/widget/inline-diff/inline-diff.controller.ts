import { Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';

import { BaseAIMonacoEditorController } from '../../contrib/base';
import { EResultKind } from '../inline-chat/inline-chat.service';

import { InlineDiffHandler } from './inline-diff.handler';

@Injectable()
export class InlineDiffController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.inline.diff';

  public static get(editor: ICodeEditor): InlineDiffController | null {
    return editor.getContribution<InlineDiffController>(InlineDiffController.ID);
  }

  private inlineDiffHandler: InlineDiffHandler;
  mount(): IDisposable {
    this.inlineDiffHandler = this.injector.get(InlineDiffHandler);
    this.inlineDiffHandler.mountEditor(this.monacoEditor);
    this.inlineDiffHandler.load();

    return this.inlineDiffHandler;
  }

  get handler(): InlineDiffHandler {
    return this.inlineDiffHandler;
  }
}
