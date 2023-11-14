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
  selection?: monaco.Selection;

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

      this.domNode.style.padding = '6px';
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

    return selection ? this.computerPosition(selection) : null;
  }

  private safeGetLineLastNonWhitespaceColumn(line: number) {
    const model = this.editor.getModel();
    return model!.getLineLastNonWhitespaceColumn(Math.min(Math.max(1, line), model!.getLineCount()));
  }

  private toAbovePosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    return {
      position: new monaco.Position(lineNumber, column),
      preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
    };
  }

  private toBelowPosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    return {
      position: new monaco.Position(lineNumber, column),
      preference: [monaco.editor.ContentWidgetPositionPreference.BELOW],
    };
  }

  private isProtrudeAbove(line: number) {
    const currentLastNonWhitespace = this.safeGetLineLastNonWhitespaceColumn(line);
    return (
      currentLastNonWhitespace >= this.safeGetLineLastNonWhitespaceColumn(line - 1) &&
      currentLastNonWhitespace >= this.safeGetLineLastNonWhitespaceColumn(line - 2)
    );
  }

  private isProtrudeBelow(line: number) {
    const currentLastNonWhitespace = this.safeGetLineLastNonWhitespaceColumn(line);
    return (
      currentLastNonWhitespace >= this.safeGetLineLastNonWhitespaceColumn(line + 1) &&
      currentLastNonWhitespace >= this.safeGetLineLastNonWhitespaceColumn(line + 2)
    );
  }

  /**
   * 动态计算要显示的位置
   * 1. 以选区里的光标作为顶点
   * 2. 靠近光标处周围没有字符的空白区域作为要显示的区域
   * 3. 显示的区域方向在右侧，左侧不考虑
   */
  private computerPosition(selection: monaco.Selection): monaco.editor.IContentWidgetPosition | null {
    const startPosition = selection.getStartPosition();
    const endPosition = selection.getEndPosition();
    const model = this.editor.getModel();

    if (!model) {
      return null;
    }

    const cursorPosition = selection.getPosition();
    const getCursorLastNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber);

    let targetLine: number | null = null;
    let direction: 'above' | 'below' | null = null;

    if (cursorPosition.equals(startPosition)) {
      const getMaxLastWhitespaceColumn = Math.max(
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 1),
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 2),
      );

      if (getMaxLastWhitespaceColumn < getCursorLastNonWhitespaceColumn) {
        return this.toAbovePosition(cursorPosition.lineNumber, getMaxLastWhitespaceColumn + 1);
      }

      for (let i = startPosition.lineNumber; i <= endPosition.lineNumber; i++) {
        if (this.isProtrudeAbove(i)) {
          targetLine = i;
          direction = 'above';
          break;
        }
        if (this.isProtrudeBelow(i)) {
          targetLine = i;
          direction = 'below';
          break;
        }
      }
    } else if (cursorPosition.equals(endPosition)) {
      const getMaxLastWhitespaceColumn = Math.max(
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber + 1),
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber + 2),
      );

      if (getMaxLastWhitespaceColumn < getCursorLastNonWhitespaceColumn) {
        return this.toBelowPosition(cursorPosition.lineNumber, getMaxLastWhitespaceColumn + 1);
      }

      for (let i = endPosition.lineNumber; i >= startPosition.lineNumber; i--) {
        if (this.isProtrudeBelow(i)) {
          targetLine = i;
          direction = 'below';
          break;
        }
        if (this.isProtrudeAbove(i)) {
          targetLine = i;
          direction = 'above';
          break;
        }
      }
    }

    if (targetLine && direction) {
      const column = this.safeGetLineLastNonWhitespaceColumn(targetLine) + 1;

      if (direction === 'below') {
        return this.toBelowPosition(targetLine, column);
      }
      return this.toAbovePosition(targetLine, column);
    }

    return this.toBelowPosition(endPosition.lineNumber, startPosition.column);
  }
}
