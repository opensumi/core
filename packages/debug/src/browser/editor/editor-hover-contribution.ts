import { DebugModelManager } from './debug-model-manager';
import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { IEditorFeatureContribution } from '@ali/ide-editor/lib/browser';
import { IEditor } from '@ali/ide-editor';
import { IDisposable, Disposable  } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService } from '@ali/ide-core-browser';

@Injectable()
export class EditorHoverContribution implements IEditorFeatureContribution {

  static keySet = new Set(['debugStopped']);

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(DebugModelManager)
  protected readonly debugModelManager: DebugModelManager;

  contribute(editor: IEditor): IDisposable {

    const disposer = new Disposable();

    this.toggleHoverEnabled(editor);

    disposer.addDispose(this.contextKeyService.onDidChangeContext((e) => {
      if (e.payload.affectsSome(EditorHoverContribution.keySet)) {
        this.toggleHoverEnabled(editor);
      }
    }));

    disposer.addDispose(editor.monacoEditor.onKeyDown(async (keydownEvent: monaco.IKeyboardEvent) => {
      if (keydownEvent.keyCode === monaco.KeyCode.Alt) {
        editor.monacoEditor.updateOptions({ hover: { enabled: true } });
        this.debugModelManager.model?.debugHoverWidget.hide();
        const listener = editor.monacoEditor.onKeyUp(async (keyupEvent: monaco.IKeyboardEvent) => {
          if (keyupEvent.keyCode === monaco.KeyCode.Alt) {
            editor.monacoEditor.updateOptions({ hover: { enabled: false } });
            this.debugModelManager.model?.debugHoverWidget.show();
            listener.dispose();
          }
        });
      }
    }));

    return disposer;
  }

  toggleHoverEnabled(editor: IEditor) {
    const inDebugMode = this.contextKeyService.match('debugStopped');
    // monaco 内置hover选项
    editor.monacoEditor.updateOptions({
      hover: {
        enabled: !inDebugMode,
      },
    });
  }

}
