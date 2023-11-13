import React from 'react';
import ReactDOM from 'react-dom';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, ConfigProvider } from '@opensumi/ide-core-browser';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { AiInlineChatContentWidget } from '../../common/index';

import { AiInlineChatController, EInlineOperation } from './inline-chat-controller';
import { AiInlineChatService, EInlineChatStatus } from './inline-chat.service';

export interface IInlineContentWidget extends monaco.editor.IContentWidget {
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
export class AiInlineContentWidget extends Disposable implements IInlineContentWidget {
  @Autowired(AppConfig)
  private configContext: AppConfig;

  @Autowired(AiInlineChatService)
  private aiInlineChatService: AiInlineChatService;

  allowEditorOverflow?: boolean | undefined = true;
  suppressMouseDown?: boolean | undefined = false;

  private domNode: HTMLElement;
  protected options: ShowAiContentOptions | undefined;

  private readonly _onClickOperation = new Emitter<EInlineOperation>();
  public readonly onClickOperation: Event<EInlineOperation> = this._onClickOperation.event;

  constructor(private readonly editor: IMonacoCodeEditor) {
    super();

    this.hide();
    this.renderView();
  }

  override dispose(): void {
    this.hide();
    this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY);
    super.dispose();
  }

  private renderView(): void {
    ReactDOM.render(
      <ConfigProvider value={this.configContext}>
        <AiInlineChatController onClickOperation={this._onClickOperation} onClose={() => this.dispose()} />
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
    return AiInlineChatContentWidget;
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

    const { position, selection } = this.options;

    if (position) {
      return {
        position,
        preference: [monaco.editor.ContentWidgetPositionPreference.BELOW],
      };
    }

    const endPosition = selection && selection.getEndPosition();
    return endPosition
      ? {
          // @ts-ignore
          position: new monaco.Position(endPosition.lineNumber, this.options?.selection.startColumn),
          preference: [monaco.editor.ContentWidgetPositionPreference.BELOW],
        }
      : null;
  }
}
