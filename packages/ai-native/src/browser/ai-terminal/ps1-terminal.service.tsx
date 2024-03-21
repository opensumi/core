import domAlign from 'dom-align';
import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { v4 as uuid } from 'uuid';
import { IDecoration, IDisposable, IMarker, Terminal } from 'xterm';

import { Autowired, Injectable } from '@opensumi/di';
import { localize } from '@opensumi/ide-core-browser';
import { Disposable, IAIReporter } from '@opensumi/ide-core-common';
import { ITerminalConnection, ITerminalController } from '@opensumi/ide-terminal-next';

import { ChatService } from '../chat/chat.service';
import { MsgStreamManager } from '../model/msg-stream-manager';

import { AITerminalPrompt, SmartCommandDesc } from './component/terminal-command-suggest-controller';

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

  @Autowired(ChatService)
  private readonly aiChatService: ChatService;

  @Autowired(MsgStreamManager)
  private readonly msgStreamManager: MsgStreamManager;

  @Autowired(IAIReporter)
  aiReporter: IAIReporter;

  private popupContainer: HTMLDivElement; // AI 终端提示 弹出框容器

  private promptEndMarker: IMarker | undefined;
  private promptEndDecoration: IDecoration | undefined;
  private promptEndReactRoot: Root | undefined;
  private onDataDisposable: IDisposable;

  private currentSessionId: string;

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

    const aiHinitDecoration = xterm.registerDecoration({
      marker: this.promptEndMarker,
      width: xterm.cols,
      height: 1,
      x: xOffset2 + 2,
      layer: 'top',
    });

    aiHinitDecoration?.onRender((element) => {
      element.innerText = localize('terminal.ai.inputSharpToGetHint');
      element.style.opacity = '0.3';
      // 提示框点击也可以触发 AI 弹窗
      element.onclick = () => {
        this.showAICommandPopup(xterm, xOffset2);
      };
    });

    this.onDataDisposable = xterm.onData((e) => {
      // 获取当前活动缓冲区
      const buffer = xterm.buffer.active;

      // 获取光标位置
      const cursorX = buffer.cursorX;
      const cursorY = buffer.cursorY;

      // 用户有输入时，就隐藏掉提示框
      aiHinitDecoration?.dispose();

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
    if (this.currentSessionId) {
      await this.aiChatService.destroyStreamRequest(this.currentSessionId);
      this.aiChatService.cancelChatViewToken();
    }
  }

  // 获取 AI 命令建议
  private async getAICommandSuggestions(
    commandDescription: string,
    statCallback: (stat: number) => void,
    suggestionCallback: (suggestions: SmartCommandDesc[]) => void,
  ) {
    // 根据国际化配置调整 AI Prompt 的提示语
    const aiPrompt = `${localize('terminal.ai.modelPrompt')} ${commandDescription}`;

    // 如果已有 AI 请求发出，那就取消这个 AI 请求
    await this.stopAIStreamRequest();

    const reportRelationId = this.aiReporter.start('terminalAICommand', { message: commandDescription });
    const sessionId = uuid();
    await this.aiChatService.messageWithStream(aiPrompt, {}, sessionId);

    this.currentSessionId = sessionId;

    let buffer = ''; // 用于累积数据片段的缓冲区
    const aiCommandSuggestions: SmartCommandDesc[] = [];
    let currentObj = {} as SmartCommandDesc;

    // 流式解析大模型返回的每行数据
    const processLine = (lineBuffer: string) => {
      const firstCommandIndex = lineBuffer.indexOf('#Command#:');
      let line = lineBuffer;

      if (firstCommandIndex !== -1) {
        // 找到了第一个#Command#:，截取它及之后的内容
        line = lineBuffer.substring(firstCommandIndex);
      }

      // 解析命令和描述
      if (line.startsWith('#Command#:')) {
        if (currentObj.command) {
          // 如果currentObj中已有命令，则将其添加到结果数组中，并开始新的对象
          currentObj = {} as SmartCommandDesc;
        }
        currentObj.command = line.substring('#Command#:'.length).trim();
      } else if (line.startsWith('#Description#:')) {
        currentObj.description = line.substring('#Description#:'.length).trim();
        aiCommandSuggestions.push(currentObj);
        if (aiCommandSuggestions.length > 4) {
          // 如果 AI 返回的命令超过 5 个，就停止 AI 生成 (这种情况下往往是模型不稳定或者出现了幻觉)
          this.stopAIStreamRequest();
        }
        suggestionCallback(aiCommandSuggestions); // 每拿到一个结果就回调一次，优化用户体感
      }
    };

    // 大模型 Stream 流式返回监听，缓存处理，然后按行解析
    this.msgStreamManager.onMsgListChange(sessionId)((msg) => {
      if (msg && this.msgStreamManager.currentSessionId === sessionId) {
        const { delta, finish_reason } = msg;
        const chunk = delta.content;

        buffer += chunk;
        if (finish_reason === 'stop') {
          buffer += '\n';
        }
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.substring(0, newlineIndex).trim();
          buffer = buffer.substring(newlineIndex + 1);
          processLine(line);
          newlineIndex = buffer.indexOf('\n');
        }
      }
    });

    // 大模型 Stream 状态监听
    this.msgStreamManager.onMsgStatus((status) => {
      if (this.msgStreamManager.currentSessionId === sessionId) {
        statCallback(status);
        if (status === 2) {
          // AI 思考完成
          this.aiReporter.end(reportRelationId, { message: commandDescription, success: true });
          this.currentSessionId = '';
        }
      }
    });
  }
}
