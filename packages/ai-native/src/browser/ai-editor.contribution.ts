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
import { IntelligentCompletionsHandler } from './contrib/intelligent-completions/intelligent-completions.handler';
import { ProblemFixHandler } from './contrib/problem-fix/problem-fix.handler';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { InlineChatHandler } from './widget/inline-chat/inline-chat.handler';
import { InlineDiffHandler } from './widget/inline-diff/inline-diff.handler';
import { InlineHintHandler } from './widget/inline-hint/inline-hint.handler';
import { InlineInputHandler } from './widget/inline-input/inline-input.handler';

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

  private modelSessionDisposable: Disposable = new Disposable();
  private handlerDisposable: Disposable = new Disposable();

  private handlers: { [key: string]: any } = {};

  dispose(): void {
    super.dispose();
    this.modelSessionDisposable?.dispose();
    this.handlerDisposable?.dispose();
  }

  contribute(editor: IEditor | IDiffEditor): IDisposable {
    this.handlers.inlineChatHandler = this.injector.get(InlineChatHandler);
    this.handlers.inlineHintHandler = this.injector.get(InlineHintHandler);
    this.handlers.inlineInputHandler = this.injector.get(InlineInputHandler);
    this.handlers.codeActionHandler = this.injector.get(CodeActionHandler);
    this.handlers.inlineDiffHandler = this.injector.get(InlineDiffHandler);
    this.handlers.inlineCompletionHandler = this.injector.get(InlineCompletionHandler);
    this.handlers.problemfixHandler = this.injector.get(ProblemFixHandler);
    this.handlers.intelligentCompletionsHandler = this.injector.get(IntelligentCompletionsHandler);

    this.handlerDisposable.addDispose(
      Disposable.create(() => {
        Object.values(this.handlers).forEach((handler) => handler.dispose());
      }),
    );

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
      disposables.push(this.handlers.inlineCompletionHandler.registerInlineCompletionFeature(editor));
    }
    disposables.push(this.handlers.inlineChatHandler.registerInlineChatFeature(editor));

    if (this.inlineChatFeatureRegistry.getInteractiveInputHandler() && !isDiffEditor) {
      this.addDispose(this.handlers.inlineHintHandler.registerHintLineFeature(editor));
      this.addDispose(this.handlers.inlineInputHandler.registerInlineInputFeature(editor));
    }

    this.addDispose(this.handlers.inlineDiffHandler.registerInlineDiffFeature(editor));

    if (this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
      this.addDispose(this.handlers.intelligentCompletionsHandler.registerFeature(editor));
    }

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
      this.modelSessionDisposable.addDispose(this.handlers.inlineCompletionHandler.mountEditor(editor));
    }
    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      this.modelSessionDisposable.addDispose(this.handlers.codeActionHandler.mountEditor(editor));
    }
    if (this.aiNativeConfigService.capabilities.supportsProblemFix) {
      this.modelSessionDisposable.addDispose(this.handlers.problemfixHandler.mountEditor(editor));
    }

    this.modelSessionDisposable.addDispose(this.handlers.inlineDiffHandler.mountEditor(editor));
  }
}
