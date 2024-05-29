import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { ContributionProvider, Disposable, Event, IDisposable, Schemes } from '@opensumi/ide-core-common';
import { DesignBrowserCtxMenuService } from '@opensumi/ide-design/lib/browser/override/menu.service';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { BrowserCodeEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';

import { CodeActionHandler } from './contrib/code-action/code-action.handler';
import { InlineCompletionHandler } from './contrib/inline-completions/inline-completions.handler';
import { RenameHandler } from './contrib/rename/rename.handler';
import { AINativeCoreContribution, IAIMiddleware } from './types';
import { InlineChatHandler } from './widget/inline-chat/inline-chat.handler';

@Injectable()
export class AIEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: DesignBrowserCtxMenuService;

  @Autowired(AINativeCoreContribution)
  private readonly contributions: ContributionProvider<AINativeCoreContribution>;

  @Autowired(InlineChatHandler)
  private readonly inlineChatHandler: InlineChatHandler;

  @Autowired(CodeActionHandler)
  private readonly codeActionHandler: CodeActionHandler;

  @Autowired(InlineCompletionHandler)
  private readonly inlineCompletionHandler: InlineCompletionHandler;

  @Autowired(RenameHandler)
  private readonly renameHandler: RenameHandler;

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
            300,
          )(() => {
            this.registerLanguageFeatures(editor);
          }),
        );
        this.registerLanguageFeatures(editor);

        this.addDispose(this.inlineCompletionHandler.registerInlineCompletionFeature(editor));
        this.addDispose(this.inlineChatHandler.registerInlineChatFeature(editor));
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

  private async registerLanguageFeatures(editor: IEditor): Promise<void> {
    const { monacoEditor } = editor;

    if (this.modelSessionDisposable) {
      this.modelSessionDisposable.dispose();
    }

    const model = monacoEditor.getModel();
    if (!model) {
      return;
    }

    this.modelSessionDisposable = new Disposable();
    const languageId = model.getLanguageId();

    if (this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
      let latestMiddlewareCollector: IAIMiddleware | undefined;

      this.contributions.getContributions().forEach((contribution) => {
        if (contribution.middleware) {
          latestMiddlewareCollector = contribution.middleware;
        }
      });

      this.modelSessionDisposable.addDispose(
        this.inlineCompletionHandler.registerProvider(editor, languageId, latestMiddlewareCollector),
      );
    }

    if (this.aiNativeConfigService.capabilities.supportsRenameSuggestions) {
      this.modelSessionDisposable.addDispose(this.renameHandler.registerRenameFeature(languageId));
    }

    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      this.modelSessionDisposable.addDispose(this.codeActionHandler.registerCodeActionFeature(languageId, editor));
    }
  }
}
