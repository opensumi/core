import { Disposable, URI, Emitter, DisposableCollection } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorCollectionService, ICodeEditor } from '@ali/ide-editor';
import { DebugModel, DebugModelFactory } from './debug-model';
import { DebugSessionManager } from '../debug-session-manager';
import { IDebugSessionManager } from '../../common';
import { BreakpointManager, BreakpointsChangeEvent } from '../breakpoint';

export enum DebugModelSupportedEventType {
  down = 'Down',
  move = 'Move',
  leave = 'Leave',
}

@Injectable()
export class DebugModelManager extends Disposable {
  private models: Map<string, DebugModel>;
  protected readonly toDispose = new DisposableCollection();

  @Autowired(EditorCollectionService)
  private editorColletion: EditorCollectionService;

  @Autowired(DebugModelFactory)
  private debugModelFactory: DebugModelFactory;

  @Autowired(IDebugSessionManager)
  private debugSessionManager: DebugSessionManager;

  @Autowired(BreakpointManager)
  private breakpointManager: BreakpointManager;

  private _onMouseDown = new Emitter<monaco.editor.IEditorMouseEvent>();
  private _onMouseMove = new Emitter<monaco.editor.IEditorMouseEvent>();
  private _onMouseLeave = new Emitter<monaco.editor.IPartialEditorMouseEvent>();
  private _onMouseUp = new Emitter<monaco.editor.IEditorMouseEvent>();

  public onMouseDown = this._onMouseDown;
  public onMouseMove = this._onMouseMove;
  public onMouseLeave = this._onMouseLeave;
  public onMouseUp = this._onMouseUp;

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
      if (!session || session === this.debugSessionManager.currentSession) {
        this.render(uri);
      }
    });
    this.breakpointManager.onDidChangeBreakpoints((event) => {
      // 移除breakpointWidget
    });
  }

  protected render(uri: URI): void {
    const model = this.models.get(uri.toString());
    if (model) {
        model.render();
    }
  }

  protected push(codeEditor: ICodeEditor): void {
    const monacoEditor = (codeEditor as any).monacoEditor as monaco.editor.ICodeEditor;
    codeEditor.onRefOpen((ref) => {
      const uriString = ref.instance.uri.toString();
      let debugModel = this.models.get(uriString);
      if (!debugModel) {
        const model = ref.instance.getMonacoModel();
        debugModel = this.debugModelFactory(monacoEditor) as DebugModel;
        this.models.set(uriString, debugModel);
        model.onWillDispose(() => {
          debugModel!.dispose();
          this.models.delete(uriString);
        });
      } else {
        console.log('debugModel render', debugModel);
        debugModel.render();
      }
    });

    const handleMonacoModelEvent = (type: DebugModelSupportedEventType, event: monaco.editor.IPartialEditorMouseEvent) => {
      const model = monacoEditor.getModel();
      if (!model) {
        throw new Error('Not find model');
      }

      this.handleMouseEvent(new URI(model.uri.toString()),
        type, event as monaco.editor.IEditorMouseEvent);
    };

    this.toDispose.push(
      monacoEditor.onMouseMove((event) => handleMonacoModelEvent(DebugModelSupportedEventType.move, event)));
    this.toDispose.push(
      monacoEditor.onMouseDown((event) => handleMonacoModelEvent(DebugModelSupportedEventType.down, event)));
    this.toDispose.push(
      monacoEditor.onMouseLeave((event) => handleMonacoModelEvent(DebugModelSupportedEventType.leave, event)));
  }

  resolve(uri: URI) {
    const model = this.models.get(uri.toString());

    if (!model) {
      // throw new Error('Can not find this model');
      return undefined;
    }

    return model;
  }

  getCurrent(monacoEditor: monaco.editor.ICodeEditor) {
    const model = monacoEditor.getModel();

    if (!model) {
      return null;
    }

    const debugModel = this.models.get(model.uri.toString());

    if (!debugModel) {
      return null;
    }

    return debugModel;
  }

  handleMouseEvent(uri: URI, type: DebugModelSupportedEventType, event: monaco.editor.IEditorMouseEvent | monaco.editor.IPartialEditorMouseEvent) {
    const debugModel = this.models.get(uri.toString());

    if (!debugModel) {
      throw new Error('Not find debug model');
    }

    debugModel[`onMouse${type}`](event);
  }

}
