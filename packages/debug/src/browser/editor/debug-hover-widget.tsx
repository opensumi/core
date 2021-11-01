import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import React from 'react';
import ReactDOM from 'react-dom';
import type { ITextModel } from '@ali/monaco-editor-core/esm/vs/editor/common/model';
import { Injectable, Autowired } from '@ali/common-di';
import { DisposableCollection, Disposable, AppConfig, ConfigProvider, IReporterService } from '@ali/ide-core-browser';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugEditor, IDebugSessionManager, DEBUG_REPORT_NAME } from '../../common';
import { DebugExpressionProvider } from './debug-expression-provider';
import { DebugHoverSource } from './debug-hover-source';
import { DebugHoverView } from './debug-hover.view';
import debounce = require('lodash.debounce');

export interface ShowDebugHoverOptions {
  /**
   * 选中区域
   */
  selection: monaco.Range;
  /**
   * 是否为焦点
   * 默认值：false
   */
  focus?: boolean;
  /**
   * 是否立即调用，当为true时会清理之前的队列
   * 默认值：true
   */
  immediate?: boolean;
}

export interface HideDebugHoverOptions {
  /**
   * 是否立即调用，当为true时会清理之前的队列
   * 默认值：true
   */
  immediate?: boolean;
}

@Injectable()
export class DebugHoverWidget implements monaco.editor.IContentWidget {
  static ID = 'debug-hover-widget';

  protected readonly toDispose = new DisposableCollection();

  @Autowired(DebugEditor)
  protected readonly editor: DebugEditor;

  @Autowired(IDebugSessionManager)
  protected readonly sessions: DebugSessionManager;

  @Autowired(DebugExpressionProvider)
  protected readonly expressionProvider: DebugExpressionProvider;

  @Autowired(DebugHoverSource)
  protected readonly hoverSource: DebugHoverSource;

  @Autowired(AppConfig)
  private configContext: AppConfig;

  @Autowired(IReporterService)
  protected readonly reporterService: IReporterService;

  protected readonly domNode = document.createElement('div');

  constructor() {
    this.init();
  }

  protected init(): void {
    this.toDispose.pushAll([
      Disposable.create(() => this.editor.removeContentWidget(this)),
      Disposable.create(() => this.hide()),
      this.sessions.onDidChange(() => {
        if (!this.isEditorFrame()) {
          this.hide();
        }
      }),
    ]);
    this.renderView();
  }

  handleWindowWheel(event) {
    event.stopPropagation();
  }

  getId(): string {
    return DebugHoverWidget.ID;
  }

  getDomNode() {
    return this.domNode;
  }

  getPosition(): monaco.editor.IContentWidgetPosition {
    const position = this.options && this.options.selection.getStartPosition();
    const word = position && this.editor.getModel()!.getWordAtPosition(position);
    return position && word ? {
      position: new monaco.Position(position.lineNumber, word.startColumn),
      preference: [
        monaco.editor.ContentWidgetPositionPreference.BELOW,
        monaco.editor.ContentWidgetPositionPreference.ABOVE,
      ],
    } : undefined!;
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  show(options?: ShowDebugHoverOptions): void {
    this.schedule(() => this.doShow(options), options && options.immediate);
  }

  hide(options?: HideDebugHoverOptions): void {
    this.schedule(() => this.doHide(), options && options.immediate);
  }

  protected options: ShowDebugHoverOptions | undefined;

  protected schedule(fn: () => void, immediate: boolean = true): void {
    if (immediate) {
      this.doSchedule.cancel();
      fn();
    } else {
      this.doSchedule(fn);
    }
  }
  protected readonly doSchedule: any = debounce((fn: () => void) => fn(), 300);

  protected isEditorFrame(): boolean {
    const { currentFrame } = this.sessions;
    return !!currentFrame && !!currentFrame.source && !!this.editor.getModel() && this.editor.getModel()!.uri.toString() === currentFrame.source.uri.toString();
  }

  protected doHide(): void {
    window.removeEventListener('mousewheel', this.handleWindowWheel, true);
    if (this.domNode.contains(document.activeElement)) {
      this.editor.focus();
    }
    this.hoverSource.dispose();
    this.hoverSource.clearEvaluate();
    this.options = undefined;
    this.editor.removeContentWidget(this);
  }

  protected layoutContentWidget(): void {
    this.editor.layoutContentWidget(this);
  }

  private renderView(): void {
    ReactDOM.render((<ConfigProvider value={ this.configContext } >
      <DebugHoverView />
    </ConfigProvider>), this.getDomNode(), () => {
      this.layoutContentWidget();
    });
  }

  protected async doShow(options: ShowDebugHoverOptions | undefined = this.options): Promise<void> {
    if (!this.isEditorFrame()) {
      return;
    }

    if (!options) {
      return;
    }

    if (this.options && this.options.selection.equalsRange(options.selection)) {
      return;
    }

    this.options = options;
    const expression = await this.expressionProvider.get(this.editor.getModel()! as unknown as ITextModel, options.selection);
    if (!expression) {
      return;
    }

    this.hoverSource.clearEvaluate();

    if (!await this.hoverSource.evaluate(expression)) {
      return;
    }

    this.reporterService.point(DEBUG_REPORT_NAME?.DEBUG_VARIABLES, 'hover', expression);

    this.editor.addContentWidget(this);
    // 展示变量面板时临时屏蔽滚轮事件
    window.addEventListener('mousewheel', this.handleWindowWheel, true);
  }
}
