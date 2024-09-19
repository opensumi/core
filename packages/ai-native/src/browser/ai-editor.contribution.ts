import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { AINativeConfigService } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { Disposable, Event, FRAME_THREE, IDisposable, InlineChatFeatureRegistryToken } from '@opensumi/ide-core-common';
import { DesignBrowserCtxMenuService } from '@opensumi/ide-design/lib/browser/override/menu.service';
import { IDiffEditor } from '@opensumi/ide-editor';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { BrowserCodeEditor, BrowserDiffEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';

import { CodeActionHandler } from './contrib/code-action/code-action.handler';
import { InlineCompletionHandler } from './contrib/inline-completions/inline-completions.handler';
import { ProblemFixHandler } from './contrib/problem-fix/problem-fix.handler';
import { RenameHandler } from './contrib/rename/rename.handler';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { InlineChatHandler } from './widget/inline-chat/inline-chat.handler';
import { InlineDiffHandler } from './widget/inline-diff/inline-diff.handler';
import { InlineHintHandler } from './widget/inline-hint/inline-hint.handler';
import { InlineInputHandler } from './widget/inline-input/inline-input.handler';

class HandlersCollection extends Disposable {
  constructor(private readonly injector: Injector) {
    super();
    this.addDispose([
      this.inlineChatHandler,
      this.inlineHintHandler,
      this.inlineInputHandler,
      this.inlineDiffHandler,
      this.inlineCompletionHandler,
      this.problemfixHandler,
      this.renameHandler,
    ]);
  }

  private _inlineHintHandler: InlineHintHandler;
  get inlineHintHandler() {
    return this._inlineHintHandler || (this._inlineHintHandler = this.injector.get(InlineHintHandler));
  }

  private _inlineInputHandler: InlineInputHandler;
  get inlineInputHandler() {
    return this._inlineInputHandler || (this._inlineInputHandler = this.injector.get(InlineInputHandler));
  }

  private _inlineDiffHandler: InlineDiffHandler;
  get inlineDiffHandler() {
    return this._inlineDiffHandler || (this._inlineDiffHandler = this.injector.get(InlineDiffHandler));
  }

  private _inlineChatHandler: InlineChatHandler;
  get inlineChatHandler() {
    return (
      this._inlineChatHandler ||
      (this._inlineChatHandler = this.injector.get(InlineChatHandler, [this.inlineDiffHandler]))
    );
  }

  private _inlineCompletionHandler: InlineCompletionHandler;
  get inlineCompletionHandler() {
    return (
      this._inlineCompletionHandler || (this._inlineCompletionHandler = this.injector.get(InlineCompletionHandler))
    );
  }

  private _problemfixHandler: ProblemFixHandler;
  get problemfixHandler() {
    return (
      this._problemfixHandler ||
      (this._problemfixHandler = this.injector.get(ProblemFixHandler, [this.inlineChatHandler]))
    );
  }

  private _renameHandler: RenameHandler;
  get renameHandler() {
    return this._renameHandler || (this._renameHandler = this.injector.get(RenameHandler));
  }
}

@Injectable({ multiple: true })
export class AIEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: DesignBrowserCtxMenuService;

  @Autowired(CodeActionHandler)
  private readonly codeActionHandler: CodeActionHandler;

  private modelSessionDisposable: Disposable = new Disposable();
  private handlersCollection: HandlersCollection;

  dispose(): void {
    super.dispose();
    this.modelSessionDisposable?.dispose();
    this.handlersCollection?.dispose();
  }

  contribute(editor: IEditor | IDiffEditor): IDisposable {
    this.handlersCollection = new HandlersCollection(this.injector);

    if (editor instanceof BrowserCodeEditor) {
      this.disposables.push(...this.handleBrowserEditor(editor));
    }
    if (editor instanceof BrowserDiffEditor) {
      this.disposables.push(...this.handleDiffEditor(editor));
    }
    return this;
  }

  private handleBrowserEditor(editor: IEditor): IDisposable[] {
    const disposables: IDisposable[] = [];
    const { monacoEditor } = editor;

    disposables.push(
      Event.debounce(
        monacoEditor.onWillChangeModel,
        (_, e) => e,
        FRAME_THREE,
      )(() => {
        this.mount(editor);
      }),
    );
    this.mount(editor);

    disposables.push(...this.registerFeatures(editor));
    disposables.push(
      monacoEditor.onDidScrollChange(() => {
        if (this.ctxMenuRenderer.visible) {
          this.ctxMenuRenderer.hide(true);
        }
      }),
    );
    return disposables;
  }

  private handleDiffEditor(editor: BrowserDiffEditor): IDisposable[] {
    const disposables: IDisposable[] = [];
    const { monacoDiffEditor } = editor;

    disposables.push(
      Event.debounce(
        monacoDiffEditor.onDidUpdateDiff,
        (_, e) => e,
        FRAME_THREE,
      )(() => {
        this.mount(editor.modifiedEditor);
        this.mount(editor.originalEditor);
      }),
    );
    this.mount(editor.modifiedEditor);
    this.mount(editor.originalEditor);

    disposables.push(...this.registerFeatures(editor.modifiedEditor, true));
    disposables.push(...this.registerFeatures(editor.originalEditor, true));
    return disposables;
  }

  private registerFeatures(editor: IEditor, isDiffEditor = false) {
    const disposables: IDisposable[] = [];
    if (!isDiffEditor) {
      disposables.push(this.handlersCollection.inlineCompletionHandler.registerInlineCompletionFeature(editor));
    }
    disposables.push(this.handlersCollection.inlineChatHandler.registerInlineChatFeature(editor));

    if (this.inlineChatFeatureRegistry.getInteractiveInputHandler() && !isDiffEditor) {
      this.addDispose(this.handlersCollection.inlineHintHandler.registerHintLineFeature(editor));
      this.addDispose(this.handlersCollection.inlineInputHandler.registerInlineInputFeature(editor));
    }

    this.addDispose(this.handlersCollection.inlineDiffHandler.registerInlineDiffFeature(editor));

    return disposables;
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
      this.handlersCollection.inlineCompletionHandler.load();
      this.modelSessionDisposable.addDispose(this.handlersCollection.inlineCompletionHandler.mountEditor(editor));
    }
    if (this.aiNativeConfigService.capabilities.supportsProblemFix) {
      this.handlersCollection.problemfixHandler.load();
      this.modelSessionDisposable.addDispose(this.handlersCollection.problemfixHandler.mountEditor(editor));
    }
    if (this.aiNativeConfigService.capabilities.supportsRenameSuggestions) {
      this.handlersCollection.renameHandler.load();
    }

    // 以下是需要全局单例的 handler
    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      this.codeActionHandler.load();
      this.modelSessionDisposable.addDispose(this.codeActionHandler.mountEditor(editor));
    }

    this.modelSessionDisposable.addDispose(this.handlersCollection.inlineDiffHandler.mountEditor(editor));
  }
}
