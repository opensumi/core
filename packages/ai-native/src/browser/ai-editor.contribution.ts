import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { Disposable, Event, FRAME_THREE, IDisposable } from '@opensumi/ide-core-common';
import { DesignBrowserCtxMenuService } from '@opensumi/ide-design/lib/browser/override/menu.service';
import { IDiffEditor } from '@opensumi/ide-editor';
import { IEditor, IEditorFeatureContribution } from '@opensumi/ide-editor/lib/browser';
import { BrowserCodeEditor, BrowserDiffEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';

@Injectable({ multiple: true })
export class AIEditorContribution extends Disposable implements IEditorFeatureContribution {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: DesignBrowserCtxMenuService;

  private modelSessionDisposable: Disposable = new Disposable();

  dispose(): void {
    super.dispose();
    this.modelSessionDisposable?.dispose();
  }

  contribute(editor: IEditor | IDiffEditor): IDisposable {
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
  }
}
