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

  allowEditorOverflow?: boolean | undefined = false;
  suppressMouseDown?: boolean | undefined = false;

  private domNode: HTMLElement;
  protected options: ShowAiContentOptions | undefined;

  private readonly _onClickOperation = new Emitter<EInlineOperation>();
  public readonly onClickOperation: Event<EInlineOperation> = this._onClickOperation.event;

  constructor(private readonly editor: IMonacoCodeEditor) {
    super();

    this.hide();
    this.renderView();

    this.addDispose(
      this.editor.onDidLayoutChange(() => {
        if (this.isOutOfArea()) {
          this.dispose();
        }
      }),
    );
  }

  override dispose(): void {
    this.hide();
    this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY);
    super.dispose();
  }

  /**
   * 如果编辑器区域宽度小于 270px，则不显示
   * 不包括左侧 content width 和右侧的 minimap width
   */
  private isOutOfArea(): boolean {
    const visibleWidth = 270;
    const contentLeftWith = this.editor.getOption(monaco.editor.EditorOption.layoutInfo).contentLeft;
    const minimapWith = this.editor.getOption(monaco.editor.EditorOption.layoutInfo).minimap.minimapWidth;
    if (this.editor.getLayoutInfo().width - contentLeftWith - minimapWith < visibleWidth) {
      return true;
    }
    return false;
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
      this.domNode.style.zIndex = '999';
      this.domNode.style.paddingRight = '50px';
    }
    return this.domNode;
  }

  getPosition(): monaco.editor.IContentWidgetPosition | null {
    if (!this.options) {
      return null;
    }

    if (this.isOutOfArea()) {
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
      preference: [
        monaco.editor.ContentWidgetPositionPreference.ABOVE,
        monaco.editor.ContentWidgetPositionPreference.BELOW,
      ],
    };
  }

  private toBelowPosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    return {
      position: new monaco.Position(lineNumber, column),
      preference: [
        monaco.editor.ContentWidgetPositionPreference.BELOW,
        monaco.editor.ContentWidgetPositionPreference.ABOVE,
      ],
    };
  }

  private recheckPosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    const preNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(lineNumber - 1);
    const curNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(lineNumber);
    const nextNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(lineNumber + 1);

    let newPreference = [monaco.editor.ContentWidgetPositionPreference.ABOVE];
    let newLineNumber = lineNumber;
    let newColumn = column;

    if (curNonWhitespaceColumn >= nextNonWhitespaceColumn) {
      // this.domNode.style.marginTop = '-18px';
      newPreference = [monaco.editor.ContentWidgetPositionPreference.BELOW];
    } else if (curNonWhitespaceColumn >= preNonWhitespaceColumn) {
      // this.domNode.style.marginTop = '18px';
      newPreference = [monaco.editor.ContentWidgetPositionPreference.ABOVE];
    } else {
      newColumn = Math.min(preNonWhitespaceColumn, nextNonWhitespaceColumn);

      if (preNonWhitespaceColumn >= nextNonWhitespaceColumn) {
        newPreference = [monaco.editor.ContentWidgetPositionPreference.BELOW];
        newLineNumber = lineNumber - 1;
      } else {
        newPreference = [monaco.editor.ContentWidgetPositionPreference.ABOVE];
        newLineNumber = lineNumber + 1;
      }
    }

    if (lineNumber === 1 || lineNumber === 2) {
      newPreference = [monaco.editor.ContentWidgetPositionPreference.BELOW];
    }

    return {
      position: new monaco.Position(newLineNumber, newColumn),
      preference: newPreference,
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

    if (startPosition.lineNumber === endPosition.lineNumber) {
      return this.recheckPosition(
        cursorPosition.lineNumber,
        // this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber),
        cursorPosition.column,
      );
    }

    if (cursorPosition.equals(startPosition)) {
      const getMaxLastWhitespaceColumn = Math.max(
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 1),
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 2),
      );

      if (getMaxLastWhitespaceColumn < getCursorLastNonWhitespaceColumn + 10) {
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

      if (getMaxLastWhitespaceColumn < getCursorLastNonWhitespaceColumn + 10) {
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

    return this.recheckPosition(
      cursorPosition.lineNumber,
      this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber),
    );
  }
}
