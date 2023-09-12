import debounce from 'lodash/debounce';

import { Injector, Injectable, Autowired } from '@opensumi/di';
import { DomListener, IContextKeyService, IReporterService, PreferenceService } from '@opensumi/ide-core-browser';
import {
  ICtxMenuRenderer,
  generateMergedCtxMenu,
  IMenu,
  MenuId,
  AbstractMenuService,
} from '@opensumi/ide-core-browser/lib/menu/next';
import { URI, DisposableCollection, isOSX, memoize, Disposable, uuid } from '@opensumi/ide-core-common';
import { IThemeService, debugIconBreakpointForeground } from '@opensumi/ide-theme';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  IDebugModel,
  DEBUG_REPORT_NAME,
  ShowDebugHoverOptions,
  TSourceBrekpointProperties,
  DebugBreakpointWidgetContext,
  IDebugBreakpoint,
} from '../../common';
import { DebugEditor } from '../../common/debug-editor';
import { IDebugSessionManager } from '../../common/debug-session';
import { BreakpointManager } from '../breakpoint';
import { DebugBreakpoint, isDebugBreakpoint } from '../breakpoint';
import { DebugDecorator } from '../breakpoint/breakpoint-decoration';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugBreakpointsService } from '../view/breakpoints/debug-breakpoints.service';

import { DebugBreakpointWidget } from './debug-breakpoint-widget';
import { DebugHoverWidget } from './debug-hover-widget';
import * as options from './debug-styles';

@Injectable()
export class DebugModel implements IDebugModel {
  protected readonly toDispose = new DisposableCollection();

  @Autowired(DebugEditor)
  private readonly editor: DebugEditor;

  @Autowired(DebugBreakpointWidget)
  private readonly breakpointWidget: DebugBreakpointWidget;

  @Autowired(DebugHoverWidget)
  private readonly debugHoverWidget: DebugHoverWidget;

  @Autowired(IDebugSessionManager)
  private debugSessionManager: DebugSessionManager;

  @Autowired(DebugBreakpointsService)
  private debugBreakpointsService: DebugBreakpointsService;

  @Autowired(BreakpointManager)
  private breakpointManager: BreakpointManager;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(IReporterService)
  private readonly reporterService: IReporterService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IThemeService)
  public readonly themeService: IThemeService;

  protected frameDecorations: string[] = [];
  protected topFrameRange: monaco.Range | undefined;

  protected updatingDecorations = false;

  protected breakpointDecorations: string[] = [];
  protected breakpointRanges = new Map<string, monaco.Range>();

  protected currentBreakpointDecorations: {
    decorationId: string;
    inlineWidget?: InlineBreakpointWidget;
    breakpoint: IDebugBreakpoint;
  }[] = [];
  private candidateDecorations: { decorationId: string; inlineWidget: InlineBreakpointWidget }[] = [];

  static createContainer(injector: Injector, editor: DebugEditor): Injector {
    const child = injector.createChild([
      {
        token: DebugEditor,
        useValue: editor,
      },
      {
        token: DebugHoverWidget,
        useClass: DebugHoverWidget,
      },
      {
        token: DebugBreakpointWidget,
        useClass: DebugBreakpointWidget,
      },
      {
        token: IDebugModel,
        useClass: DebugModel,
      },
    ]);
    return child;
  }
  static createModel(injector: Injector, editor: DebugEditor): IDebugModel {
    return DebugModel.createContainer(injector, editor).get(IDebugModel);
  }

  private _uri: URI;
  public get uri(): URI {
    return this._uri;
  }

  protected decorator: DebugDecorator;

  constructor() {
    this.init();
  }

  async init() {
    const model = this.editor.getModel()!;
    let timer: number | undefined;
    this._uri = new URI(model.uri.toString());
    this.decorator = new DebugDecorator();

    this.toDispose.pushAll([
      this.breakpointWidget,
      this.editor.onKeyDown(() => this.debugHoverWidget.hide({ immediate: false })),
      this.editor.onDidChangeModelContent(() => this.renderFrames()),
      this.debugSessionManager.onDidChange(() => this.renderFrames()),
      this.debugBreakpointsService.onDidFocusedBreakpoints(({ range }) => {
        const enableHint = this.preferenceService.getValid('debug.breakpoint.editorHint', true);

        if (!enableHint) {
          return;
        }

        this.renderFrames([
          {
            options: options.FOCUS_BREAKPOINTS_STACK_FRAME_DECORATION,
            range,
          },
        ]);

        if (timer) {
          clearTimeout(timer);
        }

        timer = window.setTimeout(() => {
          this.renderFrames();
          clearTimeout(timer);
        }, 300);
      }),
      this.editor.getModel()!.onDidChangeContent(() => this.updateBreakpoints()),
      this.editor.onDidChangeModel(() => {
        this.closeBreakpointView();
      }),
    ]);
    this.renderFrames();
    this.render();
  }

  dispose() {
    this.toDispose.dispose();
  }

  private _position: monaco.Position | undefined;

  get position(): monaco.Position {
    return this._position || this.editor.getPosition()!;
  }

  get breakpoint(): IDebugBreakpoint | undefined {
    return this.getBreakpoint();
  }

  protected getBreakpoint(position?: monaco.Position) {
    return this.breakpointManager.getBreakpoint(this._uri, position ? position.lineNumber : undefined);
  }

  /**
   * 渲染当前堆栈对应的装饰器
   *
   * @protected
   * @type {*}
   * @memberof DebugModel
   */
  protected readonly renderFrames: any = debounce((inflowDecorations: monaco.editor.IModelDeltaDecoration[] = []) => {
    if (this.toDispose.disposed) {
      return;
    }
    if (this.editor.getModel()?.uri.toString() !== this._uri.toString()) {
      return;
    }
    const decorations = this.createFrameDecorations().concat(inflowDecorations);
    this.frameDecorations = this.deltaDecorations(this.frameDecorations, decorations);
  }, 100);

  /**
   * 根据当前堆栈信息生成对应的编辑器装饰器描述
   */
  protected createFrameDecorations(): monaco.editor.IModelDeltaDecoration[] {
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    const { currentFrame, topFrame } = this.debugSessionManager;
    if (
      !currentFrame ||
      !currentFrame.source ||
      currentFrame.source.uri.toString() !== this.editor.getModel()?.uri.toString()
    ) {
      return decorations;
    }

    const columnUntilEOLRange = new monaco.Range(
      currentFrame.raw.line,
      currentFrame.raw.column,
      currentFrame.raw.line,
      1 << 30,
    );
    const range = new monaco.Range(
      currentFrame.raw.line,
      currentFrame.raw.column,
      currentFrame.raw.line,
      currentFrame.raw.column + 1,
    );

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
        if (
          topFrameRange &&
          topFrameRange.startLineNumber === currentFrame.raw.line &&
          topFrameRange.startColumn !== currentFrame.raw.column
        ) {
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
  protected deltaDecorations(
    oldDecorations: string[],
    newDecorations: monaco.editor.IModelDeltaDecoration[],
  ): string[] {
    this.updatingDecorations = true;
    try {
      return this.editor.deltaDecorations(oldDecorations, newDecorations);
    } finally {
      this.updatingDecorations = false;
    }
  }

  /**
   * 装饰堆栈文件
   * @param {DebugStackFrame} frame
   * @memberof DebugModel
   */
  focusStackFrame() {
    this.renderFrames();
  }

  async render() {
    await this.renderBreakpoints();
    this.renderFrames();
  }

  /**
   * 渲染断点信息装饰器
   * @memberof DebugModel
   */
  async renderBreakpoints() {
    await this.breakpointManager.whenReady;
    this.renderNormalBreakpoints();
    this.renderCurrentBreakpoints();
  }

  /**
   * 渲染所有断点
   * @protected
   * @memberof DebugModel
   */
  protected renderNormalBreakpoints() {
    const decorations = this.createBreakpointDecorations();
    this.breakpointDecorations = this.deltaDecorations(this.breakpointDecorations, decorations);
    this.updateBreakpointRanges();
  }

  protected updateBreakpoints(): void {
    if (this.areBreakpointsAffected()) {
      const breakpoints = this.createBreakpoints();
      this.breakpointManager.setBreakpoints(this._uri, breakpoints);
    }
  }

  protected areBreakpointsAffected(): boolean {
    if (this.updatingDecorations || !this.editor.getModel()) {
      return false;
    }
    for (const decoration of this.breakpointDecorations) {
      const range = this.editor.getModel()!.getDecorationRange(decoration);
      const oldRange = this.breakpointRanges.get(decoration)!;
      if (!range || !range.equalsRange(oldRange)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 创建断点
   * @protected
   * @returns {DebugBreakpoint[]}
   * @memberof DebugModel
   */
  protected createBreakpoints(): IDebugBreakpoint[] {
    const { _uri: uri } = this;
    const lines = new Set<number>();
    const breakpoints: IDebugBreakpoint[] = [];
    for (const decoration of this.breakpointDecorations) {
      const range = this.editor.getModel()!.getDecorationRange(decoration);
      if (range && !lines.has(range.startLineNumber)) {
        const line = range.startLineNumber;
        const oldRange = this.breakpointRanges.get(decoration);
        const oldBreakpoint =
          (oldRange && this.breakpointManager.getBreakpoint(uri, oldRange.startLineNumber)) || ({} as any);
        const breakpoint = DebugBreakpoint.create(uri, { ...(oldBreakpoint.raw || {}), line }, oldBreakpoint.enabled);
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
    const breakpoints = this.breakpointManager.getBreakpoints(this._uri);
    return breakpoints.map((breakpoint) => this.createBreakpointDecoration(breakpoint));
  }

  /**
   * 根据断点生成装饰器
   * @protected
   * @param {DebugBreakpoint} breakpoint
   * @returns {monaco.editor.IModelDeltaDecoration}
   * @memberof DebugModel
   */
  protected createBreakpointDecoration(breakpoint: IDebugBreakpoint): monaco.editor.IModelDeltaDecoration {
    const lineNumber = breakpoint.raw.line;
    const column = breakpoint.raw.column || 0;
    const range = new monaco.Range(lineNumber, column, lineNumber, column + 1);
    return {
      range,
      options: {
        description: 'breakpoint-decoration',
        stickiness: options.STICKINESS,
      },
    };
  }

  /**
   * 渲染当前命中的断点装饰器
   * @protected
   * @memberof DebugModel
   */
  protected async renderCurrentBreakpoints(): Promise<void> {
    const breakpoints = this.breakpointManager.getBreakpoints(this._uri);
    const decorations = this.createCurrentBreakpointDecorations();
    const decorationIds = this.deltaDecorations(
      this.currentBreakpointDecorations.map(({ decorationId }) => decorationId),
      decorations,
    );
    this.currentBreakpointDecorations.forEach((item) => {
      if (item.inlineWidget) {
        item.inlineWidget.dispose();
      }
    });
    this.currentBreakpointDecorations = decorationIds.map((decorationId, index) => {
      const decoration = decorations[index];
      const breakpoint = breakpoints[index];
      const icon = (breakpoint.enabled ? options.BREAKPOINT_DECORATION : options.BREAKPOINT_DECORATION_DISABLED)
        .glyphMarginClassName;
      const inlineWidget = decoration.options.beforeContentClassName
        ? new InlineBreakpointWidget(this.editor, decorationId, icon, breakpoint, this.breakpointManager)
        : undefined;
      return {
        breakpoint,
        decorationId,
        inlineWidget,
      };
    });
    const desiredCandidateDecorations = await this.getCandidateBreakpoints(breakpoints);
    const candidateDecorationIds = this.deltaDecorations(
      this.candidateDecorations.map(({ decorationId }) => decorationId),
      desiredCandidateDecorations,
    );
    this.candidateDecorations.forEach((candidate) => {
      candidate.inlineWidget.dispose();
    });
    this.candidateDecorations = candidateDecorationIds.map((decorationId, index) => {
      const { breakpoint } = desiredCandidateDecorations[index];
      const icon = (breakpoint ? options.BREAKPOINT_DECORATION : options.BREAKPOINT_DECORATION_DISABLED)
        .glyphMarginClassName;
      const inlineWidget = new InlineBreakpointWidget(
        this.editor,
        decorationId,
        icon,
        breakpoint,
        this.breakpointManager,
      );
      return {
        decorationId,
        inlineWidget,
      };
    });
  }

  private async getCandidateBreakpoints(breakpoints: IDebugBreakpoint[]): Promise<
    {
      range: monaco.Range;
      options: monaco.editor.IModelDecorationOptions;
      breakpoint?: IDebugBreakpoint | undefined;
    }[]
  > {
    const model = this.editor.getModel();
    const session = this.debugSessionManager.currentSession;
    if (!model || !session?.capabilities.supportsBreakpointLocationsRequest) {
      return [];
    }
    const lineNumbers = Array.from(new Set(breakpoints.map((item) => item.raw.line)));
    const result: {
      range: monaco.Range;
      options: monaco.editor.IModelDecorationOptions;
      breakpoint?: IDebugBreakpoint;
    }[] = [];
    await Promise.all(
      lineNumbers.map(async (lineNumber) => {
        const positions = await session.breakpointLocations(this._uri, lineNumber);
        if (positions.length <= 1) {
          return;
        }
        const maxLineCount = model.getLineCount();
        if (lineNumber > maxLineCount) {
          return;
        }
        const firstColumn = model.getLineFirstNonWhitespaceColumn(lineNumber);
        const lastColumn = model.getLineLastNonWhitespaceColumn(lineNumber);
        positions.forEach((p) => {
          const range = new monaco.Range(p.lineNumber, p.column, p.lineNumber, p.column + 1);
          if (p.column <= firstColumn || p.column > lastColumn) {
            return;
          }
          const breakpointAtPosition = this.currentBreakpointDecorations.find(
            ({ breakpoint }) =>
              breakpoint.raw.line === range.startLineNumber && breakpoint.raw.column === range.startColumn,
          );
          if (breakpointAtPosition?.inlineWidget) {
            // Space already occupied, do not render candidate.
            return;
          }
          result.push({
            range,
            options: {
              description: 'debug-breakpoint-placeholder',
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              beforeContentClassName: breakpointAtPosition ? undefined : 'debug-breakpoint-placeholder',
            },
            breakpoint: breakpointAtPosition?.breakpoint,
          });
        });
      }),
    );
    return result;
  }

  /**
   * 渲染当前断点装饰器数组
   * @protected
   * @returns {monaco.editor.IModelDeltaDecoration[]}
   * @memberof DebugModel
   */
  protected createCurrentBreakpointDecorations(): monaco.editor.IModelDeltaDecoration[] {
    const breakpoints = this.breakpointManager.getBreakpoints(this._uri);
    return breakpoints
      .filter((breakpoint) => isDebugBreakpoint(breakpoint))
      .map((breakpoint) => this.createCurrentBreakpointDecoration(breakpoint));
  }

  /**
   * 创建当前断点的装饰器
   * @protected
   * @param {DebugBreakpoint} breakpoint
   * @returns {monaco.editor.IModelDeltaDecoration}
   * @memberof DebugModel
   */
  protected createCurrentBreakpointDecoration(breakpoint: IDebugBreakpoint): monaco.editor.IModelDeltaDecoration {
    const session = this.debugSessionManager.currentSession;
    const status = breakpoint.status.get((session && session.id) || '');
    const lineNumber = status && status.line ? status.line : breakpoint.raw.line;
    const column = breakpoint.raw.column || 0;
    const model = this.editor.getModel()!;
    const maxLine = model.getLineCount();
    const renderInline = lineNumber > maxLine ? false : column > model.getLineFirstNonWhitespaceColumn(lineNumber);
    const range = new monaco.Range(lineNumber, column, lineNumber, column + 1);
    const { className, message } = this.decorator.getDecoration(
      breakpoint,
      !!session,
      this.breakpointManager.breakpointsEnabled,
    );
    const showBreakpointsInOverviewRuler = this.preferenceService.getValid(
      'debug.breakpoint.showBreakpointsInOverviewRuler',
      false,
    );

    let overviewRulerDecoration: monaco.editor.IModelDecorationOverviewRulerOptions | null = null;
    if (showBreakpointsInOverviewRuler) {
      overviewRulerDecoration = {
        color: this.themeService.getColor({
          id: debugIconBreakpointForeground,
        }),
        position: monaco.editor.OverviewRulerLane.Left,
      } as monaco.editor.IModelDecorationOverviewRulerOptions;
    }

    return {
      range,
      options: {
        description: 'debug-breakpoint-placeholder',
        glyphMarginClassName: className,
        glyphMarginHoverMessage: message.map((value) => ({ value })),
        stickiness: options.STICKINESS,
        beforeContentClassName: renderInline ? 'debug-breakpoint-placeholder' : undefined,
        overviewRuler: overviewRulerDecoration,
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
    const isAlt = mouseEvent.event.altKey;

    if (isAlt) {
      return;
    }

    if (
      targetType === monaco.editor.MouseTargetType.CONTENT_WIDGET &&
      mouseEvent.target.detail === this.debugHoverWidget.getId() &&
      !(mouseEvent.event as any)[stopKey]
    ) {
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
  toggleBreakpoint = (position: monaco.Position = this.position) => {
    this.doToggleBreakpoint(position);
  };

  protected doToggleBreakpoint(position: monaco.Position = this.position) {
    const breakpoints = this.breakpointManager.getBreakpoints(this._uri, { lineNumber: position.lineNumber });
    if (breakpoints.length) {
      for (const breakpoint of breakpoints) {
        this.breakpointManager.delBreakpoint(breakpoint);
      }
    } else {
      this.breakpointManager.addBreakpoint(
        DebugBreakpoint.create(this._uri, {
          line: position.lineNumber,
        }),
      );
    }
  }

  @memoize get contributedContextMenu(): IMenu {
    const contributedContextMenu = this.menuService.createMenu(MenuId.DebugBreakpointsContext, this.contextKeyService);
    return contributedContextMenu;
  }

  openBreakpointView = (
    position: monaco.Position,
    context?: DebugBreakpointWidgetContext,
    defaultContext?: TSourceBrekpointProperties,
  ) => {
    this.breakpointWidget.show(position, context, defaultContext);
  };

  closeBreakpointView = () => {
    this.breakpointWidget.hide();
  };

  acceptBreakpoint = () => {
    const { position, values } = this.breakpointWidget;
    this.reporterService.point(DEBUG_REPORT_NAME?.DEBUG_BREAKPOINT, this.breakpointWidget.breakpointType);
    if (position && values) {
      const breakpoint = this.getBreakpoint(position);
      if (breakpoint) {
        breakpoint.raw.condition = values.condition;
        breakpoint.raw.hitCondition = values.hitCondition;
        breakpoint.raw.logMessage = values.logMessage;
        this.breakpointManager.updateBreakpoint(breakpoint);
      } else {
        this.breakpointManager.addBreakpoint(
          DebugBreakpoint.create(this._uri, {
            line: position.lineNumber,
            ...values,
          }),
        );
      }
      this.breakpointWidget.hide();
    }
  };

  public onContextMenu(event: monaco.editor.IEditorMouseEvent) {
    if (!this.marginFreeFromNonDebugDecorations(event.target.position?.lineNumber!)) {
      return;
    }

    if (event.target && event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      // 设置当前右键选中的断点
      const breakpoint = this.breakpointManager.getBreakpoint(this._uri, event.target.position!.lineNumber);
      this.breakpointManager.selectedBreakpoint = {
        breakpoint,
        model: this,
      };
      // 获取右键菜单
      const menus = this.contributedContextMenu;
      const menuNodes = generateMergedCtxMenu({ menus });
      this.ctxMenuRenderer.show({
        anchor: event.event.browserEvent,
        menuNodes,
        args: [event.target.position!],
      });
    }
  }

  // 不含非 debug 相关的 Decorations
  private marginFreeFromNonDebugDecorations(line: number): boolean {
    const decoration = this.editor.getLineDecorations(line);
    if (Array.isArray(decoration)) {
      for (const { options } of decoration) {
        const gcln = options.glyphMarginClassName;
        if (gcln && gcln.includes('testing-run-glyph')) {
          return false;
        }
      }
    }

    return true;
  }

  public onMouseDown(event: monaco.editor.IEditorMouseEvent): void {
    if (!this.marginFreeFromNonDebugDecorations(event.target.position?.lineNumber!)) {
      return;
    }

    if (event.target && event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
      if (!event.event.rightButton) {
        // 保证在DebugModelManager中准确获取当前焦点的编辑器
        this.editor.focus();
        this.toggleBreakpoint(event.target.position!);
      }
    }
    this.hintBreakpoint(event);
  }

  public onMouseMove(event: monaco.editor.IEditorMouseEvent): void {
    if (!this.marginFreeFromNonDebugDecorations(event.target.position?.lineNumber!)) {
      this.onMouseLeave(event);
      return;
    }

    this.showHover(event);
    this.hintBreakpoint(event);
  }

  public onMouseLeave(event: monaco.editor.IPartialEditorMouseEvent): void {
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
    if (
      (event.target && event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) ||
      event.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
    ) {
      const lineNumber = event.target.position!.lineNumber;
      if (this.breakpointManager.getBreakpoint(this._uri, lineNumber)) {
        return [];
      }
      return [
        {
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: options.BREAKPOINT_HINT_DECORATION,
        },
      ];
    }
    return [];
  }

  public getBreakpoints(uri?: URI | undefined, filter?: Partial<monaco.IPosition> | undefined): IDebugBreakpoint[] {
    return this.breakpointManager.getBreakpoints(uri, filter);
  }

  public getEditor(): DebugEditor {
    return this.editor;
  }

  public getBreakpointWidget(): DebugBreakpointWidget {
    return this.breakpointWidget;
  }

  public getDebugHoverWidget(): DebugHoverWidget {
    return this.debugHoverWidget;
  }
}

class InlineBreakpointWidget extends Disposable implements monaco.editor.IContentWidget {
  allowEditorOverflow = false;
  suppressMouseDown = true;

  private range: monaco.Range | null;
  private domNode: HTMLElement;

  constructor(
    private readonly editor: DebugEditor,
    private readonly decorationId: string,
    cssClass: string | null | undefined,
    private readonly breakpoint: IDebugBreakpoint | undefined,
    private readonly breakpointManager: BreakpointManager,
  ) {
    super();
    this.range = this.editor.getModel()!.getDecorationRange(decorationId);
    this.addDispose(
      this.editor.onDidChangeModelDecorations(() => {
        const model = this.editor.getModel()!;
        const range = model.getDecorationRange(this.decorationId);
        if (this.range && !this.range.equalsRange(range)) {
          this.range = range;
          this.editor.layoutContentWidget(this);
        }
      }),
    );
    this.addDispose(
      Disposable.create(() => {
        this.editor.removeContentWidget(this);
      }),
    );
    this.create(cssClass);

    this.editor.addContentWidget(this);
    this.editor.layoutContentWidget(this);
  }

  private create(cssClass: string | null | undefined) {
    const domNode = document.createElement('div');
    domNode.className = 'inline-breakpoint-widget';
    if (cssClass) {
      domNode.classList.add(...cssClass.split(' '));
    }
    this.domNode = domNode;

    const { EditorOption } = monaco.editor;

    const updateSize = () => {
      const lineHeight = this.editor.getOption(EditorOption.lineHeight);
      domNode.style.height = `${lineHeight}px`;
      domNode.style.width = `${Math.ceil(0.8 * lineHeight)}px`;
      domNode.style.marginLeft = '4px';
    };
    updateSize();

    this.addDispose(
      new DomListener(domNode, 'click', async () => {
        const uri = new URI(this.editor.getModel()!.uri);
        if (this.breakpoint) {
          this.breakpointManager.delBreakpoint(this.breakpoint);
        } else {
          this.breakpointManager.addBreakpoint(
            DebugBreakpoint.create(uri, {
              line: this.range!.startLineNumber,
              column: this.range!.startColumn,
            }),
          );
        }
      }),
    );
    this.addDispose(
      this.editor.onDidChangeConfiguration((c) => {
        if (c.hasChanged(EditorOption.fontSize) || c.hasChanged(EditorOption.lineHeight)) {
          updateSize();
        }
      }),
    );
  }

  @memoize
  getId() {
    return uuid();
  }

  getDomNode(): HTMLElement {
    return this.domNode;
  }

  getPosition(): monaco.editor.IContentWidgetPosition | null {
    if (!this.range) {
      return null;
    }
    // Workaround: since the content widget can not be placed before the first column we need to force the left position
    this.domNode.classList.toggle('line-start', this.range.startColumn === 1);

    return {
      position: { lineNumber: this.range.startLineNumber, column: this.range.startColumn - 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
    };
  }
}
