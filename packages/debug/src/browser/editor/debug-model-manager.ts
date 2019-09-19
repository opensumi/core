import { Disposable, URI } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorCollectionService, ICodeEditor } from '@ali/ide-editor';
import { DebugModel, DebugModelFactory } from './debug-model';
import { DebugSessionManager } from '../debug-session-manager';
import { IDebugSessionManager } from '../../common';

@Injectable()
export class DebugModelManager extends Disposable {
  private models: Map<string, DebugModel>;

  @Autowired(EditorCollectionService)
  private editorColletion: EditorCollectionService;

  @Autowired(DebugModelFactory)
  private debugModelFactory: DebugModelFactory;

  @Autowired(IDebugSessionManager)
  private debugSessionManager: DebugSessionManager;

  constructor() {
    super();
    this.models = new Map();
  }

  dispose() {
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
  }

  init() {
    this.editorColletion.onCodeEditorCreate((codeEditor: ICodeEditor) => this.push(codeEditor));

    this.debugSessionManager.onDidChangeBreakpoints(({ session, uri }) => {
      // if (!session || session === this.debugSessionManager.currentSession) {
      //     this.render(uri);
      // }
    });
  }

  protected push(codeEditor: ICodeEditor): void {
    const monacoEditor = (codeEditor as any).monacoEditor as monaco.editor.ICodeEditor;
    codeEditor.onRefOpen((ref) => {
      const uriString = ref.instance.uri.toString();
      let debugModel = this.models.get(uriString);
      if (!debugModel) {
        const model = ref.instance.getMonacoModel();
        debugModel = this.debugModelFactory(monacoEditor);
        this.models.set(uriString, debugModel);
        model.onWillDispose(() => {
          this.models.delete(uriString);
        });
      }
    });
  }

  resolve(uri: URI) {
    const model = this.models.get(uri.toString());

    if (!model) {
      // throw new Error('Can not find this model');
      return undefined;
    }

    return model;
  }
}
