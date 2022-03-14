import { DomListener } from '@opensumi/ide-core-browser';
import { Disposable, IDisposable, Event, Emitter, IRange, uuid } from '@opensumi/ide-core-common';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import {
  Sash,
  IHorizontalSashLayoutProvider,
  Orientation,
  SashState,
  ISashEvent,
} from '@opensumi/monaco-editor-core/esm/vs/base/browser/ui/sash/sash';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

export class ViewZoneDelegate implements monaco.editor.IViewZone {
  public domNode: HTMLElement;
  public id: string = uuid(); // A valid zone id should be greater than 0
  public afterLineNumber: number;
  public afterColumn: number;
  public heightInLines: number;

  private readonly _onDomNodeTop: (top: number) => void;
  private readonly _onComputedHeight: (height: number) => void;

  constructor(
    domNode: HTMLElement,
    afterLineNumber: number,
    afterColumn: number,
    heightInLines: number,
    onDomNodeTop: (top: number) => void,
    onComputedHeight: (height: number) => void,
  ) {
    this.domNode = domNode;
    this.afterLineNumber = afterLineNumber;
    this.afterColumn = afterColumn;
    this.heightInLines = heightInLines;
    this._onDomNodeTop = onDomNodeTop;
    this._onComputedHeight = onComputedHeight;
  }

  public onDomNodeTop(top: number): void {
    this._onDomNodeTop(top);
  }

  public onComputedHeight(height: number): void {
    this._onComputedHeight(height);
  }
}

export class OverlayWidgetDelegate extends Disposable implements monaco.editor.IOverlayWidget {
  static id = 'monaco-enhance-overlay-widget';

  constructor(readonly id: string, readonly dom: HTMLDivElement) {
    super();
  }

  getPosition() {
    return null;
  }

  getDomNode() {
    return this.dom;
  }

  getId() {
    return this.id;
  }
}

export interface IOptions {
  isResizeable?: boolean;
}

/**
 * 构造函数负责 dom 结构，
 * show 负责 class 注入，
 * render 负责 style 动态注入，
 * dispose 负责回收。
 */
export abstract class ZoneWidget extends Disposable implements IHorizontalSashLayoutProvider {
  protected _container: HTMLDivElement;
  // 宽度和左定位不需要继承下去，完全交给父容器控制
  private width = 0;
  private left = 0;
  private _overlay: OverlayWidgetDelegate | null;
  private _viewZone: ViewZoneDelegate | null;
  private _current: monaco.IRange;
  private _linesCount: number;
  private _resizeSash: Sash | null = null;

  private _onDomNodeTop = new Emitter<number>();
  protected onDomNodeTop = this._onDomNodeTop.event;

  constructor(protected readonly editor: IMonacoCodeEditor, readonly options?: IOptions) {
    super();
    this._container = document.createElement('div');
    this._listenEvents();
  }

  protected abstract applyClass(): void;
  protected abstract applyStyle(): void;
  protected abstract _fillContainer(container: HTMLElement): void;

  private _showImpl(where: monaco.IRange, heightInLines: number) {
    const { startLineNumber: lineNumber, startColumn: column } = where;
    const viewZoneDomNode = document.createElement('div');
    const layoutInfo = this.editor.getLayoutInfo();
    viewZoneDomNode.style.overflow = 'hidden';

    this.editor.changeViewZones((accessor) => {
      if (this._viewZone) {
        accessor.removeZone(this._viewZone.id);
        this._viewZone = null;
      }
      if (this._overlay) {
        this.editor.removeOverlayWidget(this._overlay);
        this._overlay = null;
      }
      this._container.style.top = '-1000px';
      this._viewZone = new ViewZoneDelegate(
        viewZoneDomNode,
        lineNumber,
        column,
        heightInLines,
        (top: number) => this._onViewZoneTop(top),
        (height: number) => this._onViewZoneHeight(height),
      );
      this._viewZone.id = accessor.addZone(this._viewZone);
      this._overlay = new OverlayWidgetDelegate(OverlayWidgetDelegate.id + this._viewZone.id, this._container);
      this.editor.addOverlayWidget(this._overlay);
    });

    this.layout(layoutInfo);
  }

  get currentRange() {
    return this._current;
  }

  get currentHeightInLines() {
    return this._linesCount;
  }

  show(where: monaco.IRange, heightInLines: number) {
    this._current = where;
    this._linesCount = heightInLines;
    this.applyClass();
    this._showImpl(where, heightInLines);
  }

  hide() {}

  create(): void {
    this._fillContainer(this._container);
    this._initSash();
    this.applyStyle();
  }

  private _getLeft(info: monaco.editor.EditorLayoutInfo): number {
    if (info.minimap && info.minimap.minimapWidth > 0 && info.minimap.minimapLeft === 0) {
      return info.minimap.minimapWidth;
    }
    return 0;
  }

  private _getWidth(info: monaco.editor.EditorLayoutInfo): number {
    const minimapWidth = info.minimap ? info.minimap.minimapWidth : 0;
    return info.width - minimapWidth - info.verticalScrollbarWidth;
  }

  protected _onViewZoneTop(top: number): void {
    this._container.style.top = `${top}px`;
    this._onDomNodeTop.fire(top);
  }

  protected _onViewZoneHeight(height: number): void {
    this._container.style.height = `${height}px`;

    if (this._resizeSash) {
      this._resizeSash.layout();
    }
  }

  protected setCssClass(className: string, classToReplace?: string): void {
    if (!this._container) {
      return;
    }

    if (classToReplace) {
      this._container.classList.remove(classToReplace);
    }

    this._container.classList.add(className);
  }

  layout(layoutInfo: monaco.editor.EditorLayoutInfo) {
    this.left = this._getLeft(layoutInfo);
    this.width = this._getWidth(layoutInfo);
    this.render();
  }

  render() {
    this._container.style.width = `${this.width}px`;
    this._container.style.left = `${this.left}px`;

    this.applyStyle();
  }

  protected _relayout(newHeightInLines: number): void {
    if (this._viewZone && this._viewZone.heightInLines !== newHeightInLines) {
      this.editor.changeViewZones((accessor) => {
        if (this._viewZone) {
          this._viewZone.heightInLines = newHeightInLines;
          accessor.layoutZone(this._viewZone.id);
        }
      });
    }
  }

  private _listenEvents() {
    this.editor.onDidLayoutChange((event) => {
      this.layout(event);
    });
  }

  private _initSash(): void {
    if (this._resizeSash) {
      return;
    }
    this._resizeSash = new Sash(this._container, this, { orientation: Orientation.HORIZONTAL });
    this.addDispose(this._resizeSash);

    if (!this.options!.isResizeable) {
      this._resizeSash.hide();
      this._resizeSash.state = SashState.Disabled;
    }

    let data: { startY: number; heightInLines: number } | undefined;
    this.addDispose(
      this._resizeSash.onDidStart((e: ISashEvent) => {
        if (this._viewZone) {
          data = {
            startY: e.startY,
            heightInLines: this._viewZone.heightInLines,
          };
        }
      }),
    );

    this.addDispose(
      this._resizeSash.onDidEnd(() => {
        data = undefined;
      }),
    );

    this.addDispose(
      this._resizeSash.onDidChange((evt: ISashEvent) => {
        if (data) {
          const lineDelta = (evt.currentY - data.startY) / this.editor.getOption(EditorOption.lineHeight);
          const roundedLineDelta = lineDelta < 0 ? Math.ceil(lineDelta) : Math.floor(lineDelta);
          const newHeightInLines = data.heightInLines + roundedLineDelta;

          if (newHeightInLines > 5 && newHeightInLines < 35) {
            this._relayout(newHeightInLines);
          }
        }
      }),
    );
  }

  getHorizontalSashLeft() {
    return 0;
  }

  getHorizontalSashTop(): number {
    return this._container.style.height === null ? 0 : parseInt(this._container.style.height, 10);
  }

  dispose() {
    if (this._viewZone) {
      this.editor.changeViewZones((accessor) => {
        if (this._viewZone) {
          accessor.removeZone(this._viewZone.id);
          this._viewZone = null;
        }
      });
    }
    if (this._overlay) {
      this.editor.removeOverlayWidget(this._overlay);
      this._overlay = null;
    }
    this._container.remove();
    super.dispose();
  }
}

/**
 * 可以自适应高度的 ZoneWidget
 */
export abstract class ResizeZoneWidget extends ZoneWidget {
  private preWrapperHeight: number;
  private heightInLines: number;
  private lineHeight: number;
  private wrap: HTMLDivElement;
  protected readonly _onChangeZoneWidget = new Emitter<IRange>();
  public readonly onChangeZoneWidget: Event<IRange> = this._onChangeZoneWidget.event;
  public onFirstDisplay = Event.once(this.onDomNodeTop);
  protected _isShow = false;

  constructor(protected readonly editor: IMonacoCodeEditor, private range: monaco.IRange) {
    super(editor);
    this.lineHeight = this.editor.getOption(monaco.editor.EditorOption.lineHeight);
    this.addDispose(
      this.editor.onDidChangeConfiguration((e) => {
        if (e.hasChanged(monaco.editor.EditorOption.lineHeight)) {
          this.lineHeight = this.editor.getOption(monaco.editor.EditorOption.lineHeight);
          if (this.wrap) {
            this.resizeZoneWidget();
          }
        }
      }),
    );
    // 在第一次设置 container top 值的时候重置一下高度
    Event.once(this.onDomNodeTop)(() => {
      // 等待渲染帧以便获取到真实 warp 高度
      window.requestAnimationFrame(() => {
        this.resizeZoneWidget();
      });
    });
  }

  protected observeContainer(dom: HTMLDivElement): IDisposable {
    this.wrap = dom;
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          for (const child of Array.from(mutation.target.childNodes) as HTMLElement[]) {
            // child 必须是 element 元素
            if (child.nodeType === Node.ELEMENT_NODE && child.querySelectorAll) {
              // 处理图片加载的情况
              const images = child.querySelectorAll('img');
              if (images.length) {
                images.forEach((image) => {
                  const disposer = new DomListener(image, 'load', () => {
                    this.resizeZoneWidget();
                    disposer.dispose();
                  });
                  this.addDispose(disposer);
                });
              }
            }
          }
        }
      });
      this.resizeZoneWidget();
    });
    mutationObserver.observe(this.wrap, { childList: true, subtree: true });
    return {
      dispose() {
        mutationObserver.disconnect();
      },
    };
  }

  protected resizeZoneWidget() {
    let wrapperHeight = this.wrap.offsetHeight;
    // 可能在设置页设置的时候 editor 不可见，获取的高度为 0
    if (!wrapperHeight && this.preWrapperHeight) {
      wrapperHeight = this.preWrapperHeight;
    }
    if (wrapperHeight) {
      const heightInLines = wrapperHeight / this.lineHeight;
      if (this._isShow && this.heightInLines !== heightInLines) {
        this.heightInLines = heightInLines;
        this.show();
        this.preWrapperHeight = wrapperHeight;
      }
    }
  }

  public show() {
    const needResize = !this.wrap.offsetHeight && !this.preWrapperHeight;
    this.resize();
    this.fireChangeEvent();
    // 如果默认为隐藏，打开后是没有 this.heightInLines 的，需要显示后再计算一下
    if (needResize) {
      this.resizeZoneWidget();
    }
  }

  private fireChangeEvent() {
    this._onChangeZoneWidget.fire(this.range);
  }

  public resize() {
    const activeElement = document.activeElement as HTMLElement;
    super.show(this.range, this.heightInLines);
    // reset focus on the previously active element.
    activeElement?.focus({ preventScroll: true });
  }
}
