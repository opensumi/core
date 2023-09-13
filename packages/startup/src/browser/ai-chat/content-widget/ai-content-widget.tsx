import React from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { AppConfig, ConfigProvider, getExternalIcon } from '@opensumi/ide-core-browser';
import { AIInlineChatPanel } from './ai-inline-chat-panel';

export interface IAiContentWidget extends monaco.editor.IContentWidget {
  show: (options?: ShowAiContentOptions | undefined) => void;
  hide: (options?: ShowAiContentOptions | undefined) => void;
}

export interface ShowAiContentOptions {
  /**
   * 选中区域
   */
  selection?: monaco.Range;
  
  /**
   * 行列
   */
  position?: monaco.IPosition;
}

@Injectable({ multiple: true })
export class AiContentWidget extends Disposable implements IAiContentWidget {

  @Autowired(AppConfig)
  private configContext: AppConfig;

  allowEditorOverflow?: boolean | undefined = true;
  suppressMouseDown?: boolean | undefined = false;

  private domNode: HTMLElement;
  protected options: ShowAiContentOptions | undefined;

  private readonly _onSelectChange = new Emitter<string>();
  public readonly onSelectChange: Event<string> = this._onSelectChange.event;

  constructor(private readonly editor: IMonacoCodeEditor) {
    super();

    this.hide();
    this.renderView();
  }

  override dispose(): void {
    this.hide()
    super.dispose();
  }

  private renderView(): void {
    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <AIInlineChatPanel selectChangeFire={this._onSelectChange} />
      </ConfigProvider>,
      this.getDomNode(),
    );
    this.layoutContentWidget();
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

  setOptions(options: ShowAiContentOptions): void {
    this.options = options;
  }

  hide: (options?: ShowAiContentOptions | undefined) => void = () => {
    this.options = undefined;
    this.editor.removeContentWidget(this);
  };

  getId(): string {
    return 'AI-Content-Widget';
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
      return null
    }

    const { position, selection } = this.options;

    if (position) {
      return {
        position,
        preference: [
          monaco.editor.ContentWidgetPositionPreference.BELOW,
        ],
      }
    }

    const endPosition = selection && selection.getEndPosition();
    return endPosition
      ? {
          // @ts-ignore
          position: new monaco.Position(endPosition.lineNumber, this.options?.selection.startColumn),
          preference: [
            monaco.editor.ContentWidgetPositionPreference.BELOW,
          ],
        }
      : null;
  }
}
