import throttle from 'lodash/throttle';
import React from 'react';
import ReactDOMClient from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, ConfigProvider } from '@opensumi/ide-core-browser';
import { Disposable, runWhenIdle } from '@opensumi/ide-core-common';
import { StackingLevelStr } from '@opensumi/ide-theme';

import * as monaco from '../../common';
import { editor } from '../monaco-exports';

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
  private configContext: AppConfig;

  allowEditorOverflow?: boolean | undefined = false;
  suppressMouseDown?: boolean | undefined = true;

  protected domNode: HTMLElement;
  protected options: ShowAIContentOptions | undefined;
  private root?: ReactDOMClient.Root | null = null;

  constructor(protected readonly editor: IMonacoCodeEditor) {
    super();

    this.addDispose(
      runWhenIdle(() => {
        this.root = ReactDOMClient.createRoot(this.getDomNode());
        this.root.render(<ConfigProvider value={this.configContext}>{this.renderView()}</ConfigProvider>);
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
      this.domNode.classList.add(this.getId());
      this.domNode.style.zIndex = StackingLevelStr.Overlay;
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
        preference: [editor.ContentWidgetPositionPreference.BELOW],
      };
    }

    return null;
  }
}
