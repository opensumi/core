import { Disposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorCollectionService, ICodeEditor } from '@ali/ide-editor';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugModel } from './debug-model';

import './debug.module.less';

export enum DebugBreakpointWidget {
  PLACEHOLDER_DECORATION = 'debug-breakpoint-placehodler',
}

@Injectable()
export class DebugModelController extends Disposable {
  private _models: Map<string, DebugModel>;

  @Autowired()
  private editorColletion: EditorCollectionService;

  @Autowired()
  private manager: BreakpointManager;

  @Autowired()
  private session: DebugSessionManager;

  constructor() {
    super();
    this._models = new Map();
  }

  dispose() {
    for (const model of this._models.values()) {
      model.dispose();
    }
    this._models.clear();

    // @ts-ignore
    this._models = null;
  }

  init() {
    this.editorColletion.onCodeEditorCreate((codeEditor) => {
      codeEditor.onRefOpen((ref) => {
        const debugModel = new DebugModel(this.manager, this.session);
        const model = ref.instance.getMonacoModel();
        debugModel.attach((codeEditor as any).monacoEditor, model);
        this._models.set(model.uri.toString(), debugModel);
      });
    });
  }
}
