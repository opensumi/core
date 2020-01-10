import { IEditorFeatureContribution } from '@ali/ide-editor/lib/browser';
import { IEditor } from '@ali/ide-editor';
import { IDisposable, Disposable  } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { IDebugSessionManager } from '../../common';
import { DebugSessionManager } from '../debug-session-manager';

@Injectable()
export class EditorHoverContribution implements IEditorFeatureContribution {

  @Autowired(IDebugSessionManager)
  protected readonly manager: DebugSessionManager;

  contribute(editor: IEditor): IDisposable {

    const disposer = new Disposable();

    disposer.addDispose(this.manager.onDidStartDebugSession(() => {
      this.setHoverEnabled(editor, false);
    }));

    disposer.addDispose(this.manager.onDidStopDebugSession(() => {
      this.setHoverEnabled(editor, true);
    }));

    return disposer;
  }

  setHoverEnabled(editor: IEditor, hoverEnabled: boolean) {
    // monaco 内置hover选项
    editor.monacoEditor.updateOptions({
      hover: {
        enabled: hoverEnabled,
      },
    });
  }

}
