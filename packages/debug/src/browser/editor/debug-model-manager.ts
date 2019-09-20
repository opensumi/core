import { Disposable, URI, Emitter } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorCollectionService, ICodeEditor } from '@ali/ide-editor';
import { DebugModel, DebugModelFactory } from './debug-model';
import { DebugSessionManager } from '../debug-session-manager';
import { IDebugSessionManager } from '../../common';

export enum DebugModelSupportedEventType {
  down = 'Down',
  move = 'Move',
  up = 'Up',
  leave = 'Leave',
}

@Injectable()
export class DebugModelManager extends Disposable {
  private models: Map<string, DebugModel>;

  @Autowired(EditorCollectionService)
  private editorColletion: EditorCollectionService;

  @Autowired(DebugModelFactory)
  private debugModelFactory: DebugModelFactory;

  @Autowired(IDebugSessionManager)
  private debugSessionManager: DebugSessionManager;

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
    this.editorColletion
      .onCodeEditorCreate((codeEditor: ICodeEditor) => this.push(codeEditor));

    this.debugSessionManager.onDidChangeBreakpoints(({ session, uri }) => {
      // if (!session || session === this.debugSessionManager.currentSession) {
      //     this.render(uri);
      // }
    });
  }

  protected push(codeEditor: ICodeEditor): void {
    const self = this;
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

    function handleMonacoModelEvent(type: DebugModelSupportedEventType, event: monaco.editor.IPartialEditorMouseEvent) {
      const model = monacoEditor.getModel();
      if (!model) {
        throw new Error('Not find model');
      }

      self.handleMouseEvent(new URI(model.uri.toString()),
        type, event as monaco.editor.IEditorMouseEvent);
    }

    monacoEditor.onMouseMove((event) => handleMonacoModelEvent(DebugModelSupportedEventType.move, event));
    monacoEditor.onMouseDown((event) => handleMonacoModelEvent(DebugModelSupportedEventType.down, event));
    monacoEditor.onMouseUp((event) => handleMonacoModelEvent(DebugModelSupportedEventType.up, event));
    monacoEditor.onMouseLeave((event) => handleMonacoModelEvent(DebugModelSupportedEventType.leave, event));
    monacoEditor.onDidChangeModel((event) => this.handleModelChangeEvent(event));
  }

  resolve(uri: URI) {
    const model = this.models.get(uri.toString());

    if (!model) {
      // throw new Error('Can not find this model');
      return undefined;
    }

    return model;
  }

  handleMouseEvent(uri: URI, type: DebugModelSupportedEventType, event: monaco.editor.IEditorMouseEvent | monaco.editor.IPartialEditorMouseEvent) {
    const debugModel = this.models.get(uri.toString());

    if (!debugModel) {
      throw new Error('Not find debug model');
    }

    debugModel[`onMouse${type}`](event);
  }

  handleModelChangeEvent(event: monaco.editor.IModelChangedEvent) {
    const { newModelUrl } = event;

    if (!newModelUrl) {
      return;
    }

    const debugModel = this.models.get(newModelUrl.toString());

    if (!debugModel) {
      /**
       * 对于新创建的 model 而言，不会有 degbugModel 被查询到，
       * 不过由于是新创建的，也不会包含任何的调试信息，
       * 调试信息落盘到本地之后可能需要处理。
       */
      return;
    }

    debugModel.onShow();
  }
}
