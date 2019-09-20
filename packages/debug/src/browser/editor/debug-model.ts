import { URI, IDisposable, DisposableCollection, isOSX } from '@ali/ide-core-common';
import { Injector, Injectable, Autowired } from '@ali/common-di';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugBreakpointWidget, TopStackType } from './debug-breakpoint-widget';
import { SourceBreakpoint } from '../breakpoint/breakpoint-marker';
import { BreakpointManager } from '../breakpoint';
import { DebugEditor, IDebugSessionManager } from '../../common';
import { DebugHoverWidget, ShowDebugHoverOptions } from './debug-hover-widght';
import { DebugSession } from '../debug-session';

export const DebugModelFactory = Symbol('DebugModelFactory');
export type DebugModelFactory = (editor: DebugEditor) => DebugModel;

@Injectable()
export class DebugModel implements IDisposable {
  private isDebugging: boolean;
  protected readonly toDispose = new DisposableCollection();

  @Autowired(DebugEditor)
  readonly editor: DebugEditor;

  @Autowired(DebugBreakpointWidget)
  readonly breakpointWidget: DebugBreakpointWidget;

  @Autowired(DebugHoverWidget)
  readonly debugHoverWidget: DebugHoverWidget;

  @Autowired(IDebugSessionManager)
  private debugSessionManager: DebugSessionManager;

  @Autowired(BreakpointManager)
  private breakpointManager: BreakpointManager;

  static createContainer(injector: Injector, editor: DebugEditor): Injector {
    const child = injector.createChild({
      token: DebugEditor,
      useValue: editor,
    });
    child.addProviders({
      token: DebugHoverWidget,
      useClass: DebugHoverWidget,
    });
    child.addProviders({
      token: DebugBreakpointWidget,
      useClass: DebugBreakpointWidget,
    });
    child.addProviders({
      token: DebugModel,
      useClass: DebugModel,
    });
    return child;
  }
  static createModel(injector: Injector, editor: DebugEditor): DebugModel {
    return DebugModel.createContainer(injector, editor).get(DebugModel);
  }

  protected uri: URI;

  constructor() {
    this.init();
    this.isDebugging = false;
  }

  async init() {
    this.uri = new URI(this.editor.getModel()!.uri.toString());
    this.toDispose.pushAll([
      this.breakpointWidget,
    ]);
    this.events();
  }

  dispose() {
    this.toDispose.dispose();
  }

  get debugging() {
    return this.isDebugging;
  }

  isActivated(session: DebugSession) {
    const { currentFrame } = session;

    if (!currentFrame) {
      return false;
    }

    const { source } = currentFrame;

    if (!source) {
      return false;
    }

    const uri = source.uri;

    if (uri.isEqual(this.uri)) {
      return true;
    }

    return false;
  }

  isLastStopped() {
    const model = this.editor.getModel();

    if (!model) {
      return false;
    }

    const uri = model.uri;

    if (uri.toString() === this.uri.toString()) {
      return true;
    }

    return false;
  }

  protected hintBreakpoint(event) {
    const { type, position } = event.target;
    if (type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      if (position) {
        const { lineNumber } = position;
        this.breakpointWidget.updateHoverPlaceholder(lineNumber);
      }
    }
  }

  protected showHover(mouseEvent: monaco.editor.IEditorMouseEvent): void {
    const targetType = mouseEvent.target.type;
    const stopKey = isOSX ? 'metaKey' : 'ctrlKey';

    if (targetType === monaco.editor.MouseTargetType.CONTENT_WIDGET && mouseEvent.target.detail === this.debugHoverWidget.getId() && !(mouseEvent.event as any)[stopKey]) {
      return;
    }
    if (targetType === monaco.editor.MouseTargetType.CONTENT_TEXT) {
      this.debugHoverWidget.show({
        selection: mouseEvent.target.range,
        immediate: false,
      } as ShowDebugHoverOptions);
    } else {
      this.debugHoverWidget.hide({ immediate: false });
    }
  }

  protected hideHover({ event }: monaco.editor.IPartialEditorMouseEvent): void {
    const rect = this.debugHoverWidget.getDomNode().getBoundingClientRect();
    if (event.posx < rect.left || event.posx > rect.right || event.posy < rect.top || event.posy > rect.bottom) {
      this.debugHoverWidget.hide({ immediate: false });
    }
  }

  toggleBreakpoint(lineNumber: number) {
    const breakpoint = this.debugSessionManager.getBreakpoint(this.uri, lineNumber);

    this.breakpointWidget.toggleAddedPlaceholder(lineNumber);

    if (breakpoint) {
      breakpoint.remove();
    } else {
      this.breakpointManager.addBreakpoint(
        SourceBreakpoint.create(this.uri, { line: lineNumber }));
    }
  }

  private _getType(frame: any): TopStackType {
    if (frame.thread.stoppedDetails && frame.thread.stoppedDetails.reason === 'exception') {
      return TopStackType.exception;
    }
    return TopStackType.debugger;
  }

  hitBreakpoint() {
    const { currentFrame, topFrame } = this.debugSessionManager;

    if (!currentFrame || !topFrame) {
      throw new Error('Can not hit breakpoint without debug frame');
    }

    const { line } = topFrame.raw;

    const type = this._getType(topFrame);

    this.breakpointWidget.hitBreakpointPlaceHolder(line, type);
  }

  startDebug() {
    this.isDebugging = true;
    this.breakpointWidget.takeup();
  }

  stopDebug() {
    this.isDebugging = false;
    this.breakpointWidget.clearHitBreakpointPlaceHolder(true);
  }

  events() {
    if (!this.debugSessionManager) {
      return;
    }

    return this.debugSessionManager.onDidCreateDebugSession((session) => {
      session.on('stopped', () => {
        if (this.isActivated(session)) {
          this.startDebug();
        } else {
          this.stopDebug();
        }
      });
      session.on('exited', () => {
        this.stopDebug();

        if (this.isLastStopped()) {
          this.breakpointWidget.takeup();
        }
      });
      session.on('terminated', () => {
        this.stopDebug();

        if (this.isLastStopped()) {
          this.breakpointWidget.takeup();
        }
      });
    });
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
    this.showHover(event);
    this.hintBreakpoint(event);
  }

  onMouseLeave(event: monaco.editor.IPartialEditorMouseEvent) {
    this.hideHover(event);
  }

  onMouseUp(event: monaco.editor.IEditorMouseEvent) {
  }

  onShow() {
    this.breakpointWidget.takeup();
  }
}
