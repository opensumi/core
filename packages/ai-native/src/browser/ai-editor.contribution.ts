import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { Disposable, Event, IDisposable, Schemes } from '@opensumi/ide-core-common';
import { DesignBrowserCtxMenuService } from '@opensumi/ide-design/lib/browser/override/menu.service';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { BrowserCodeEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';

import { CodeActionHandler } from './contrib/code-action/code-action.handler';
import { InlineCompletionHandler } from './contrib/inline-completions/inline-completions.handler';
import { InlineChatHandler } from './widget/inline-chat/inline-chat.handler';

@Injectable()
export class AIEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: DesignBrowserCtxMenuService;

  @Autowired(InlineChatHandler)
  private readonly inlineChatHandler: InlineChatHandler;

  @Autowired(CodeActionHandler)
  private readonly codeActionHandler: CodeActionHandler;

  @Autowired(InlineCompletionHandler)
  private readonly inlineCompletionHandler: InlineCompletionHandler;

  private modelSessionDisposable: Disposable;
  private initialized: boolean = false;

  dispose(): void {
    super.dispose();
    this.initialized = false;
    if (this.modelSessionDisposable) {
      this.modelSessionDisposable.dispose();
    }
  }

  contribute(editor: IEditor): IDisposable {
    if (!(editor instanceof BrowserCodeEditor) || this.initialized) {
      return this;
    }

    this.disposables.push(
      editor.onRefOpen((e) => {
        const { uri } = e.instance;
        if (uri.codeUri.scheme !== Schemes.file || this.initialized) {
          return;
        }

        this.initialized = true;

        this.addDispose(
          Event.debounce(
            monacoEditor.onWillChangeModel,
            (_, e) => e,
            150,
          )(() => {
            this.mount(editor);
          }),
        );
        this.mount(editor);

        this.addDispose(this.inlineCompletionHandler.registerInlineCompletionFeature(editor));
        this.addDispose(this.inlineChatHandler.registerInlineChatFeature(editor));
        this.addDispose(this.inlineChatHandler.registerHintLineFeature(editor));
      }),
    );

    const { monacoEditor } = editor;

    this.disposables.push(
      monacoEditor.onDidScrollChange(() => {
        if (this.ctxMenuRenderer.visible) {
          this.ctxMenuRenderer.hide(true);
        }
      }),
    );

    return this;
  }

  private async mount(editor: IEditor): Promise<void> {
    const { monacoEditor } = editor;

    if (this.modelSessionDisposable) {
      this.modelSessionDisposable.dispose();
    }

    const model = monacoEditor.getModel();
    if (!model) {
      return;
    }

    this.modelSessionDisposable = new Disposable();

    if (this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
      this.modelSessionDisposable.addDispose(this.inlineCompletionHandler.mountEditor(editor));
    }
    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      this.modelSessionDisposable.addDispose(this.codeActionHandler.mountEditor(editor));
    }
  }
}
