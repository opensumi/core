import { Injectable, Autowired } from '@opensumi/di';
import { Disposable, URI, Emitter, Event, DisposableCollection } from '@opensumi/ide-core-common';
import { EditorCollectionService, ICodeEditor, WorkbenchEditorService } from '@opensumi/ide-editor';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { DebugModelFactory, IDebugModel, BreakpointsChangeEvent } from '../../common';
import { BreakpointManager } from '../breakpoint';
import { DebugConfigurationManager } from '../debug-configuration-manager';

enum DebugModelSupportedEventType {
  down = 'Down',
  move = 'Move',
  leave = 'Leave',
  contextMenu = 'contextMenu',
}

@Injectable()
export class DebugModelManager extends Disposable {
  private models: Map<string, IDebugModel[]>;
  protected readonly toDispose = new DisposableCollection();

  @Autowired(WorkbenchEditorService)
  private editorService: WorkbenchEditorService;

  @Autowired(EditorCollectionService)
  private editorCollection: EditorCollectionService;

  @Autowired(DebugModelFactory)
  private debugModelFactory: DebugModelFactory;

  @Autowired(BreakpointManager)
  private breakpointManager: BreakpointManager;

  @Autowired(DebugConfigurationManager)
  private debugConfigurationManager: DebugConfigurationManager;

  private _onMouseDown = new Emitter<monaco.editor.IEditorMouseEvent>();
  private _onMouseMove = new Emitter<monaco.editor.IEditorMouseEvent>();
  private _onMouseLeave = new Emitter<monaco.editor.IPartialEditorMouseEvent>();
  private _onMouseUp = new Emitter<monaco.editor.IEditorMouseEvent>();

  public onMouseDown = this._onMouseDown;
  public onMouseMove = this._onMouseMove;
  public onMouseLeave = this._onMouseLeave;
  public onMouseUp = this._onMouseUp;

  private _onModelChanged = new Emitter<monaco.editor.IModelChangedEvent>();
  public onModelChanged: Event<monaco.editor.IModelChangedEvent> = this._onModelChanged.event;

  constructor() {
    super();
    this.models = new Map();
  }

  dispose() {
    for (const model of this.models.values()) {
      this.toDispose.pushAll(model);
    }
    this.toDispose.dispose();
    this.models.clear();
  }

  init() {
    this.editorCollection.onCodeEditorCreate((codeEditor: ICodeEditor) => this.push(codeEditor));

    this.breakpointManager.onDidChangeBreakpoints((event) => {
      const { currentEditor } = this.editorService;
      const uri = currentEditor && currentEditor.currentUri;
      if (uri) {
        this.render(uri);
      }
      this.closeBreakpointIfAffected(event);
    });
  }

  get model(): IDebugModel | undefined {
    const { currentEditor } = this.editorService;
    const uri = currentEditor && currentEditor.currentUri;
    if (uri) {
      const models = this.models.get(uri.toString());
      return models && models[0];
    }
  }

  protected closeBreakpointIfAffected({ affected, removed }: BreakpointsChangeEvent): void {
    affected.forEach((uri) => {
      const models = this.models.get(uri.toString());
      if (!models) {
        return;
      }
      for (const model of models) {
        const breakpointWidget = model.getBreakpointWidget();
        const position = breakpointWidget.position;
        if (!position) {
          return;
        }
        for (const breakpoint of removed) {
          if (breakpoint.raw.line === position.lineNumber) {
            breakpointWidget.dispose();
          }
        }
      }
    });
  }

  protected render(uri: URI): void {
    const models = this.models.get(uri.toString());
    if (!models) {
      return;
    }
    for (const model of models) {
      model.render();
    }
  }

  protected push(codeEditor: ICodeEditor): void {
    const monacoEditor = (codeEditor as any).monacoEditor;
    codeEditor.onRefOpen((ref) => {
      const uriString = ref.instance.uri.toString();
      const debugModel = this.models.get(uriString) || [];
      let isRendered = false;
      if (debugModel.length > 0) {
        for (const model of debugModel) {
          if ((model.getEditor() as any)._id === (monacoEditor as any)._id) {
            model.render();
            isRendered = true;
            break;
          }
        }
      }
      if (!isRendered) {
        const monacoModel = ref.instance.getMonacoModel();
        const model = this.debugModelFactory(monacoEditor);
        debugModel.push(model);
        this.models.set(uriString, debugModel);
        monacoModel.onWillDispose(() => {
          model!.dispose();
          this.models.delete(uriString);
        });
      }
    });

    const handleMonacoModelEvent = (
      type: DebugModelSupportedEventType,
      event: monaco.editor.IPartialEditorMouseEvent,
    ) => {
      const model = monacoEditor.getModel();
      if (!model) {
        throw new Error('Not find model');
      }

      this.handleMouseEvent(
        new URI(model.uri.toString()),
        type,
        event as monaco.editor.IEditorMouseEvent,
        monacoEditor,
      );
    };
    this.toDispose.push(
      monacoEditor.onMouseMove((event) => handleMonacoModelEvent(DebugModelSupportedEventType.move, event)),
    );
    this.toDispose.push(
      monacoEditor.onMouseDown((event) => handleMonacoModelEvent(DebugModelSupportedEventType.down, event)),
    );
    this.toDispose.push(
      monacoEditor.onMouseLeave((event) => handleMonacoModelEvent(DebugModelSupportedEventType.leave, event)),
    );
    this.toDispose.push(
      monacoEditor.onContextMenu((event) => handleMonacoModelEvent(DebugModelSupportedEventType.contextMenu, event)),
    );
    this.toDispose.push(monacoEditor.onDidChangeModel((event) => this._onModelChanged.fire(event)));
  }

  resolve(uri: URI) {
    const model = this.models.get(uri.toString());
    if (!model) {
      return undefined;
    }
    return model;
  }

  handleMouseEvent(
    uri: URI,
    type: DebugModelSupportedEventType,
    event: monaco.editor.IEditorMouseEvent | monaco.editor.IPartialEditorMouseEvent,
    monacoEditor: IMonacoCodeEditor,
  ) {
    const debugModel = this.models.get(uri.toString());
    if (!debugModel) {
      return;
    }
    // 同一个uri可能对应多个打开的monacoEditor，这里只需要验证其中一个即可
    const canSetBreakpoints = this.debugConfigurationManager.canSetBreakpointsIn(debugModel[0].getEditor().getModel()!);
    if (!canSetBreakpoints) {
      return;
    }
    for (const model of debugModel) {
      if (model.getEditor().getId() === monacoEditor.getId()) {
        switch (type) {
          case DebugModelSupportedEventType.contextMenu:
            model.onContextMenu(event);
            break;
          case DebugModelSupportedEventType.down:
            model.onMouseDown(event);
            break;
          case DebugModelSupportedEventType.leave:
            model.onMouseLeave(event);
            break;
          case DebugModelSupportedEventType.move:
            model.onMouseMove(event);
            break;
          default:
            break;
        }
        break;
      }
    }
  }
}
