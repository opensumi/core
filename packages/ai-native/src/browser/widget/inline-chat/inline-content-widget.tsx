import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IAIInlineChatService, StackingLevel, useInjectable } from '@opensumi/ide-core-browser';
import { AIAction } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import {
  AIInlineChatContentWidgetId,
  Disposable,
  Emitter,
  Event,
  InlineChatFeatureRegistryToken,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { monacoBrowser } from '@opensumi/ide-monaco/lib/browser';
import {
  ReactInlineContentWidget,
  ShowAIContentOptions,
} from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';

import { AINativeContextKey } from '../../ai-core.contextkeys';
import { InlineResultAction } from '../inline-actions/result-items/index';
import { InlineInputService } from '../inline-input/inline-input.service';
import { InteractiveInputModel } from '../inline-input/model';

import { InlineChatFeatureRegistry } from './inline-chat.feature.registry';
import styles from './inline-chat.module.less';
import { EInlineChatStatus, EResultKind, InlineChatService } from './inline-chat.service';

import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

interface IAIInlineChatControllerProps {
  onClickActions: (id: string) => void;
  onClose?: () => void;
  onChatStatus: Event<EInlineChatStatus>;
  onResultClick: (k: EResultKind) => void;
}

const AIInlineChatController = (props: IAIInlineChatControllerProps) => {
  const { onClickActions, onClose, onChatStatus, onResultClick } = props;
  const aiInlineChatService: InlineChatService = useInjectable(IAIInlineChatService);
  const inlineChatFeatureRegistry: InlineChatFeatureRegistry = useInjectable(InlineChatFeatureRegistryToken);

  const [status, setStatus] = useState<EInlineChatStatus>(EInlineChatStatus.READY);
  useEffect(() => {
    const dis = new Disposable();
    dis.addDispose(onChatStatus((s) => setStatus(s)));

    return () => {
      dis.dispose();
    };
  }, [onChatStatus, aiInlineChatService]);

  useEffect(() => {
    if (status === EInlineChatStatus.ERROR) {
      onClose?.();
    }
  }, [onClose]);

  const isLoading = useMemo(() => status === EInlineChatStatus.THINKING, [status]);
  const isDone = useMemo(() => status === EInlineChatStatus.DONE, [status]);
  const isError = useMemo(() => status === EInlineChatStatus.ERROR, [status]);
  const operationList = useMemo(() => inlineChatFeatureRegistry.getEditorActionButtons(), [inlineChatFeatureRegistry]);

  const handleClickActions = useCallback(
    (id: string) => {
      onClickActions?.(id);
    },
    [onClickActions],
  );

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const moreOperation = useMemo(
    () =>
      inlineChatFeatureRegistry.getEditorActionMenus().map(
        (data) =>
          new MenuNode({
            id: `ai.menu.operation.${data.id}`,
            label: data.name,
            className: styles.more_operation_menu_item,
            execute: () => {
              handleClickActions(data.id);
            },
          }),
      ),
    [inlineChatFeatureRegistry],
  );

  const renderContent = useCallback(() => {
    if (operationList.length === 0 && moreOperation.length === 0) {
      return null;
    }

    if (isError) {
      return null;
    }

    if (isDone) {
      return <InlineResultAction onResultClick={onResultClick} />;
    }

    return (
      <AIAction
        operationList={operationList}
        moreOperation={moreOperation}
        onClickItem={handleClickActions}
        onClose={handleClose}
        loading={isLoading}
      />
    );
  }, [operationList, moreOperation, onResultClick, status]);

  return <div className={styles.inline_chat_controller_box}>{renderContent()}</div>;
};

@Injectable({ multiple: true })
export class AIInlineContentWidget extends ReactInlineContentWidget {
  allowEditorOverflow = true;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(InlineInputService)
  protected readonly inlineInputService: InlineInputService;

  private readonly aiNativeContextKey: AINativeContextKey;

  private readonly _onActionClickEmitter = new Emitter<{ actionId: string; source: string }>();
  public readonly onActionClick = this._onActionClickEmitter.event;

  protected readonly _onStatusChange = new Emitter<EInlineChatStatus>();
  public readonly onStatusChange: Event<EInlineChatStatus> = this._onStatusChange.event;

  protected readonly _onResultClick = new Emitter<EResultKind>();
  public readonly onResultClick: Event<EResultKind> = this._onResultClick.event;

  protected _status: EInlineChatStatus = EInlineChatStatus.READY;
  public get status(): EInlineChatStatus {
    return this._status;
  }

  public get isPersisted(): boolean {
    return !this.isHidden && this.status !== EInlineChatStatus.READY && this.status !== EInlineChatStatus.ERROR;
  }

  constructor(protected readonly editor: IMonacoCodeEditor) {
    super(editor);

    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.editor.contextKeyService]);
  }

  public launchChatStatus(status: EInlineChatStatus) {
    return runWhenIdle(() => {
      this._status = status;
      this._onStatusChange.fire(status);
    });
  }

  override dispose(): void {
    this.launchChatStatus(EInlineChatStatus.READY);
    super.dispose();
  }

  public clickActionId(actionId: string, source: string): void {
    if (actionId === InteractiveInputModel.ID && this.options?.selection) {
      // 隐藏当前的 inline chat widget
      this.hide();
      // 显示 inline input widget
      this.inlineInputService.visibleBySelection(this.options.selection);
      return;
    }

    this._onActionClickEmitter.fire({ actionId, source });
  }

  public renderView(): React.ReactNode {
    return (
      <AIInlineChatController
        onClickActions={(id) => this.clickActionId(id, 'widget')}
        onClose={() => this.dispose()}
        onChatStatus={this.onStatusChange.bind(this)}
        onResultClick={(kind: EResultKind) => {
          this._onResultClick.fire(kind);
        }}
      />
    );
  }

  override async show(options?: ShowAIContentOptions | undefined): Promise<void> {
    super.show(options);
    this.aiNativeContextKey.inlineChatIsVisible.set(true);
  }

  override getDomNode(): HTMLElement {
    const domNode = super.getDomNode();
    requestAnimationFrame(() => {
      domNode.style.zIndex = (StackingLevel.FindWidget - 1).toString();
    });
    return domNode;
  }

  override async hide(): Promise<void> {
    this.aiNativeContextKey.inlineChatIsVisible.set(false);
    super.hide();
  }

  public setOptions(options: ShowAIContentOptions): void {
    this.options = options;
  }

  public setOffsetTop(top: number): void {
    this.domNode.style.transform = `translateY(${top}px)`;
  }

  id(): string {
    return AIInlineChatContentWidgetId;
  }

  override getPosition(): monaco.editor.IContentWidgetPosition | null {
    const position = super.getPosition();

    if (position) {
      return position;
    }

    if (!this.options) {
      return null;
    }

    const { selection } = this.options;
    if (!selection) {
      return null;
    }
    const target = this.computePosition(selection);
    if (target) {
      return target;
    }

    return null;
  }

  /**
   * 获取指定行的最后一个非空白字符的列数
   */
  private safeGetLineLastNonWhitespaceColumn(line: number) {
    const model = this.editor.getModel()!;
    if (line < 1) {
      line = 1;
    }
    const lineCount = model.getLineCount();
    if (line > lineCount) {
      line = lineCount;
    }

    return model.getLineLastNonWhitespaceColumn(line);
  }

  private toAbovePosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    return {
      position: new monaco.Position(lineNumber, column),
      preference: [
        monacoBrowser.editor.ContentWidgetPositionPreference.ABOVE,
        monacoBrowser.editor.ContentWidgetPositionPreference.BELOW,
      ],
    };
  }

  private toBelowPosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    return {
      position: new monaco.Position(lineNumber, column),
      preference: [
        monacoBrowser.editor.ContentWidgetPositionPreference.BELOW,
        monacoBrowser.editor.ContentWidgetPositionPreference.ABOVE,
      ],
    };
  }

  /**
   * 以当前 selection 为中心取上下各 1 行重新计算
   */
  private recheckSelection(selection: monaco.Selection): monaco.editor.IContentWidgetPosition {
    const preStartPosition = selection.getStartPosition();
    const preEndPosition = selection.getEndPosition();

    const model = this.editor.getModel()!;
    const maxCount = model.getLineCount();

    const safeAboveStartLine = Math.max(1, preEndPosition.lineNumber - 1);
    const safeBelowEndLine = Math.min(maxCount, preEndPosition.lineNumber + 1);

    const newStartPosition = preStartPosition.with(safeAboveStartLine, 1);
    const newEndPosition = preEndPosition.with(
      safeBelowEndLine,
      this.safeGetLineLastNonWhitespaceColumn(safeBelowEndLine),
    );

    // 如果整个文档只有 1 行，则直接显示在右下角
    if (maxCount === 1) {
      return this.toBelowPosition(safeBelowEndLine, this.safeGetLineLastNonWhitespaceColumn(safeBelowEndLine));
    }

    if (newEndPosition.lineNumber === 1 && preEndPosition.lineNumber !== preStartPosition.lineNumber) {
      return this.computePosition(monaco.Selection.fromPositions(newStartPosition, newEndPosition));
    }

    const aboveMaxColumn = this.safeGetLineLastNonWhitespaceColumn(safeAboveStartLine);
    const belowMaxColumn = this.safeGetLineLastNonWhitespaceColumn(safeBelowEndLine);
    const currentMaxColumn = this.safeGetLineLastNonWhitespaceColumn(preEndPosition.lineNumber);
    if (belowMaxColumn > currentMaxColumn && belowMaxColumn > aboveMaxColumn) {
      return this.computePosition(monaco.Selection.fromPositions(newEndPosition, newStartPosition));
    }

    return this.computePosition(monaco.Selection.fromPositions(newStartPosition, newEndPosition));
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
  protected computePosition(selection: monaco.Selection): monaco.editor.IContentWidgetPosition {
    const startPosition = selection.getStartPosition();
    const endPosition = selection.getEndPosition();
    let cursorPosition = selection.getPosition();

    const model = this.editor.getModel()!;
    const maxCount = model.getLineCount();

    // 只选中了一行
    if (startPosition.lineNumber === endPosition.lineNumber) {
      return this.recheckSelection(selection);
    }

    if (endPosition.lineNumber - startPosition.lineNumber === 1) {
      cursorPosition = endPosition;
    }

    const getCursorLastNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber);

    let targetLine: number = cursorPosition.lineNumber;
    let direction: 'above' | 'below' = 'below';

    // 用户选中了多行，光标在选中的开始位置
    if (cursorPosition.equals(startPosition)) {
      const getMaxLastWhitespaceColumn = Math.max(
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 1),
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 2),
      );

      // 如果上面两行的最后一个非空白字符的列数小于当前行的最后一个非空白字符的列数, 则直接显示在上面
      if (getMaxLastWhitespaceColumn <= getCursorLastNonWhitespaceColumn) {
        return this.toAbovePosition(cursorPosition.lineNumber, getCursorLastNonWhitespaceColumn);
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

      if (getMaxLastWhitespaceColumn <= getCursorLastNonWhitespaceColumn) {
        return this.toBelowPosition(cursorPosition.lineNumber, getCursorLastNonWhitespaceColumn);
      }

      for (let i = Math.min(maxCount, endPosition.lineNumber + 1); i >= startPosition.lineNumber; i--) {
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

    const column = this.safeGetLineLastNonWhitespaceColumn(targetLine) + 1;

    if (direction === 'below') {
      return this.toBelowPosition(targetLine, column);
    }
    return this.toAbovePosition(targetLine, column);
  }
}
