import throttle from 'lodash/throttle';
import React from 'react';
import ReactDOMClient from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, ConfigProvider, StackingLevelStr } from '@opensumi/ide-core-browser';
import { Disposable, runWhenIdle } from '@opensumi/ide-core-common';

import * as monaco from '../../common';
import { ContentWidgetPositionPreference } from '../monaco-exports/editor';

import type { ICodeEditor as IMonacoCodeEditor } from '../monaco-api/types';

export interface IInlineContentWidget extends monaco.editor.IContentWidget {
  show: (options?: ShowAIContentOptions | undefined) => void;
  hide: (options?: ShowAIContentOptions | undefined) => void;
}

export interface ShowAIContentOptions {
  selection?: monaco.Selection;
  position?: monaco.IPosition;
}

@Injectable({ multiple: true })
export abstract class ReactInlineContentWidget extends Disposable implements IInlineContentWidget {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  allowEditorOverflow = false;
  suppressMouseDown = false;
  positionPreference: ContentWidgetPositionPreference[] = [ContentWidgetPositionPreference.BELOW];

  protected domNode: HTMLElement;
  protected options: ShowAIContentOptions | undefined;
  private root?: ReactDOMClient.Root | null = null;

  constructor(protected readonly editor: IMonacoCodeEditor) {
    super();

    this.addDispose(
      runWhenIdle(() => {
        this.root = ReactDOMClient.createRoot(this.getDomNode());
        this.root.render(<ConfigProvider value={this.appConfig}>{this.renderView()}</ConfigProvider>);
        this.layoutContentWidget();
      }),
    );
  }

  public abstract renderView(): React.ReactNode;
  public abstract id(): string;

  override dispose(): void {
    this.hide();
    super.dispose();
  }

  show(options?: ShowAIContentOptions | undefined): void {
    if (!options) {
      return;
    }

    if (this.disposed) {
      return;
    }

    if (this.options && this.options.selection && this.options.selection.equalsRange(options.selection!)) {
      return;
    }

    this.options = options;
    this.editor.addContentWidget(this);
  }

  hide() {
    this.options = undefined;
    this.editor.removeContentWidget(this);
    if (this.root) {
      this.root.unmount();
    }
  }

  getId(): string {
    return this.id();
  }

  layoutContentWidget(): void {
    this.editor.layoutContentWidget(this);
  }

  getDomNode(): HTMLElement {
    if (!this.domNode) {
      this.domNode = document.createElement('div');
      requestAnimationFrame(() => {
        this.domNode.classList.add(this.getId());
        this.domNode.style.zIndex = StackingLevelStr.Overlay;
      });
    }

    const throttled = throttle(() => {
      requestAnimationFrame(() => this.layoutContentWidget());
    }, 16 * 3);

    const id = monaco.createLayoutEventType(this.id());

    this.domNode.addEventListener(id, throttled);

    this.addDispose(
      Disposable.create(() => {
        this.domNode.removeEventListener(id, throttled);
      }),
    );
    return this.domNode;
  }

  getPosition(): monaco.editor.IContentWidgetPosition | null {
    if (!this.options) {
      return null;
    }

    const { position } = this.options;

    if (position) {
      return {
        position,
        preference: this.positionPreference,
      };
    }

    return null;
  }

  /**
   * 判断编辑器区域宽度小于 270px
   * 不包括左侧 content width 和右侧的 minimap width
   */
  protected isOutOfArea(): boolean {
    const visibleWidth = 270;
    const contentLeftWith = this.editor.getLayoutInfo().contentLeft;
    const minimapWith = this.getMiniMapWidth();
    if (this.editor.getLayoutInfo().width - contentLeftWith - minimapWith < visibleWidth) {
      return true;
    }
    return false;
  }

  getMiniMapWidth(): number {
    return this.editor.getLayoutInfo().minimap.minimapWidth;
  }

  getLineHeight(): number {
    return this.editor.getOption(monaco.EditorOption.lineHeight);
  }
}
