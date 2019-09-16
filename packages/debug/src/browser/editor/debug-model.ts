import { URI, Disposable } from '@ali/ide-core-common';
import { BreakpointManager } from '../breakpoint/breakpoint-manager';
import { SourceBreakpoint } from '../breakpoint/breakpoint-marker';
import { DebugHoverWidget } from './debug-hover-widget';

export class DebugModel extends Disposable {
  private _editor: monaco.editor.ICodeEditor;
  private _model: monaco.editor.ITextModel;
  private _hoverWidget: DebugHoverWidget;
  private _debugging: boolean;

  constructor(
    private _manager: BreakpointManager,
  ) {
    super();

    this._debugging = false;
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
  }

  onMouseDown(event: monaco.editor.IEditorMouseEvent) {
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
    if (event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      const { position } = event.target;
      if (position) {
        const { lineNumber } = position;
        this._hoverWidget.updateHoverPlaceholder(lineNumber);
      }
    } else {
      console.log(event.target);
    }
  }

  onMouseLeave(event: monaco.editor.IEditorMouseEvent) {
    if (!this._debugging) {
      return;
    }
  }

  startDebug() {
    this._debugging = true;
  }

  toggleBreakpoint(lineNumber: number) {
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

  hitBreakpoint(lineNumber: number) {
    this._hoverWidget.hitBreakpointPlaceHolder(lineNumber);
  }

  stopDebug() {
    this._debugging = false;
    this._hoverWidget.clearHitBreakpointPlaceHolder();
  }
}
