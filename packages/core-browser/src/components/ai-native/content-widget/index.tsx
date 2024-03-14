import React from 'react';
import ReactDOM from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, ConfigProvider } from '@opensumi/ide-core-browser';
import { Disposable, runWhenIdle } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

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
  private renderDom: ReactDOM.Root;

  constructor(protected readonly editor: IMonacoCodeEditor) {
    super();

    runWhenIdle(() => {
      this.renderDom = ReactDOM.createRoot(this.getDomNode());
      this.renderDom.render(<ConfigProvider value={this.configContext}>{this.renderView()}</ConfigProvider>);
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
    if (this.renderDom) {
      this.renderDom.unmount();
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
        preference: [monaco.editor.ContentWidgetPositionPreference.BELOW],
      };
    }

    return null;
  }
}
