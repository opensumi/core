import { Disposable, IDisposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorCollectionService } from '@ali/ide-editor';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugStackFrame } from '../model';
import { DebugModel } from './debug-model';
import { DebugSession } from '../debug-session';

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
        const debugModel = new DebugModel(this.manager);
        const model = ref.instance.getMonacoModel();
        debugModel.attach((codeEditor as any).monacoEditor, model);
        this._models.set(model.uri.toString(), debugModel);
      });
    });

    this.session.onDidStartDebugSession(this.onStart.bind(this));
    // this.session.onDidStopDebugSession(this.onStart.bind(this));
  }

  private _handleFirstFrame(frame: DebugStackFrame | undefined) {
    if (!frame) {
      throw new Error('Debugging frame can not be undefined.');
    }

    const source = frame.source;

    if (!source) {
      throw new Error('Debugging srouce can not be undefined.');
    }

    const model = this._models.get(source.uri.toString());

    if (!model) {
      throw new Error('Cant not find model');
    }

    model.startDebug();
    model.toggleBreakpoint(frame.raw.line);
  }

  private _handleFrame(lastFrame: DebugStackFrame, nextFrame: DebugStackFrame) {
    let model: DebugModel | undefined;
    let line: number = 0;
    const last = lastFrame.source;
    const next = nextFrame.source;

    if (!last || !next) {
      throw new Error('Cant not handle undefined');
    }

    if (last.uri.toString() === next.uri.toString()) {
      line = nextFrame.raw.line;
      model = this._models.get(next.uri.toString());

      if (!model) {
        throw new Error('Cant not find model');
      }
    } else {
      const lastModel = this._models.get(last.uri.toString());
      const nextModel = this._models.get(next.uri.toString());

      if (!lastModel || !nextModel) {
        throw new Error('Cant not find model');
      }

      lastModel.stopDebug();
      nextModel.startDebug();

      model = nextModel;
    }

    model.hitBreakpoint(line);
  }

  private _handleLastFrame(frame: DebugStackFrame | undefined) {
    if (!frame) {
      throw new Error('Debugging frame can not be undefined.');
    }

    const source = frame.source;

    if (!source) {
      throw new Error('Debugging srouce can not be undefined.');
    }

    const model = this._models.get(source.uri.toString());

    if (!model) {
      throw new Error('Cant not find model');
    }

    model.startDebug();
  }

  onStart(sess: DebugSession) {
    let frame = sess.currentFrame;

    const stoppedDispose = sess.on('stopped', () => {
      if (!sess.currentFrame) {
        throw new Error('Debugging frame can not be undefined.');
      }

      if (!frame) {
        this._handleFirstFrame(sess.currentFrame);
      } else {
        this._handleFrame(frame, sess.currentFrame);
      }
      frame = sess.currentFrame;
    });

    const terminatedDispose = sess.on('terminated', () => {
      stoppedDispose.dispose();
      terminatedDispose.dispose();
    });
  }
}
