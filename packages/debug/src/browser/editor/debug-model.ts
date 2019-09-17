import { URI, Disposable } from '@ali/ide-core-common';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugBreakpointWidget, TopStackType } from './debug-breakpoint-widget';
import { SourceBreakpoint } from '../breakpoint/breakpoint-marker';
import debounce = require('lodash.debounce');

export class VaribalContentWidget implements monaco.editor.IContentWidget {
  private _node: HTMLDivElement;
  private _positoin: monaco.editor.IContentWidgetPosition;

  static singleton: VaribalContentWidget;
  static share() {
    if (!VaribalContentWidget.singleton) {
      VaribalContentWidget.singleton = new VaribalContentWidget();
    }
    return VaribalContentWidget.singleton;
  }

  constructor() {
    this._node = document.createElement('div');
  }

  getId() {
    return 'debug-varible-content-wdiget';
  }

  getDomNode() {
    return this._node;
  }

  setPosition(position: monaco.Position) {
    this._positoin = {
      position,
      preference: [
        monaco.editor.ContentWidgetPositionPreference.BELOW,
        monaco.editor.ContentWidgetPositionPreference.ABOVE,
      ],
    };
  }

  setContent(text: string) {
    this._node.innerHTML = `<p>${text}</p>`;
  }

  getPosition() {
    return this._positoin;
  }
}

export class DebugModel extends Disposable {
  private _editor: monaco.editor.ICodeEditor;
  private _model: monaco.editor.ITextModel;
  private _widget: DebugBreakpointWidget;
  private _hoverTimeout: number;
  private _debugging: boolean;

  constructor(private _manager: any, private _sessions: DebugSessionManager) {
    super();

    this._debugging = false;
  }

  attach(
    editor: monaco.editor.ICodeEditor,
    model: monaco.editor.ITextModel,
  ) {
    this._editor = editor;
    this._model = model;

    this._widget = new DebugBreakpointWidget(this._editor);

    this._editor.onMouseDown(debounce(this.onMouseDown.bind(this), 100));
    this._editor.onMouseMove(this.onMouseMove.bind(this));
    this._editor.onMouseLeave(this.onMouseLeave.bind(this));
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

    const { position } = event.target;

    if (event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      if (position) {
        const { lineNumber } = position;
        this._widget.updateHoverPlaceholder(lineNumber);
      }
    } else {
      if (position && this._debugging) {
        // @ts-ignore
        this._hoverTimeout = setTimeout(() => {
          const widget = VaribalContentWidget.share();
          widget.setPosition(position);
          widget.setContent(`debugging`);
          this._editor.addContentWidget(widget);
        }, 200);
      }
    }
  }

  onMouseLeave(event: monaco.editor.IEditorMouseEvent) {
    if (!this._checkOwner()) {
      return;
    }

    if (this._hoverTimeout) {
      clearTimeout(this._hoverTimeout);
    }
    this._editor.removeContentWidget(VaribalContentWidget.share());
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

  private _getType(frame: any): TopStackType {
    if (frame.thread.stoppedDetails && frame.thread.stoppedDetails.reason === 'exception') {
      return TopStackType.exception;
    }
    return TopStackType.debugger;
  }

  hitBreakpoint() {
    const { currentFrame, topFrame } = this._sessions;

    if (!currentFrame || !topFrame) {
      throw new Error('Can not hit breakpoint without debug frame');
    }

    const { line } = topFrame.raw;

    const type = this._getType(topFrame);

    this._widget.hitBreakpointPlaceHolder(line, type);
  }

  stopDebug() {
    this._debugging = false;
    this._editor.removeContentWidget(VaribalContentWidget.share());
    this._widget.clearHitBreakpointPlaceHolder();
  }

  events() {
    if (!this._sessions) {
      return;
    }

    this._sessions.onDidCreateDebugSession((session) => {
      session.on('stopped', () => {
        this._debugging = true;
      });
      session.on('exited', () => {
        this.stopDebug();
      });
      session.on('terminated', () => {
        this.stopDebug();
      });
    });
  }
}
