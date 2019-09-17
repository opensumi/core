import { Disposable, URI } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorCollectionService } from '@ali/ide-editor';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';
import { IDebugSessionManager } from '../../common/debug-session';
import { DebugModel } from './debug-model';

import './debug.module.less';

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

  @Autowired(IDebugSessionManager)
  private sessions: any;

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
      const monacoEditor = (codeEditor as any).monacoEditor as monaco.editor.ICodeEditor;
      codeEditor.onRefOpen((ref) => {
        let debugModel = this._models.get(ref.instance.uri.toString());
        if (!debugModel) {
          const model = ref.instance.getMonacoModel();
          debugModel = new DebugModel(this.manager, this.sessions);

          if (!debugModel) {
            throw new Error('Create debugModel failed');
          }

          debugModel.attach(monacoEditor, model);
          this._models.set(model.uri.toString(), debugModel);

          model.onWillDispose(() => {
            this._models.delete(ref.instance.uri.toString());
          });
        }
      });
    });
  }

  resolve(uri: URI) {
    const model = this._models.get(uri.toString());

    if (!model) {
      // throw new Error('Can not find this model');
      return undefined;
    }

    return model;
  }
}
