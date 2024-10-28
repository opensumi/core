import { IDecoration, IDisposable, IMarker, Terminal } from '@xterm/xterm';
import domAlign from 'dom-align';
import React from 'react';
import { Root, createRoot } from 'react-dom/client';

import { Autowired, Injectable } from '@opensumi/di';
import { localize } from '@opensumi/ide-core-browser';
import {
  AIServiceType,
  ActionSourceEnum,
  CancellationTokenSource,
  Disposable,
  IAIReporter,
  TerminalRegistryToken,
} from '@opensumi/ide-core-common';
import { ITerminalConnection, ITerminalController } from '@opensumi/ide-terminal-next';
import { listenReadable } from '@opensumi/ide-utils/lib/stream';

import { ITerminalCommandSuggestionDesc } from '../../../common';

import { AITerminalPrompt } from './component/terminal-command-suggest-controller';
import { TerminalFeatureRegistry } from './terminal.feature.registry';

// 基于 PS1 Hack 的终端 AI 能力集成

enum IstermOscPt {
  PromptStarted = 'PS',
  PromptEnded = 'PE',
  CurrentWorkingDirectory = 'CWD',
}

@Injectable()
export class PS1TerminalService extends Disposable {
  @Autowired(ITerminalController)
  private terminalController: ITerminalController;

  @Autowired(TerminalRegistryToken)
  private readonly terminalFeatureRegistry: TerminalFeatureRegistry;

  @Autowired(IAIReporter)
  aiReporter: IAIReporter;

  private popupContainer: HTMLDivElement; // AI 终端提示 弹出框容器

  private promptEndMarker: IMarker | undefined;
  private promptEndDecoration: IDecoration | undefined;
  private promptEndReactRoot: Root | undefined;
  private onDataDisposable: IDisposable;

  private cancelToken = new CancellationTokenSource();

  public active() {
    this.initContainer();
    this.disposables.push(this.terminalController.onDidOpenTerminal(({ id }) => this.listenTerminalEvent(id)));
  }

  private listenTerminalEvent(clientId: string) {
    const client = this.terminalController.clients.get(clientId);

    if (client) {
      setTimeout(() => {
        this.listenPromptState(client.term);
      }, 0);
    }
  }

  private initContainer() {
    this.popupContainer = document.createElement('div');
    document.body.appendChild(this.popupContainer);
  }

  private listenPromptState(xterm: Terminal) {
    xterm.parser.registerOscHandler(6973, (data) => {
      const argsIndex = data.indexOf(';');
      const sequence = argsIndex === -1 ? data : data.substring(0, argsIndex);

      switch (sequence) {
        case IstermOscPt.PromptEnded:
          this.handlePromptEnd(xterm);
          break;
        default:
          return false;
      }
      // 不要阻止事件传递
      return false;
    });
  }

  private handlePromptEnd(xterm: Terminal) {
    if (this.promptEndMarker) {
      this.promptEndMarker.dispose();
    }
    if (this.promptEndDecoration) {
      this.promptEndDecoration.dispose();
    }
    this.promptEndMarker = xterm.registerMarker(0);
    const xOffset2 = xterm.buffer.active.cursorX;

    if (this.onDataDisposable) {
      this.onDataDisposable.dispose();
    }

    const aiHintDecoration = xterm.registerDecoration({
      marker: this.promptEndMarker,
      width: xterm.cols,
      height: 1,
      x: xOffset2 + 2,
      layer: 'top',
    });

    aiHintDecoration?.onRender((element) => {
      element.innerText = localize('terminal.ai.inputSharpToGetHint');
      element.style.opacity = '0.3';
    });

    this.onDataDisposable = xterm.onData((e) => {
      // 获取当前活动缓冲区
      const buffer = xterm.buffer.active;

      // 获取光标位置
      const cursorX = buffer.cursorX;
      const cursorY = buffer.cursorY;

      // 用户有输入时，就隐藏掉提示框
      aiHintDecoration?.dispose();

      if (
        e === '#' &&
        cursorY + buffer.baseY === this.promptEndMarker?.line &&
        (cursorX === xOffset2 || cursorX === xOffset2 + 1)
      ) {
        this.showAICommandPopup(xterm, xOffset2);
      }
    });
  }

  /**
   * 展示 AI 提示命令的弹框
   * @param xterm Xterm 实例
   * @param xOffset2 传入的 X 偏移坐标
   * @returns
   */
  private showAICommandPopup(xterm: Terminal, xOffset2: number) {
    if (!this.promptEndMarker) {
      return;
    }
    this.promptEndDecoration = xterm.registerDecoration({
      marker: this.promptEndMarker,
      width: 1,
      height: 1,
      backgroundColor: '#2472C8',
      x: xOffset2,
      layer: 'top',
    });

    // HACK: 这里拿去 TerminalConnection 的方式很 Hack，看看有没有更好的办法？
    // @ts-ignore
    const connectionWrapper = xterm._addonManager._addons.find((addon) => !!addon?.instance?.connection);
    const connection = connectionWrapper?.instance?.connection as ITerminalConnection;

    if (!connection) {
      // eslint-disable-next-line no-console
      console.error(localize('terminal.ai.cannotGetTerminalConnection'));
      return;
    }

    this.promptEndDecoration?.onRender((element) => {
      const domWidth = element.clientWidth;

      if (this.promptEndReactRoot) {
        this.promptEndReactRoot.unmount();
      }

      this.promptEndReactRoot = createRoot(this.popupContainer);

      // 直接在 Decoration DOM 上渲染 input 输入框的话，input 的事件会被 xterm 影响导致无法聚焦
      // 因此采用外层 DOM + DOMAlign + 生命周期绑定 的方式来渲染输入框和 AI 提示框
      this.promptEndReactRoot.render(
        <AITerminalPrompt
          onEscTriggered={() => {
            setTimeout(() => {
              connection.sendData('\b');
              this.promptEndDecoration?.dispose();
            }, 0);
          }}
          onSuggestionClick={(suggestion) => {
            setTimeout(() => {
              connection.sendData('\b');
              connection.sendData(suggestion);
              this.promptEndDecoration?.dispose();
            }, 0);
          }}
          getAICommandSuggestions={this.getAICommandSuggestions.bind(this)}
          cancelAIRequst={this.stopAIStreamRequest.bind(this)}
        />,
      );

      domAlign(this.popupContainer, element, {
        points: ['bl', 'bl'],
        offset: [-domWidth - 6, 0],
        targetOffset: [0, 0],
        overflow: { adjustX: false, adjustY: false },
      });
    });

    // AI 输入自然语言命令的输入框被取消，需要后续处理的逻辑
    this.promptEndDecoration?.onDispose(() => {
      this.stopAIStreamRequest();
      // 取消 AI 悬浮框的 React 渲染
      if (this.promptEndReactRoot) {
        this.promptEndReactRoot.unmount();
      }
      // 聚焦焦点到 Xterm 上
      xterm.focus();
    });
  }

  private async stopAIStreamRequest() {
    this.cancelToken.cancel();
    this.cancelToken = new CancellationTokenSource();
  }

  // 获取 AI 命令建议
  private async getAICommandSuggestions(
    commandDescription: string,
    doneCallback: () => void,
    _thinkingCallback: () => void,
    suggestionCallback: (suggestions: ITerminalCommandSuggestionDesc[]) => void,
  ) {
    await this.stopAIStreamRequest();

    const reportRelationId = this.aiReporter.start(AIServiceType.TerminalAICommand, { message: commandDescription });

    const terminalReadableStream = await this.terminalFeatureRegistry.readableCommandSuggestions(
      commandDescription,
      this.cancelToken.token,
    );

    const aiCommandSuggestions: ITerminalCommandSuggestionDesc[] = [];

    listenReadable<ITerminalCommandSuggestionDesc>(terminalReadableStream, {
      onData: (data) => {
        aiCommandSuggestions.push(data);
        suggestionCallback(aiCommandSuggestions);
      },
      onEnd: (): void => {
        doneCallback();
        this.aiReporter.end(reportRelationId, {
          message: commandDescription,
          success: true,
          actionSource: ActionSourceEnum.Terminal,
        });
      },
    });
  }
}
