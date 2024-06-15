import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { Disposable, Event, IDisposable, InlineChatFeatureRegistryToken, Schemes } from '@opensumi/ide-core-common';
import { DesignBrowserCtxMenuService } from '@opensumi/ide-design/lib/browser/override/menu.service';
import { EditorCollectionService, IEditorDocumentModelRef } from '@opensumi/ide-editor';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { BrowserCodeEditor, BrowserDiffEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';

import { CodeActionHandler } from './contrib/code-action/code-action.handler';
import { InlineCompletionHandler } from './contrib/inline-completions/inline-completions.handler';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { InlineChatHandler } from './widget/inline-chat/inline-chat.handler';
import { InlineHintHandler } from './widget/inline-hint/inline-hint.handler';
import { InlineInputHandler } from './widget/inline-input/inline-input.handler';

@Injectable()
export class AIEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: DesignBrowserCtxMenuService;

  @Autowired(InlineChatHandler)
  private readonly inlineChatHandler: InlineChatHandler;

  @Autowired(InlineHintHandler)
  private readonly inlineHintHandler: InlineHintHandler;

  @Autowired(InlineInputHandler)
  private readonly inlineInputHandler: InlineInputHandler;

  @Autowired(CodeActionHandler)
  private readonly codeActionHandler: CodeActionHandler;

  @Autowired(InlineCompletionHandler)
  private readonly inlineCompletionHandler: InlineCompletionHandler;

  @Autowired(EditorCollectionService)
  private readonly editorCollectionService: EditorCollectionService;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  private modelSessionDisposable: Disposable;
  private editorReady: boolean = false;
  private diffEditorReady: boolean = false;

  dispose(): void {
    super.dispose();
    this.editorReady = false;
    if (this.modelSessionDisposable) {
      this.modelSessionDisposable.dispose();
    }
  }

  contribute(editor: IEditor): IDisposable {
    if (this.editorReady) {
      return this;
    }
    this.handleDiffEditorCreated();
    if (editor instanceof BrowserCodeEditor) {
      this.disposables.push(
        editor.onRefOpen((e) => {
          this.disposables.push(...this.handleBrowserEditor(editor, e));
        }),
      );
    }
    return this;
  }

  private handleDiffEditorCreated() {
    Event.once(this.editorCollectionService.onDiffEditorCreate)((editor) => {
      this.disposables.push(
        editor.onRefOpen((e) => {
          this.disposables.push(...this.handleDiffEditor(editor as any, e));
        }),
      );
    });
  }

  private handleBrowserEditor(editor: BrowserCodeEditor, e: IEditorDocumentModelRef): IDisposable[] {
    const disposables: IDisposable[] = [];
    const { monacoEditor } = editor;

    const { uri } = e.instance;
    if (uri.codeUri.scheme !== Schemes.file || this.editorReady) {
      return disposables;
    }

    this.editorReady = true;

    disposables.push(
      Event.debounce(
        monacoEditor.onWillChangeModel,
        (_, e) => e,
        150,
      )(() => {
        this.mount(editor);
      }),
    );
    this.mount(editor);

    disposables.push(this.inlineCompletionHandler.registerInlineCompletionFeature(editor));
    disposables.push(this.inlineChatHandler.registerInlineChatFeature(editor));

    if (this.inlineChatFeatureRegistry.getInteractiveInputHandler()) {
      this.addDispose(this.inlineHintHandler.registerHintLineFeature(editor));
      this.addDispose(this.inlineInputHandler.registerInlineInputFeature(editor));
    }
    disposables.push(
      monacoEditor.onDidScrollChange(() => {
        if (this.ctxMenuRenderer.visible) {
          this.ctxMenuRenderer.hide(true);
        }
      }),
    );
    return disposables;
  }

  private handleDiffEditor(editor: BrowserDiffEditor, e: IEditorDocumentModelRef): IDisposable[] {
    const disposables: IDisposable[] = [];
    const { monacoDiffEditor } = editor;

    const { uri } = e.instance;
    if (uri.codeUri.scheme !== Schemes.file || this.diffEditorReady) {
      return disposables;
    }

    this.diffEditorReady = true;

    disposables.push(
      Event.debounce(
        monacoDiffEditor.onDidUpdateDiff,
        (_, e) => e,
        150,
      )(() => {
        this.mount(editor.modifiedEditor);
        this.mount(editor.originalEditor);
      }),
    );
    this.mount(editor.modifiedEditor);
    this.mount(editor.originalEditor);

    disposables.push(this.inlineCompletionHandler.registerInlineCompletionFeature(editor.modifiedEditor));
    disposables.push(this.inlineCompletionHandler.registerInlineCompletionFeature(editor.originalEditor));
    disposables.push(this.inlineChatHandler.registerInlineChatFeature(editor.modifiedEditor));
    disposables.push(this.inlineChatHandler.registerInlineChatFeature(editor.originalEditor));

    if (this.inlineChatFeatureRegistry.getInteractiveInputHandler()) {
      this.addDispose(this.inlineHintHandler.registerHintLineFeature(editor.modifiedEditor));
      this.addDispose(this.inlineInputHandler.registerInlineInputFeature(editor.modifiedEditor));
      this.addDispose(this.inlineHintHandler.registerHintLineFeature(editor.originalEditor));
      this.addDispose(this.inlineInputHandler.registerInlineInputFeature(editor.originalEditor));
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
      this.modelSessionDisposable.addDispose(this.inlineCompletionHandler.mountEditor(editor));
    }
    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      this.modelSessionDisposable.addDispose(this.codeActionHandler.mountEditor(editor));
    }
  }
}
