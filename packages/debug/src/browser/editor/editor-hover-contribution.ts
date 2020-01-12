import { IEditorFeatureContribution } from '@ali/ide-editor/lib/browser';
import { IEditor } from '@ali/ide-editor';
import { IDisposable, Disposable  } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService } from '@ali/ide-core-browser';

@Injectable()
export class EditorHoverContribution implements IEditorFeatureContribution {

  static keySet = new Set(['inDebugMode']);

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  contribute(editor: IEditor): IDisposable {

    const disposer = new Disposable();
    this.updateHoverEnabled(editor);

    disposer.addDispose(this.contextKeyService.onDidChangeContext((e) => {
      if (e.payload.affectsSome(EditorHoverContribution.keySet)) {
        this.updateHoverEnabled(editor);
      }
    }));

    return disposer;
  }

  updateHoverEnabled(editor: IEditor) {
    const inDebugMode = this.contextKeyService.match('inDebugMode');
    // monaco 内置hover选项
    editor.monacoEditor.updateOptions({
      hover: {
        enabled: !inDebugMode,
      },
    });
  }

}
