/* eslint-disable no-console */
import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { IDecoration, IDisposable, IMarker, Terminal } from 'xterm';

import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter } from '@opensumi/ide-core-common';

import { ITerminalController } from '../../common/controller';
import { ITerminalConnection } from '../../common/index';
import { ITerminalSuggestionProvider, ITerminalSuggestionProviderPath } from '../../common/intell/runtime';
import { TerminalIntellCompleteController } from '../component/terminal-intell-complete-controller';

// import { fsAsyncStub } from './runtime/template';

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

  private controlEmitter = new Emitter<string>();

  private popupContainer: HTMLDivElement; // AI 终端下拉补全的弹出框容器

  private promptEndMarker: IMarker | undefined;
  private promptEndDecoration: IDecoration | undefined;
  private onDataDisposable: IDisposable;
  private cwd: string = '';

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
    this.popupContainer.style.zIndex = '9';
    document.body.appendChild(this.popupContainer);
  }

  private listenTerminalEvent(clientId: string) {
    const client = this.terminalController.clients.get(clientId);

    if (client) {
      try {
        this.listenPromptState(client.term);
      } catch (e) {
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
    this.disposePreviousPromptEnd();
    this.promptEndMarker = xterm.registerMarker(0);
    const xOffset2 = xterm.buffer.active.cursorX;

    if (this.onDataDisposable) {
      this.onDataDisposable.dispose();
    }

    const connection = this.getConnection(xterm);
    connection.readonly = true;

    this.onDataDisposable = xterm.onData(async (e) => {
      // 稍微 settimeout 一下，等待终端渲染
      setTimeout(async () => {
        const notRender = this.handleKeyPress(e, connection);

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

  private handleKeyPress(e: string, connection: ITerminalConnection): boolean {
    let notRender = false;

    switch (e) {
      case '\x1b':
        console.log('ESC 键被按下');
        this.controlEmitter.fire('Escape');
        break;
      case '\x1b[A':
        console.log('上方向键被按下');
        this.controlEmitter.fire('ArrowUp');
        notRender = true;
        break;
      case '\x1b[B':
        console.log('下方向键被按下');
        this.controlEmitter.fire('ArrowDown');
        notRender = true;
        break;
      case '\t':
      case '\x09': // 或者使用 '\t'
        console.log('Tab 键被按下');
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
          connection.sendData(e);
        }
        console.log('Enter 键被按下');
        break;
      default:
        notRender = !this.isShellIntellActive;
        connection.sendData(e);
    }

    return notRender;
  }

  private async renderSuggestions(
    xterm: Terminal,
    connection: ITerminalConnection,
    lineDataString: string,
    cursorX: number,
  ) {
    // fsAsyncStub.setProxy({
    //   readdir: async (cwd: string, options: { withFileTypes: true }) => {
    //     const res = await this.diskFileProvider.readDirectory(Uri.file(cwd));
    //     const files = res.map(([name, type]) => ({
    //       name,
    //       isFile: () => type === FileType.File,
    //       isDirectory: () => type === FileType.Directory,
    //     }));
    //     console.log('readdir', cwd, options, res, files);
    //     return files;
    //   },
    // });

    this.promptEndDecoration?.dispose();

    const suggestionBlob = await this.suggestionProvider.getSuggestions(lineDataString, this.cwd);

    if (!suggestionBlob || !suggestionBlob.suggestions) {
      return;
    }

    this.lastPromptLineString = JSON.stringify(lineDataString);
    this.promptEndDecoration = xterm.registerDecoration({
      marker: this.promptEndMarker,
      width: 1,
      height: 1,
      x: cursorX,
    });

    console.log('suggestions: ', suggestionBlob.suggestions, 'hint: ', lineDataString);
    const suggestionsViewModel = [
      ...suggestionBlob.suggestions.map((suggestion) => ({
        description: suggestion.description || '',
        command: suggestion.name,
        icon: suggestion.icon,
      })),
    ];

    this.promptEndDecoration?.onRender((element) =>
      this.renderCompletePopup(element, suggestionsViewModel, suggestionBlob.charactersToDrop || 0, connection),
    );

    this.promptEndDecoration?.onDispose(() => {
      console.log('dispose react component');
      this.isShellIntellActive = false;

      if (this.completePopupRoot) {
        /**
         * 取消 CompleteList 悬浮框的 React 渲染
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
    element: HTMLElement,
    suggestionsViewModel: any,
    dropCharNum: number,
    connection: ITerminalConnection,
  ) {
    const alignAndCheckVisibility = () => {
      const sourceStyle = window.getComputedStyle(element);
      if (sourceStyle.display === 'none' || sourceStyle.visibility === 'hidden') {
        this.disposeCompletePopup();
        return;
      }

      const sourceRect = element.getBoundingClientRect();
      const left = sourceRect.left - element.clientWidth - 6;
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
          connection.sendData(insertStr);
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

  private getConnection(xterm: Terminal): ITerminalConnection {
    // @ts-ignore
    // 目前需要强制取用 Addon 的 connection 能力
    const attachAddon = xterm._addonManager._addons.find((addon) => !!addon?.instance?.connection);
    return attachAddon?.instance?.connection as ITerminalConnection;
  }

  private disposeCompletePopup() {
    this.completePopupRoot?.unmount();
    this.completePopupRoot = undefined;
  }
}
