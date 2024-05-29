/* eslint-disable no-console */
import React from 'react';
import { Root, createRoot } from 'react-dom/client';
import { IDecoration, IDisposable, IMarker, Terminal } from 'xterm';

import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter, FileType, Uri } from '@opensumi/ide-core-common';
import { DiskFileServicePath, IDiskFileProvider } from '@opensumi/ide-file-service';

import { ITerminalController } from '../../common/controller';
import { ITerminalConnection } from '../../common/index';
import { TerminalIntellCompleteController } from '../component/terminal-intell-complete-controller';

import { getSuggestions } from './runtime/runtime';
import { fsAsyncStub } from './runtime/template';
// @ts-ignore
// import Fig from '@withfig/autocomplete-types';

// 基于 PS1 Hack 的终端 AI 能力集成

enum IstermOscPt {
  PromptStarted = 'PS',
  PromptEnded = 'PE',
  CurrentWorkingDirectory = 'CWD',
}

@Injectable()
export class IntellTerminalService extends Disposable {
  @Autowired(ITerminalController)
  private terminalController: ITerminalController;

  @Autowired(DiskFileServicePath)
  private diskFileProvider: IDiskFileProvider;

  private controlEmitter = new Emitter<string>();

  private popupContainer: HTMLDivElement; // AI 终端下拉补全的弹出框容器

  private promptEndMarker: IMarker | undefined;
  private promptEndDecoration: IDecoration | undefined;
  private onDataDisposable: IDisposable;

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
    this.popupContainer.style.zIndex = "9";
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
    // HACK 不知道注入这么多空行是否合理？
    // this.writeNewLines(xterm, xterm.rows);

    xterm.parser.registerOscHandler(6973, (data) => {
      const argsIndex = data.indexOf(';');
      const sequence = argsIndex === -1 ? data : data.substring(0, argsIndex);

      switch (sequence) {
        case IstermOscPt.PromptStarted:
          // this.handlePromptStart(xterm);
          break;
        case IstermOscPt.PromptEnded:
          this.handlePromptEnd(xterm);
          break;
        default:
          return false;
      }
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

    // HACK: 这里拿去 TerminalConnection 的方式很 Hack，看看有没有更好的办法？
    // @ts-ignore
    const attachAddon = xterm._addonManager._addons.find((addon) => !!addon?.instance?.connection);

    // Hack Attachaddon
    const connection = attachAddon?.instance?.connection as ITerminalConnection;

    // HACK: hack readonly 避免 attachAddon 发送数据到后端，后面需要做个 onData 的拦截逻辑
    connection.readonly = true;

    this.onDataDisposable = xterm.onData(async (e) => {
      setTimeout(async () => {
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
              // 如果对话框被激活的话，不触发 pty 的 Enter 事件，转发到对话框里面
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
            // console.log('其他按键输入:', e);
            connection.sendData(e);
            attachAddon?.instance?._onInput?.fire(e);
        }

        console.log('e', JSON.stringify(e));
        if (e === '\x1b' && this.promptEndDecoration) {
          console.log('promptEndDecoration dispose');
          this.promptEndDecoration.dispose();
          return;
        }
        // 获取当前活动缓冲区
        const buffer = xterm.buffer.active;

        // 获取光标位置
        const cursorX = buffer.cursorX;

        const lineData = buffer.getLine(this.promptEndMarker?.line || 0);
        const lineDataString = lineData?.translateToString(false, xOffset2, cursorX);
        console.log('lineDataString', JSON.stringify(lineDataString));

        // 避免 上下方向键导致重复渲染
        // if (JSON.stringify(lineDataString) === this.lastPromptLineString) {
        //   console.log('Terminal Buffer 数据相同，不需要重新渲染');
        //   notReRender = true;
        // } else {
        //   notReRender = false;
        // }

        if (notRender) {
          return;
        }

        if (lineDataString && this.promptEndMarker) {
          fsAsyncStub.setProxy({
            readdir: async (cwd: string, options: { withFileTypes: true }) => {
              const res = await this.diskFileProvider.readDirectory(Uri.file(cwd));
              const files = res.map(([name, type]) => ({
                name,
                isFile: () => type === FileType.File,
                isDirectory: () => type === FileType.Directory,
              }));
              console.log('readdir', cwd, options, res, files);
              return files;
            },
          });

          const suggestionBlob = await getSuggestions(lineDataString, '/home/admin/retrox.jcy/cloud-ide/api-server');

          console.log('suggestionBlob', suggestionBlob, 'lineDataString', JSON.stringify(lineDataString));
          this.promptEndDecoration?.dispose();

          if (suggestionBlob && suggestionBlob.suggestions) {
            this.lastPromptLineString = JSON.stringify(lineDataString);
            this.promptEndDecoration = xterm.registerDecoration({
              marker: this.promptEndMarker,
              width: 1,
              // backgroundColor: '#2472C8',
              height: 1,
              x: cursorX,
            });
            console.log('render termianl intell react component');
            const suggestionsViewModel = [
              ...suggestionBlob.suggestions.map((suggestion) => ({
                description: suggestion.description || '',
                command: suggestion.name,
                icon: suggestion.icon,
              })),
            ];

            this.promptEndDecoration?.onRender((element) => {
              console.log('render terminal promptEndDecoration', element);

              const domWidth = element.clientWidth;
              const domHeight = element.clientHeight;

              // if (this.promptEndReactRoot) {
              //   this.promptEndReactRoot.unmount();
              // };

              const alignAndCheckVisibility = () => {
                const sourceStyle = window.getComputedStyle(element);

                if (sourceStyle.display === 'none' || sourceStyle.visibility === 'hidden') {
                  if (this.completePopupRoot) {
                    this.completePopupRoot.unmount();
                  }
                  return;
                }

                const sourceRect = element.getBoundingClientRect();

                const left = sourceRect.left - domWidth - 6;
                const top = sourceRect.bottom - domHeight;

                this.popupContainer.style.position = 'fixed';
                this.popupContainer.style.left = `${left}px`;
                this.popupContainer.style.top = `${top}px`;
              };

              alignAndCheckVisibility();

              console.log('completePopupRoot unmount clear', this.completePopupDisposeTimeoutHandler);
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
                    const dropCharNum = suggestionBlob.charactersToDrop || 0;
                    const insertStr = suggestion.substring(dropCharNum);
                    this.promptEndDecoration?.dispose();
                    this.completePopupRoot?.unmount();
                    this.completePopupRoot = undefined;
                    connection.sendData(insertStr);
                  }}
                />,
              );

              if (this.promptEndDecorationObserver) {
                this.promptEndDecorationObserver.disconnect();
              }

              // 使用 MutationObserver 动态检测
              const observer = new MutationObserver(alignAndCheckVisibility);
              observer.observe(element, { attributes: true, childList: true, subtree: true });

              this.isShellIntellActive = true;

              // 存储 observer 以便在 onDispose 中断开观察
              this.promptEndDecorationObserver = observer;
            });

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
        }
      }, 50);
    });
  }

  private disposeCompletePopup() {
    this.completePopupRoot?.unmount();
    this.completePopupRoot = undefined;
  }

}
