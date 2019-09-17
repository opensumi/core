import { URI, Disposable } from '@ali/ide-core-common';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';
import { SourceBreakpoint } from '../breakpoint/breakpoint-marker';
import { DebugBreakpointWidget } from './debug-breakpoint-widget';
import { DebugSession } from '../debug-session';
import debounce = require('lodash.debounce');

export class DebugModel extends Disposable {
  private _session: DebugSession | undefined;
  private _editor: monaco.editor.ICodeEditor;
  private _model: monaco.editor.ITextModel;
  private _widget: DebugBreakpointWidget;

  constructor(
    private _manager: BreakpointManager,
  ) {
    super();
  }

  attach(
    editor: monaco.editor.ICodeEditor,
    model: monaco.editor.ITextModel,
  ) {
    this._editor = editor;
    this._model = model;

    this._widget = new DebugBreakpointWidget(this._editor);

    this._editor.onMouseDown(debounce(this.onMouseDown.bind(this), 200));
    this._editor.onMouseMove(this.onMouseMove.bind(this));
    this._editor.onMouseLeave(this.onMouseLeave.bind(this));
  }

  set session(session: DebugSession | undefined) {
    this._session = session;
    this.events();
  }

  private _checkOwner() {
    if (!this._editor) {
      return false;
    }

    const model = this._editor.getModel();

    if (model && model.uri.toString() === this._model.uri.toString()) {
      return true;
    }

    return false;
  }

  onMouseDown(event: monaco.editor.IEditorMouseEvent) {
    if (!this._checkOwner()) {
      return;
    }

    if (event.target && event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      if (event.event.rightButton) {
        // TODO 右键菜单操作放在下一个迭代
      } else {
        const { position } = event.target;
        if (position) {
           this.toggleBreakpoint(position.lineNumber);
        }
      }
    }
  }

  onMouseMove(event: monaco.editor.IEditorMouseEvent) {
    if (!this._checkOwner()) {
      return;
    }

    if (event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      const { position } = event.target;
      if (position) {
        const { lineNumber } = position;
        this._widget.updateHoverPlaceholder(lineNumber);
      }
    } else {
      console.log(event.target);
    }
  }

  onMouseLeave(event: monaco.editor.IEditorMouseEvent) {
    if (!this._checkOwner()) {
      return;
    }
  }

  toggleBreakpoint(lineNumber: number) {
    const uri = new URI(this._model.uri.toString());
    const breakpoint = this._manager.getBreakpoint(uri, lineNumber);

    this._widget.toggleAddedPlaceholder(lineNumber);

    if (breakpoint) {
      // TODO remove a breakpoint
    } else {
      this._manager.addBreakpoint(
        SourceBreakpoint.create(uri, { line: lineNumber }));
    }
  }

  hitBreakpoint() {
    if (!this._session) {
      throw new Error('Can not hit breakpoint without session');
    }
    const frame = this._session.currentFrame;

    if (!frame) {
      throw new Error('Can not hit breakpoint without debug frame');
    }

    const { line } = frame.raw;

    this._widget.hitBreakpointPlaceHolder(line);
  }

  stopDebug() {
    this._widget.clearHitBreakpointPlaceHolder();
  }

  events() {
    if (!this._session) {
      return;
    }

    this._session.on('exited', () => {
      this._widget.clearHitBreakpointPlaceHolder();
    });

    this._session.on('terminated', () => {
      this._widget.clearHitBreakpointPlaceHolder();
    });
  }
}
