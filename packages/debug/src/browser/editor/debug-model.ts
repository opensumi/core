import { URI, IDisposable, DisposableCollection, isOSX } from '@ali/ide-core-common';
import { Injector, Injectable, Autowired } from '@ali/common-di';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugBreakpointWidget, TopStackType } from './debug-breakpoint-widget';
import { SourceBreakpoint } from '../breakpoint/breakpoint-marker';
import { BreakpointManager } from '../breakpoint';
import { DebugEditor, IDebugSessionManager } from '../../common';
import { DebugHoverWidget, ShowDebugHoverOptions } from './debug-hover-widght';
import debounce = require('lodash.debounce');
import * as options from './debug-styles';
import { DebugBreakpoint } from '../model';

export const DebugModelFactory = Symbol('DebugModelFactory');
export type DebugModelFactory = (editor: DebugEditor) => DebugModel;

@Injectable()
export class DebugModel implements IDisposable {
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

  protected frameDecorations: string[] = [];
  protected topFrameRange: monaco.Range | undefined;

  protected updatingDecorations = false;

  protected breakpointDecorations: string[] = [];
  protected breakpointRanges = new Map<string, monaco.Range>();

  protected currentBreakpointDecorations: string[] = [];

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
  }

  async init() {
    this.uri = new URI(this.editor.getModel()!.uri.toString());
    this.toDispose.pushAll([
      this.debugHoverWidget,
      this.breakpointWidget,
      this.editor.onKeyDown(() => this.debugHoverWidget.hide({ immediate: false })),
      this.debugSessionManager.onDidChange(() => this.renderFrames()),
    ]);
    this.renderFrames();
    this.render();
  }

  dispose() {
    this.toDispose.dispose();
  }

  protected _position: monaco.Position | undefined;

  get position(): monaco.Position {
    return this._position || this.editor.getPosition()!;
  }

  get breakpoint(): DebugBreakpoint | undefined {
    return this.getBreakpoint();
  }

  protected getBreakpoint(position: monaco.Position = this.position) {
    return this.debugSessionManager.getBreakpoint(this.uri, position.lineNumber);
  }

  /**
   * 渲染当前堆栈对应的装饰器
   *
   * @protected
   * @type {*}
   * @memberof DebugModel
   */
  protected readonly renderFrames: any = debounce(() => {
    const decorations = this.createFrameDecorations();
    this.frameDecorations = this.deltaDecorations(this.frameDecorations, decorations);
  }, 100);

  /**
   * 根据当前堆栈信息生成对应的编辑器装饰器描述
   */
  protected createFrameDecorations(): monaco.editor.IModelDeltaDecoration[] {
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    const { currentFrame, topFrame } = this.debugSessionManager;
    if (!currentFrame || !currentFrame.source || currentFrame.source.uri.toString() !== this.uri.toString()) {
      return decorations;
    }

    // tslint:disable-next-line:no-bitwise
    const columnUntilEOLRange = new monaco.Range(currentFrame.raw.line, currentFrame.raw.column, currentFrame.raw.line, 1 << 30);
    const range = new monaco.Range(currentFrame.raw.line, currentFrame.raw.column, currentFrame.raw.line, currentFrame.raw.column + 1);

    if (topFrame === currentFrame) {
      decorations.push({
        options: options.TOP_STACK_FRAME_MARGIN,
        range,
      });

      if (currentFrame.thread.stoppedDetails && currentFrame.thread.stoppedDetails.reason === 'exception') {
        decorations.push({
          options: options.TOP_STACK_FRAME_EXCEPTION_DECORATION,
          range: columnUntilEOLRange,
        });
      } else {
        decorations.push({
          options: options.TOP_STACK_FRAME_DECORATION,
          range: columnUntilEOLRange,
        });
        const { topFrameRange } = this;
        if (topFrameRange && topFrameRange.startLineNumber === currentFrame.raw.line && topFrameRange.startColumn !== currentFrame.raw.column) {
          decorations.push({
            options: options.TOP_STACK_FRAME_INLINE_DECORATION,
            range: columnUntilEOLRange,
          });
        }
        this.topFrameRange = columnUntilEOLRange;
      }
    } else {
      decorations.push({
        options: options.FOCUSED_STACK_FRAME_MARGIN,
        range,
      });
      decorations.push({
        options: options.FOCUSED_STACK_FRAME_DECORATION,
        range: columnUntilEOLRange,
      });
    }
    return decorations;
  }

  /**
   * 根据传入的装饰器修饰编辑器界面
   * @param oldDecorations
   * @param newDecorations
   */
  protected deltaDecorations(oldDecorations: string[], newDecorations: monaco.editor.IModelDeltaDecoration[]): string[] {
    this.updatingDecorations = true;
    try {
      return this.editor.deltaDecorations(oldDecorations, newDecorations);
    } finally {
      this.updatingDecorations = false;
    }
  }

  /**
   * 渲染断点信息装饰器
   * @memberof DebugModel
   */
  render(): void {
    this.renderBreakpoints();
    this.renderCurrentBreakpoints();
  }

  /**
   * 渲染所有断点
   * @protected
   * @memberof DebugModel
   */
  protected renderBreakpoints() {
    const decorations = this.createBreakpointDecorations();
    this.breakpointDecorations = this.deltaDecorations(this.breakpointDecorations, decorations);
    this.updateBreakpointRanges();
  }

  /**
   * 创建断点
   * @protected
   * @returns {SourceBreakpoint[]}
   * @memberof DebugModel
   */
  protected createBreakpoints(): SourceBreakpoint[] {
    const { uri } = this;
    const lines = new Set<number>();
    const breakpoints: SourceBreakpoint[] = [];
    for (const decoration of this.breakpointDecorations) {
      const range = this.editor.getModel()!.getDecorationRange(decoration);
      if (range && !lines.has(range.startLineNumber)) {
        const line = range.startLineNumber;
        const oldRange = this.breakpointRanges.get(decoration);
        const oldBreakpoint = oldRange && this.breakpointManager.getBreakpoint(uri, oldRange.startLineNumber);
        const breakpoint = SourceBreakpoint.create(uri, { line, column: 1 }, oldBreakpoint);
        breakpoints.push(breakpoint);
        lines.add(line);
      }
    }
    return breakpoints;
  }

  /**
   * 生成多个断点的装饰器数组
   * @protected
   * @returns {monaco.editor.IModelDeltaDecoration[]}
   * @memberof DebugModel
   */
  protected createBreakpointDecorations(): monaco.editor.IModelDeltaDecoration[] {
    const breakpoints = this.breakpointManager.getBreakpoints(this.uri);
    return breakpoints.map((breakpoint) => this.createBreakpointDecoration(breakpoint));
  }

  /**
   * 根据断点生成装饰器
   * @protected
   * @param {SourceBreakpoint} breakpoint
   * @returns {monaco.editor.IModelDeltaDecoration}
   * @memberof DebugModel
   */
  protected createBreakpointDecoration(breakpoint: SourceBreakpoint): monaco.editor.IModelDeltaDecoration {
    const lineNumber = breakpoint.raw.line;
    const range = new monaco.Range(lineNumber, 1, lineNumber, 2);
    return {
      range,
      options: {
        stickiness: options.STICKINESS,
      },
    };
  }

  /**
   * 渲染当前命中的断点装饰器
   * @protected
   * @memberof DebugModel
   */
  protected renderCurrentBreakpoints(): void {
    const decorations = this.createCurrentBreakpointDecorations();
    this.currentBreakpointDecorations = this.deltaDecorations(this.currentBreakpointDecorations, decorations);
  }

  /**
   * 渲染当前断点装饰器素组
   * @protected
   * @returns {monaco.editor.IModelDeltaDecoration[]}
   * @memberof DebugModel
   */
  protected createCurrentBreakpointDecorations(): monaco.editor.IModelDeltaDecoration[] {
    const breakpoints = this.debugSessionManager.getBreakpoints(this.uri);
    return breakpoints.map((breakpoint) => this.createCurrentBreakpointDecoration(breakpoint));
  }

  /**
   * 创建当前断点的装饰器
   * @protected
   * @param {DebugBreakpoint} breakpoint
   * @returns {monaco.editor.IModelDeltaDecoration}
   * @memberof DebugModel
   */
  protected createCurrentBreakpointDecoration(breakpoint: DebugBreakpoint): monaco.editor.IModelDeltaDecoration {
    const lineNumber = breakpoint.line;
    const range = new monaco.Range(lineNumber, 1, lineNumber, 1);
    const { className, message } = breakpoint.getDecoration();
    return {
      range,
      options: {
        glyphMarginClassName: className,
        glyphMarginHoverMessage: message.map((value) => ({ value })),
        stickiness: options.STICKINESS,
      },
    };
  }

  protected updateBreakpointRanges(): void {
    this.breakpointRanges.clear();
    for (const decoration of this.breakpointDecorations) {
      const range = this.editor.getModel()!.getDecorationRange(decoration) as monaco.Range;
      this.breakpointRanges.set(decoration, range);
    }
  }

  /**
   * 展示变量Hover面板
   * @protected
   * @param {monaco.editor.IEditorMouseEvent} mouseEvent
   * @returns {void}
   * @memberof DebugModel
   */
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

  /**
   * 隐藏变量Hover面板
   * @protected
   * @param {monaco.editor.IPartialEditorMouseEvent} { event }
   * @memberof DebugModel
   */
  protected hideHover({ event }: monaco.editor.IPartialEditorMouseEvent): void {
    const rect = this.debugHoverWidget.getDomNode().getBoundingClientRect();
    if (event.posx < rect.left || event.posx > rect.right || event.posy < rect.top || event.posy > rect.bottom) {
      this.debugHoverWidget.hide({ immediate: false });
    }
  }

  /**
   * 断点开关函数
   * @memberof DebugModel
   */
  toggleBreakpoint(): void {
    this.doToggleBreakpoint();
  }

  protected doToggleBreakpoint(position: monaco.Position = this.position) {
    const breakpoint = this.getBreakpoint(position);
    if (breakpoint) {
      breakpoint.remove();
    } else {
      this.breakpointManager.addBreakpoint(SourceBreakpoint.create(this.uri, {
        line: position.lineNumber,
        column: 1,
      }));
    }
  }

  protected onMouseDown(event: monaco.editor.IEditorMouseEvent): void {
    if (event.target && event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      if (event.event.rightButton) {
        // 缓存断点位置
        this._position = event.target.position!;
        // TODO: 处理右键菜单
      } else {
        this.doToggleBreakpoint(event.target.position!);
      }
    }
    this.hintBreakpoint(event);
  }

  protected onMouseMove(event: monaco.editor.IEditorMouseEvent): void {
    this.showHover(event);
    this.hintBreakpoint(event);
  }

  protected onMouseLeave(event: monaco.editor.IPartialEditorMouseEvent): void {
    this.hideHover(event);
    this.deltaHintDecorations([]);
  }

  protected hintDecorations: string[] = [];
  protected hintBreakpoint(event) {
    const hintDecorations = this.createHintDecorations(event);
    this.deltaHintDecorations(hintDecorations);
  }
  protected deltaHintDecorations(hintDecorations: monaco.editor.IModelDeltaDecoration[]): void {
    this.hintDecorations = this.deltaDecorations(this.hintDecorations, hintDecorations);
  }

  protected createHintDecorations(event: monaco.editor.IEditorMouseEvent): monaco.editor.IModelDeltaDecoration[] {
    if (event.target && event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      const lineNumber = event.target.position!.lineNumber;
      if (!!this.debugSessionManager.getBreakpoint(this.uri, lineNumber)) {
        return [];
      }
      return [{
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: options.BREAKPOINT_HINT_DECORATION,
      }];
    }
    return [];
  }
}
