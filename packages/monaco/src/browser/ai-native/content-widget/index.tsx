import React from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, ConfigProvider } from '@opensumi/ide-core-browser';
import { Disposable, runWhenIdle } from '@opensumi/ide-core-common';

import * as monaco from '../../common';
import type { ICodeEditor as IMonacoCodeEditor } from '../../monaco-api/types';
import { editor } from '../monaco-exports';

export interface IInlineContentWidget extends monaco.editor.IContentWidget {
  show: (options?: ShowAiContentOptions | undefined) => void;
  hide: (options?: ShowAiContentOptions | undefined) => void;
}

export interface ShowAiContentOptions {
  selection?: monaco.Selection;
  position?: monaco.IPosition;
}

@Injectable({ multiple: true })
export abstract class BaseInlineContentWidget extends Disposable implements IInlineContentWidget {
  @Autowired(AppConfig)
  private configContext: AppConfig;

  allowEditorOverflow?: boolean | undefined = false;
  suppressMouseDown?: boolean | undefined = true;

  protected domNode: HTMLElement;
  protected options: ShowAiContentOptions | undefined;

  constructor(protected readonly editor: IMonacoCodeEditor) {
    super();

    runWhenIdle(() => {
      ReactDOM.render(
        <ConfigProvider value={this.configContext}>{this.renderView()}</ConfigProvider>,
        this.getDomNode(),
      );
      this.layoutContentWidget();
    });
  }

  public abstract renderView(): React.ReactNode;
  public abstract id(): string;

  override dispose(): void {
    this.hide();
    super.dispose();
  }

  async show(options?: ShowAiContentOptions | undefined): Promise<void> {
    if (!options) {
      return;
    }

    if (this.options && this.options.selection && this.options.selection.equalsRange(options.selection!)) {
      return;
    }

    this.options = options;
    this.editor.addContentWidget(this);
  }

  async hide() {
    this.options = undefined;
    this.editor.removeContentWidget(this);
    ReactDOM.unmountComponentAtNode(this.getDomNode());
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
      this.domNode.style.zIndex = '1';
    }
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
