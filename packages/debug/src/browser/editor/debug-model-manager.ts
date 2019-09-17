import { Disposable, IDisposable, URI } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorCollectionService } from '@ali/ide-editor';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';
import { DebugModel } from './debug-model';

import './debug.module.less';
import { DebugSession } from '../debug-session';

export enum DebugBreakpointWidget {
  PLACEHOLDER_DECORATION = 'debug-breakpoint-placehodler',
}

@Injectable()
export class DebugModelManager extends Disposable {
  private _models: Map<string, DebugModel>;

  @Autowired()
  private editorColletion: EditorCollectionService;

  @Autowired()
  private manager: BreakpointManager;

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
      const monacoEditor = (codeEditor as any).monacoEditor;

      codeEditor.onRefOpen((ref) => {
        const debugModel = new DebugModel(this.manager);
        const model = ref.instance.getMonacoModel();
        debugModel.attach(monacoEditor, model);
        this._models.set(model.uri.toString(), debugModel);
      });
    });
  }

  resolve(uri: URI, session?: DebugSession) {
    const model = this._models.get(uri.toString());

    if (!model) {
      throw new Error('Can not find this model');
    }

    model.session = session;

    return model;
  }

  clear() {
    this._models.forEach((model) => {
      model.stopDebug();
    });
  }
}
