import { URI, Disposable } from '@ali/ide-core-common';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';
import { SourceBreakpoint } from '../breakpoint/breakpoint-marker';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugHoverWidget } from './debug-hover-widget';
import { DebugProtocol } from 'vscode-debugprotocol';

export class DebugModel extends Disposable {
  private _editor: monaco.editor.ICodeEditor;
  private _model: monaco.editor.ITextModel;
  private _hoverWidget: DebugHoverWidget;

  constructor(
    private _manager: BreakpointManager,
    private _session: DebugSessionManager,
  ) {
    super();
  }

  private _initSession() {
    const current = this._session.currentSession;

    if (current) {
      current.on('stopped', this.onStop.bind(this));
      current.on('continued', this.onContinue.bind(this));
      current.on('terminated', this.onTerminate.bind(this));
    }
  }

  attach(
    editor: monaco.editor.ICodeEditor,
    model: monaco.editor.ITextModel,
  ) {
    this._editor = editor;
    this._model = model;

    this._hoverWidget = new DebugHoverWidget(this._editor);

    this._editor.onMouseDown(this.onMouseDown.bind(this));
    this._editor.onMouseMove(this.onMouseMove.bind(this));
    this._editor.onMouseLeave(this.onMouseLeave.bind(this));
    this._initSession();
  }

  onMouseDown(event: monaco.editor.IEditorMouseEvent) {
    if (event.target && event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      if (event.event.rightButton) {
        // TODO 右键菜单操作放在下一个迭代
      } else {
        const { position } = event.target;
        if (position) {
           this.toggleBreakpoint(position);
        }
      }
    }
  }

  onMouseMove(event: monaco.editor.IEditorMouseEvent) {
    if (event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      const { position } = event.target;
      if (position) {
        const { lineNumber } = position;
        this._hoverWidget.updateHoverPlaceholder(lineNumber);
      }
    }
  }

  onMouseLeave(event: monaco.editor.IEditorMouseEvent) {
  }

  toggleBreakpoint(position: monaco.Position) {
    const { lineNumber } = position;
    const uri = new URI(this._model.uri.toString());
    const breakpoint = this._manager.getBreakpoint(uri, lineNumber);

    this._hoverWidget.toggleAddedPlaceholder(lineNumber);

    if (breakpoint) {
      // TODO remove a breakpoint
    } else {
      this._manager.addBreakpoint(
        SourceBreakpoint.create(uri, { line: lineNumber }));
    }
  }

  onStop(event: DebugProtocol.StoppedEvent) {

  }

  onContinue(event: DebugProtocol.ContinuedEvent) {

  }

  onTerminate(event: DebugProtocol.TerminatedEvent) {

  }
}
