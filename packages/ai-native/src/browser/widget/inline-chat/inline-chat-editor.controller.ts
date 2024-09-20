import { Disposable, IDisposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { IEditorContribution } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

import { BaseAIMonacoEditorController } from '../../contrib/base';
import { InlineDiffController } from '../inline-diff/inline-diff.controller';

import { InlineChatHandler } from './inline-chat.handler';

/**
 * @internal
 */
export class InlineChatEditorController extends BaseAIMonacoEditorController implements IEditorContribution {
  public static readonly ID = 'editor.contrib.ai.inline.chat';

  public static get(editor: ICodeEditor): InlineChatEditorController | null {
    return editor.getContribution(InlineChatEditorController.ID);
  }

  private inlineChatHandler: InlineChatHandler;
  mount(): IDisposable {
    this.inlineChatHandler = this.injector.get(InlineChatHandler, [InlineDiffController.get(this.monacoEditor)]);
    this.inlineChatHandler.mountEditor(this.monacoEditor);
    this.inlineChatHandler.load();

    return this.inlineChatHandler;
  }

  runAction(params) {
    this.inlineChatHandler.runAction(params);
  }

  get token() {
    return this.inlineChatHandler.cancelIndicator.token;
  }
}
