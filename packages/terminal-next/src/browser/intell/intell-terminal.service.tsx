import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { IDecoration, IDisposable, IMarker, Terminal } from 'xterm';

import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';

import { ITerminalController } from '../../common/controller';
import { ITerminalConnection } from '../../common/index';
import { ITerminalSuggestionProvider, ITerminalSuggestionProviderPath } from '../../common/intell/runtime';
import { CodeTerminalSettingId } from '../../common/preference';
import {
  SuggestionViewModel,
  TerminalIntellCompleteController,
} from '../component/terminal-intell-complete-controller';

enum IstermOscPt {
  PromptStarted = 'PS',
  PromptEnded = 'PE',
  CurrentWorkingDirectory = 'CWD',
}

@Injectable()
export class IntellTerminalService extends Disposable {
  @Autowired(ITerminalController)
  private terminalController: ITerminalController;

  @Autowired(ITerminalSuggestionProviderPath)
  private suggestionProvider: ITerminalSuggestionProvider;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  public intellSettingPopupVisible = false;

  protected _onVisibleChange = new Emitter<boolean>();
  public onIntellSettingsVisibleChange: Event<boolean> = this._onVisibleChange.event;

  private controlEmitter = new Emitter<string>();

  private popupContainer: HTMLDivElement; // AI 终端下拉补全的弹出框容器

  private promptEndMarker: IMarker | undefined;
  private promptEndDecoration: IDecoration | undefined; // 终端输入 Prompt 结束时的 decoration
  private onDataDisposable: IDisposable;
  private cwd: string = '';

  // 基于 终端输入末尾 + Prompt End 位置定位的弹出框
  private completePopupRoot: Root | undefined;
  private completePopupDisposeTimeoutHandler: ReturnType<typeof setTimeout> | undefined;

  private lastPromptLineString: string;
  private isShellIntellActive: boolean;

  private promptEndDecorationObserver: MutationObserver | undefined;

  public active() {
    this.initContainer();
    this.disposables.push(this.terminalController.onDidOpenTerminal(({ id }) => this.listenTerminalEvent(id)));
  }

  private initContainer() {
    this.popupContainer = document.createElement('div');
    this.popupContainer.style.zIndex = '12';
    document.body.appendChild(this.popupContainer);
  }

  private listenTerminalEvent(clientId: string) {
    const client = this.terminalController.clients.get(clientId);

    if (client) {
      try {
        this.listenPromptState(client.term);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('listenTerminalEvent', e);
      }
    }
  }

  private listenPromptState(xterm: Terminal) {
    xterm.parser.registerOscHandler(6973, (data) => {
      const argsIndex = data.indexOf(';');
      const sequence = argsIndex === -1 ? data : data.substring(0, argsIndex);

      switch (sequence) {
        case IstermOscPt.PromptStarted:
          break;
        case IstermOscPt.PromptEnded:
          this.handlePromptEnd(xterm);
          break;
        case IstermOscPt.CurrentWorkingDirectory:
          this.handleCwdUpdate(data);
          break;
        default:
          return false;
      }
      return false;
    });
  }

  private handleCwdUpdate(data) {
    this.cwd = data.split(';').at(1);
  }

  private handlePromptEnd(xterm: Terminal) {
    const connection = this.getConnection(xterm);
    window.conn1 = connection;
    if (this.onDataDisposable) {
      this.onDataDisposable.dispose();
    }
    this.disposePreviousPromptEnd();

    const enable = this.preferenceService.get<boolean>(CodeTerminalSettingId.EnableTerminalIntellComplete, false);
    if (!enable) {
      connection.readonly = false; // HACK: 取消 Hack 逻辑，恢复原有的终端数据链路
      return;
    } else {
      connection.readonly = true; // HACK: 避免原有链路自动发送终端的操作
    }

    this.promptEndMarker = xterm.registerMarker(0);
    const xOffset2 = xterm.buffer.active.cursorX;

    let lastData = '';
    this.onDataDisposable = xterm.onData(async (e) => {
      const xtermFullScreenMode = xterm.buffer.active === xterm.buffer.alternate;

      // 如果是终端全屏模式的话，比如说 vim 或者 tmux 等，就不要智能补全，遵循原始行为
      if (xtermFullScreenMode) {
        connection.sendData(e);
        return;
      }

      // 稍微 settimeout 一下，等待终端渲染
      setTimeout(async () => {
        const notRender = this.handleKeyPress(e, lastData, connection);
        lastData = e;

        if (e === '\x1b' && this.promptEndDecoration) {
          this.promptEndDecoration.dispose();
          return;
        }

        const buffer = xterm.buffer.active;
        const cursorX = buffer.cursorX;
        const lineData = buffer.getLine(this.promptEndMarker?.line || 0);
        const lineDataString = lineData?.translateToString(false, xOffset2, cursorX);

        if (notRender || !lineDataString || !this.promptEndMarker) {
          return;
        }

        await this.renderSuggestions(xterm, connection, lineDataString, cursorX);
      }, 50);
    });
  }

  private handleKeyPress(inputData: string, lastInputData: string, connection: ITerminalConnection): boolean {
    let notRender = false;

    switch (inputData) {
      case '\x1b':
        this.controlEmitter.fire('Escape');
        break;
      case '\x1b[A':
        this.controlEmitter.fire('ArrowUp');
        notRender = true;
        if (!this.isShellIntellActive) {
          connection.sendData(inputData);
        }
        break;
      case '\x1b[B':
        this.controlEmitter.fire('ArrowDown');
        notRender = true;
        if (!this.isShellIntellActive) {
          connection.sendData(inputData);
        }
        break;
      case '\t':
      case '\x09': // 或者使用 '\t'
        this.controlEmitter.fire('Tab');
        notRender = this.isShellIntellActive;
        break;
      case '\r':
      case '\x0D': // Enter 被按下
        if (this.isShellIntellActive) {
          this.controlEmitter.fire('Enter');
          notRender = true;
        } else {
          notRender = true;
          connection.sendData(inputData);
        }
        break;
      case ' ':
        notRender = false;
        if (lastInputData === ' ') {
          notRender = true; // 如果连续多次输入空格，那就不要渲染补全框了
          this.promptEndDecoration?.dispose();
        }
        connection.sendData(inputData);
        break;
      default:
        notRender = !this.isShellIntellActive;
        connection.sendData(inputData);
    }

    return notRender;
  }

  private async renderSuggestions(
    xterm: Terminal,
    connection: ITerminalConnection,
    lineDataString: string,
    cursorX: number,
  ) {
    this.promptEndDecoration?.dispose();

    const suggestionBlob = await this.suggestionProvider.getSuggestions(lineDataString, this.cwd);

    if (!suggestionBlob || !suggestionBlob.suggestions || suggestionBlob.suggestions.length < 1) {
      return;
    }

    this.lastPromptLineString = JSON.stringify(lineDataString);
    this.promptEndDecoration = xterm.registerDecoration({
      marker: this.promptEndMarker!,
      width: 1,
      height: 1,
      x: cursorX,
    });

    const suggestionsViewModel: SuggestionViewModel[] = [
      ...suggestionBlob.suggestions.map((suggestion) => ({
        description: suggestion.description || '',
        command: suggestion.name,
        insertValue: suggestion.insertValue || '',
        icon: suggestion.icon,
      })),
    ];

    this.promptEndDecoration?.onRender((element) =>
      this.renderCompletePopup(xterm, element, suggestionsViewModel, suggestionBlob.charactersToDrop || 0, connection),
    );

    this.promptEndDecoration?.onDispose(() => {
      this.isShellIntellActive = false;

      if (this.completePopupRoot) {
        /**
         * 取消 CompleteList 悬浮框的 React 渲染
         * 目前还需要思考一个更好的方案
         * ----
         * 此处做了一个延时 Dispose 逻辑，为什么要做这个逻辑呢？它背后是有我的良苦用心的。
         * 如果不做延时销毁而是实时销毁的话，每次终端的字符输入都会导致 Decoration 的 Dispose 和重建
         * 此时基于 Decoration 位置定位的补全列表也会经历一次 unmount 和重绘
         * 在终端快速输入字符时，用户的体感就是补全列表在快速闪烁。
         * ----
         * 因此需要再终端快速输入的场景下，不要立即 Dispose 之前的弹框，设置一个 Timeout
         * 如果上一个 Decoration Dispose 之后，立即就有新的 Decoration Render，那么就取消这次 Dispose
         * 这样就可以做到 CompleteList 弹框的复用，在终端快速输入的时候，只做位置的偏移
         */
        clearTimeout(this.completePopupDisposeTimeoutHandler);
        this.completePopupDisposeTimeoutHandler = setTimeout(() => {
          this.completePopupRoot?.unmount();
          this.completePopupRoot = undefined;
          this.isShellIntellActive = false;
        }, 50);
      }
      // 断开 MutationObserver 的观察
      if (this.promptEndDecorationObserver) {
        this.promptEndDecorationObserver.disconnect();
        this.promptEndDecorationObserver = undefined;
      }
    });
  }

  private renderCompletePopup(
    xterm: Terminal,
    element: HTMLElement,
    suggestionsViewModel: SuggestionViewModel[],
    dropCharNum: number,
    connection: ITerminalConnection,
  ) {
    const isElementVisible = (element: HTMLElement | null): boolean => {
      if (!element) {
        return false;
      }

      // 检查元素是否在视口中可见
      const rect = element.getBoundingClientRect();
      const isInViewport =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth);

      if (!isInViewport) {
        return false;
      }

      // 检查元素的 offsetParent，如果为 null 则表示被隐藏
      if (element.offsetParent === null) {
        return false;
      }

      return true;
    };

    const alignAndCheckVisibility = () => {
      // const sourceStyle = window.getComputedStyle(element);
      // if (sourceStyle.display === 'none' || sourceStyle.visibility === 'hidden') {
      //   this.disposeCompletePopup();
      //   return;
      // }

      const isVisible = isElementVisible(element);
      if (!isVisible) {
        this.disposeCompletePopup();
        return;
      }

      const sourceRect = element.getBoundingClientRect();
      const left = sourceRect.left - element.clientWidth + 6;
      const top = sourceRect.bottom - element.clientHeight;

      this.popupContainer.style.position = 'fixed';
      this.popupContainer.style.left = `${left}px`;
      this.popupContainer.style.top = `${top}px`;
    };

    alignAndCheckVisibility();

    if (this.completePopupDisposeTimeoutHandler !== undefined) {
      clearTimeout(this.completePopupDisposeTimeoutHandler);
    }

    if (!this.completePopupRoot) {
      this.completePopupRoot = createRoot(this.popupContainer);
    }

    this.completePopupRoot.render(
      <TerminalIntellCompleteController
        controller={this.controlEmitter}
        suggestions={suggestionsViewModel}
        onSuggestion={(suggestion) => {
          const insertStr = suggestion.substring(dropCharNum);
          this.promptEndDecoration?.dispose();
          this.completePopupRoot?.unmount();
          this.completePopupRoot = undefined;
          this.isShellIntellActive = false;
          xterm.focus();
          connection.sendData(insertStr);
        }}
        onClose={() => {
          this.disposeCompletePopup();
        }}
      />,
    );

    this.isShellIntellActive = true;

    this.observeElementChanges(element, alignAndCheckVisibility);
  }

  private observeElementChanges(element: HTMLElement, callback: () => void) {
    if (this.promptEndDecorationObserver) {
      this.promptEndDecorationObserver.disconnect();
    }

    const observer = new MutationObserver(callback);
    observer.observe(element, { attributes: true, childList: true, subtree: true });
    this.promptEndDecorationObserver = observer;
  }

  private disposePreviousPromptEnd() {
    if (this.promptEndMarker) {
      this.promptEndMarker.dispose();
    }
    if (this.promptEndDecoration) {
      this.promptEndDecoration.dispose();
    }
  }

  // HACK 从 xterm addon 里面拿到终端和后端服务的 stdio 通信链路
  // TODO OpenSumi 提供一个更标准的实现
  private getConnection(xterm: Terminal): ITerminalConnection {
    // @ts-ignore
    // 目前需要强制取用 Addon 的 connection 能力
    const attachAddon = xterm._addonManager._addons.find((addon) => !!addon?.instance?.connection);
    return attachAddon?.instance?.connection as ITerminalConnection;
  }

  private disposeCompletePopup() {
    this.completePopupRoot?.unmount();
    this.completePopupRoot = undefined;
    this.isShellIntellActive = false;
  }

  public closeIntellSettingsPopup() {
    this.intellSettingPopupVisible = false;
    this._onVisibleChange.fire(false);
  }

  public openIntellSettingsPopup() {
    this.intellSettingPopupVisible = true;
    this._onVisibleChange.fire(true);
  }
}
