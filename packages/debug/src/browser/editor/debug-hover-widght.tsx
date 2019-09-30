import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Injectable, Autowired } from '@ali/common-di';
import { DisposableCollection, Disposable, AppConfig, ConfigProvider } from '@ali/ide-core-browser';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugEditor, IDebugSessionManager } from '../../common';
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
  static ID = 'debug-varible-content-wdiget';

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

  protected readonly domNode = document.createElement('div');

  private isAttached: boolean = false;

  constructor() {
    this.init();
  }

  protected init(): void {
    this.editor.addContentWidget(this);
    this.toDispose.pushAll([
      Disposable.create(() => this.editor.removeContentWidget(this)),
      Disposable.create(() => this.hide()),
      this.sessions.onDidChange(() => {
        if (!this.isEditorFrame()) {
          this.hide();
        }
      }),
    ]);
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
    return !!currentFrame && !!currentFrame.source &&
      this.editor.getModel()!.uri.toString() === currentFrame.source.uri.toString();
  }

  protected doHide(): void {
    if (this.domNode.contains(document.activeElement)) {
      this.editor.focus();
    }
    if (!this.isAttached) {
      ReactDOM.unmountComponentAtNode(this.domNode);
    }
    this.hoverSource.reset();
    this.options = undefined;
    this.editor.layoutContentWidget(this);
  }

  protected async doShow(options: ShowDebugHoverOptions | undefined = this.options): Promise<void> {
    if (!this.isEditorFrame()) {
      this.hide();
      return;
    }
    if (!options) {
      this.hide();
      return;
    }
    if (this.options && this.options.selection.equalsRange(options.selection)) {
      return;
    }

    this.options = options;
    const expression = this.expressionProvider.get(this.editor.getModel()!, options.selection);
    if (!expression) {
      this.hide();
      return;
    }
    const toFocus = new DisposableCollection();
    if (this.options.focus) {
      // 焦点到Tree
    }
    if (!await this.hoverSource.evaluate(expression)) {
      toFocus.dispose();
      this.hide();
      return;
    }

    if (!this.isAttached) {
      ReactDOM.render(<ConfigProvider value={this.configContext} >
        <DebugHoverView / >
      </ConfigProvider>, this.domNode);
    }

    this.isAttached = true;

    this.editor.layoutContentWidget(this);
  }
}
