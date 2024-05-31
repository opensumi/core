import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IAIInlineChatService, StackingLevelStr, useInjectable } from '@opensumi/ide-core-browser';
import { AIAction, AIInlineResult } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ContentWidgetContainerPanel } from '@opensumi/ide-core-browser/lib/components/ai-native/content-widget/containerPanel';
import { InteractiveInput } from '@opensumi/ide-core-browser/lib/components/ai-native/interactive-input/index';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import {
  AIInlineChatContentWidgetId,
  Emitter,
  InlineChatFeatureRegistryToken,
  localize,
} from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { monacoBrowser } from '@opensumi/ide-monaco/lib/browser';
import {
  ReactInlineContentWidget,
  ShowAIContentOptions,
} from '@opensumi/ide-monaco/lib/browser/ai-native/BaseInlineContentWidget';

import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';

import { InlineChatFeatureRegistry } from './inline-chat.feature.registry';
import styles from './inline-chat.module.less';
import { AIInlineChatService, EInlineChatStatus } from './inline-chat.service';

import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

export interface IAIInlineOperationProps {
  handleActions: (id: string) => void;
  status: EInlineChatStatus;
  onClose?: () => void;
}

export interface IAIInlineChatControllerProps {
  onClickActions: (id: string) => void;
  onClose?: () => void;
  onInteractiveInputSend?: (value: string) => void;
}

export const AIInlineChatController = (props: IAIInlineChatControllerProps) => {
  const { onClickActions, onClose, onInteractiveInputSend } = props;
  const aiInlineChatService: AIInlineChatService = useInjectable(IAIInlineChatService);
  const inlineChatFeatureRegistry: InlineChatFeatureRegistry = useInjectable(InlineChatFeatureRegistryToken);
  const [status, setStatus] = useState<EInlineChatStatus>(EInlineChatStatus.READY);

  useEffect(() => {
    const dis = aiInlineChatService.onChatStatus((status) => {
      setStatus(status);
    });

    return () => {
      dis.dispose();
    };
  }, []);

  useEffect(() => {
    if (status === EInlineChatStatus.ERROR) {
      onClose?.();
    }
  }, [status, onClose]);

  const isLoading = useMemo(() => status === EInlineChatStatus.THINKING, [status]);
  const isDone = useMemo(() => status === EInlineChatStatus.DONE, [status]);
  const isError = useMemo(() => status === EInlineChatStatus.ERROR, [status]);
  const operationList = useMemo(() => inlineChatFeatureRegistry.getEditorActionButtons(), [inlineChatFeatureRegistry]);
  const hasInteractiveInput = useMemo(
    () => inlineChatFeatureRegistry.getInteractiveInputHandler(),
    [inlineChatFeatureRegistry],
  );

  const iconResultItems = useMemo(
    () => [
      {
        icon: 'check',
        text: localize('aiNative.inline.chat.operate.check.title'),
        onClick: () => {
          aiInlineChatService._onAccept.fire();
        },
      },
      {
        icon: 'discard',
        text: localize('aiNative.operate.discard.title'),
        onClick: () => {
          aiInlineChatService._onDiscard.fire();
        },
      },
      {
        icon: 'afresh',
        text: localize('aiNative.operate.afresh.title'),
        onClick: () => {
          aiInlineChatService._onRegenerate.fire();
        },
      },
    ],
    [],
  );

  const handleClickActions = useCallback(
    (id: string) => {
      if (onClickActions) {
        onClickActions(id);
      }
    },
    [onClickActions],
  );

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleInteractiveInputSend = useCallback(
    (value: string) => {
      onInteractiveInputSend?.(value);
      aiInlineChatService.launchChatStatus(EInlineChatStatus.THINKING);
    },
    [onInteractiveInputSend],
  );

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

  const customOperationRender = useMemo(() => {
    if (!hasInteractiveInput) {
      return null;
    }

    return (
      <InteractiveInput
        size='small'
        placeholder={localize('aiNative.inline.chat.input.placeholder.default')}
        width={320}
        onSend={handleInteractiveInputSend}
      />
    );
  }, [hasInteractiveInput]);

  const translateY: React.CSSProperties | undefined = useMemo(() => {
    if (isDone) {
      return {
        transform: 'translateY(-15px)',
      };
    }
    return undefined;
  }, [isDone]);

  const renderContent = useCallback(() => {
    if (operationList.length === 0 && moreOperation.length === 0) {
      return null;
    }

    if (isError) {
      return null;
    }

    if (isDone) {
      return (
        <ContentWidgetContainerPanel style={{ transform: 'translateY(4px)' }}>
          <AIInlineResult iconItems={iconResultItems} />
        </ContentWidgetContainerPanel>
      );
    }

    return (
      <AIAction
        operationList={operationList}
        moreOperation={moreOperation}
        onClickItem={handleClickActions}
        onClose={handleClose}
        loading={isLoading}
        loadingShowOperation={true}
        customOperationRender={customOperationRender}
      />
    );
  }, [operationList, moreOperation, customOperationRender, iconResultItems, status, hasInteractiveInput]);

  return <div style={translateY}>{renderContent()}</div>;
};

@Injectable({ multiple: true })
export class AIInlineContentWidget extends ReactInlineContentWidget {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IAIInlineChatService)
  private aiInlineChatService: AIInlineChatService;

  private readonly aiNativeContextKey: AINativeContextKey;

  private originTop = 0;

  private readonly _onActionClickEmitter = new Emitter<{
    actionId: string;
    source: string;
  }>();
  public readonly onActionClick = this._onActionClickEmitter.event;

  constructor(protected readonly editor: IMonacoCodeEditor) {
    super(editor);

    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [(this.editor as any)._contextKeyService]);
    this.addDispose(
      this.editor.onDidLayoutChange(() => {
        if (this.isOutOfArea()) {
          this.dispose();
        }
      }),
    );
  }

  override dispose(): void {
    this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY);
    super.dispose();
  }

  clickActionId(actionId: string, source: string): void {
    this._onActionClickEmitter.fire({ actionId, source });
  }

  public renderView(): React.ReactNode {
    return (
      <AIInlineChatController
        onClickActions={(id) => this.clickActionId(id, 'widget')}
        onClose={() => this.dispose()}
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
      domNode.style.padding = '6px';
      domNode.style.zIndex = StackingLevelStr.OverlayTop;
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

  public offsetTop(top: number): void {
    if (this.originTop === 0) {
      const top = this.domNode.style.top;
      this.originTop = top ? parseInt(top, 10) : 0;
    }

    this.domNode.style.top = `${this.originTop + top}px`;
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

  private recheckPosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    const preNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(lineNumber - 1);
    const curNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(lineNumber);
    const nextNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(lineNumber + 1);

    let newPreference = [monacoBrowser.editor.ContentWidgetPositionPreference.ABOVE];
    let newLineNumber = lineNumber;
    let newColumn = column;

    if (curNonWhitespaceColumn >= nextNonWhitespaceColumn) {
      newPreference = [monacoBrowser.editor.ContentWidgetPositionPreference.BELOW];
    } else if (curNonWhitespaceColumn >= preNonWhitespaceColumn) {
      newPreference = [monacoBrowser.editor.ContentWidgetPositionPreference.ABOVE];
    } else {
      newColumn = Math.min(preNonWhitespaceColumn, nextNonWhitespaceColumn);

      if (preNonWhitespaceColumn >= nextNonWhitespaceColumn) {
        newPreference = [monacoBrowser.editor.ContentWidgetPositionPreference.BELOW];
        newLineNumber = lineNumber - 1;
      } else {
        newPreference = [monacoBrowser.editor.ContentWidgetPositionPreference.ABOVE];
        newLineNumber = lineNumber + 1;
      }
    }

    if (lineNumber === 1 || lineNumber === 2) {
      newPreference = [monacoBrowser.editor.ContentWidgetPositionPreference.BELOW];
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
  private computePosition(selection: monaco.Selection): monaco.editor.IContentWidgetPosition | null {
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

    // 用户只选中了一行
    if (startPosition.lineNumber === endPosition.lineNumber) {
      return this.recheckPosition(cursorPosition.lineNumber, cursorPosition.column);
    }

    // 用户选中了多行，光标在选中的开始位置
    if (cursorPosition.equals(startPosition)) {
      const getMaxLastWhitespaceColumn = Math.max(
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 1),
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 2),
      );

      // 如果上面两行的最后一个非空白字符的列数小于当前行的最后一个非空白字符的列数 + 10
      // 则直接显示在上面
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
