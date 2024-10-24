import { IDecoration, IMarker, Terminal } from '@xterm/xterm';
import React from 'react';
import { Root, createRoot } from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { AIActionItem } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { Disposable, InlineChatFeatureRegistryToken, runWhenIdle } from '@opensumi/ide-core-common';
import { ITerminalController } from '@opensumi/ide-terminal-next';

import { InlineChatFeatureRegistry } from '../../../widget/inline-chat/inline-chat.feature.registry';
import {
  TerminalInlineWidgetForDetection,
  TerminalInlineWidgetForSelection,
} from '../component/terminal-inline-chat-controller';

@Injectable()
export class AITerminalDecorationService extends Disposable {
  @Autowired(ITerminalController)
  private terminalController: ITerminalController;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  private decorationList: IDecoration[] = [];
  private decorationRootMap = new Map<IDecoration, Root>();

  public active() {
    this.disposables.push(this.terminalController.onDidOpenTerminal(({ id }) => this.doSelectionDecoration(id)));
  }

  /**
   * Adds multiline decoration to the terminal.
   */
  addZoneDecoration(
    terminal: Terminal,
    marker: IMarker,
    height: number,
    inlineWidget: { operationList: AIActionItem[]; onClickItem: () => void },
  ) {
    const decoration = terminal.registerDecoration({
      marker,
      width: terminal.cols,
      height,
    });

    if (!decoration) {
      // eslint-disable-next-line no-console
      console.error('Failed to create decoration for line', marker);
      return;
    }

    let root: Root | undefined;

    decoration.onRender((element) => {
      if (!root) {
        root = createRoot(element);
      }
      // 理论上 React 会确保 DOM 不被重复渲染
      root.render(
        <TerminalInlineWidgetForDetection
          actions={inlineWidget.operationList}
          onClickItem={() => {
            inlineWidget.onClickItem();
          }}
        />,
      );
    });

    decoration.onDispose(() => {
      if (root) {
        root.unmount();
      }
    });
  }

  private doSelectionDecoration(clientId: string) {
    const client = this.terminalController.clients.get(clientId);
    const terminal = client?.term;
    if (!terminal) {
      return;
    }

    this.addDispose(
      terminal.onSelectionChange(() => {
        const oldDecoration = this.decorationList.pop();
        if (oldDecoration) {
          runWhenIdle(() => {
            oldDecoration?.dispose();
          });
        }
        const selection = terminal.getSelectionPosition();
        const selectionTextTrimed = terminal.getSelection().trim();

        if (selection && selectionTextTrimed.length > 0) {
          // 获取选区的右上角位置
          const endRow = selection.end.y;
          const startRow = selection.start.y;

          const cursorY2 = terminal.buffer.active.cursorY + terminal.buffer.active.baseY;
          const cursorYOffset = startRow - cursorY2;
          const selectionHeight = endRow - startRow + 1;

          // 注册一个装饰
          const marker = terminal.registerMarker(cursorYOffset);

          if (marker) {
            const selectionDecoration = terminal.registerDecoration({
              marker,
              width: terminal.cols,
              height: selectionHeight,
            });

            if (selectionDecoration) {
              let root: Root | undefined;
              selectionDecoration.onRender((element) => {
                if (!root) {
                  // 创建右上角的 div 元素，用于当 React 容器
                  root = createRoot(element);
                }

                const allActions = this.inlineChatFeatureRegistry.getTerminalActions();
                const selectionAction = allActions.filter(
                  (action) =>
                    this.inlineChatFeatureRegistry.getTerminalHandler(action.id)?.triggerRules === 'selection',
                );

                root.render(
                  <TerminalInlineWidgetForSelection
                    actions={selectionAction}
                    onClickItem={(id) => {
                      const handler = this.inlineChatFeatureRegistry.getTerminalHandler(id);
                      if (handler) {
                        handler.execute(selectionTextTrimed, '');
                      }
                    }}
                  />,
                );
              });

              // Decoration dispose 的时候，卸载 React 组件
              selectionDecoration.onDispose(() => {
                if (root) {
                  root.unmount();
                }
              });

              // this.selectionDecoration.onDispose()
              this.decorationList.push(selectionDecoration);
            }
          }
        }
      }),
    );
  }
}
