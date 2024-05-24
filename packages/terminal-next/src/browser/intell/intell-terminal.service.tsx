import React from 'react';
import ReactDOM from 'react-dom';
import { IDecoration, IDisposable, IMarker, Terminal } from 'xterm';

import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter, FileType, Uri } from '@opensumi/ide-core-common';
import { DiskFileServicePath, IDiskFileProvider } from '@opensumi/ide-file-service';
import {
  ITerminalConnection,
  ITerminalController,
} from '@opensumi/ide-terminal-next';

import { TerminalIntellCommandController } from '../component/terminal-intell-command-controller';

import { getSuggestions } from './runtime/runtime';
import { fsAsyncStub } from './runtime/template';
// @ts-ignore
// import Fig from '@withfig/autocomplete-types';

// 基于 PS1 Hack 的终端 AI 能力集成

enum IstermOscPt {
  PromptStarted = 'PS',
  PromptEnded = 'PE',
  CurrentWorkingDirectory = 'CWD'
}

@Injectable()
export class IntellTerminalService extends Disposable {
  @Autowired(ITerminalController)
  private terminalController: ITerminalController;

  @Autowired(DiskFileServicePath)
  private diskFileProvider: IDiskFileProvider;

  private controlEmitter = new Emitter<string>();

  private popupContainer: HTMLDivElement; // AI 终端提示 弹出框容器

  private promptStartMarker: IMarker | undefined;
  private promptStartDecoration: IDecoration | undefined;
  private promptEndMarker: IMarker | undefined;
  private promptEndDecoration: IDecoration | undefined;
  private onDataDisposable: IDisposable;

  private lastPromptLineString: string;
  private isShellIntellActive: boolean;

  private currentSessionId: string;

  public active() {
    this.disposables.push(
      this.terminalController.onDidOpenTerminal(({ id }) =>
        this.listenTerminalEvent(id),
      ),
    );
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

  private writeNewLines(terminal: Terminal, numberOfLines: number) {
    let newLines = '';
    for (let i = 0; i < numberOfLines; i++) {
      newLines += '\n';
    }
    terminal.write(newLines);
  }

  private listenPromptState(xterm: Terminal) {
    // HACK 不知道注入这么多空行是否合理？
    this.writeNewLines(xterm, xterm.rows);

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

    window.getSuggestions = getSuggestions;

    // HACK: 这里拿去 TerminalConnection 的方式很 Hack，看看有没有更好的办法？
    // @ts-ignore
    const attachAddon = xterm._addonManager._addons.find((addon) => !!addon?.instance?.connection);

    // Hack Attachaddon
    const connection = attachAddon?.instance?.connection as ITerminalConnection;

    // HACK: hack readonly 避免 attachAddon 发送数据到后端，后面需要做个 onData 的拦截逻辑
    connection.readonly = true;

    let notReRender = false;

    this.onDataDisposable = xterm.onData(async (e) => {
      console.time('Terminal onData');
      switch (e) {
        case '\x1b':
          console.log('ESC 键被按下');
          this.controlEmitter.fire('Escape');
          break;
        case '\x1b[A':
          console.log('上方向键被按下');
          this.controlEmitter.fire('ArrowUp');
          notReRender = true;
          break;
        case '\x1b[B':
          console.log('下方向键被按下');
          this.controlEmitter.fire('ArrowDown');
          notReRender = true;
          break;
        case '\t':
        case '\x09': // 或者使用 '\t'
          console.log('Tab 键被按下');
          this.controlEmitter.fire('Tab');
          notReRender = this.isShellIntellActive;
          break;
        case '\r':
        case '\x0D':
          if (this.isShellIntellActive) {
            // 如果对话框被激活的话，不触发 pty 的 Enter 事件，转发到对话框里面
            this.controlEmitter.fire('Enter');
          } else {
            connection.sendData(e);
          }
          console.log('Enter 键被按下');

          break;
        default:
          // console.log('其他按键输入:', e);
          connection.sendData(e);
          attachAddon?.instance?._onInput?.fire(e);
      }

      console.log('e', JSON.stringify(e));
      if (e === '\x1b' && this.promptEndDecoration) {
        console.log('promptEndDecoration dispose');
        console.timeEnd('Term onData');
        this.promptEndDecoration.dispose();
        return;
      }
      // 获取当前活动缓冲区
      const buffer = xterm.buffer.active;

      // 获取光标位置
      const cursorX = buffer.cursorX;
      const cursorY = buffer.cursorY;

      const lineData = buffer.getLine(this.promptEndMarker?.line || 0);
      const lineDataString = lineData?.translateToString(
        false,
        xOffset2,
        cursorX,
      );
      console.log('lineDataString', lineDataString);

      // 避免 上下方向键导致重复渲染
      // if (JSON.stringify(lineDataString) === this.lastPromptLineString) {
      //   console.log('Terminal Buffer 数据相同，不需要重新渲染')
      //   return;
      // }

      if (notReRender) {
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

        const suggestionBlob = await getSuggestions(
          lineDataString,
          '/home/admin/retrox.jcy/cloud-ide/api-server',
        );

        console.log(
          'suggestionBlob',
          suggestionBlob,
          'lineDataString',
          JSON.stringify(lineDataString),
        );
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
          const suggestionsViewModel = [...suggestionBlob.suggestions.map((suggestion) => ({
              description: suggestion.description || '',
              command: suggestion.name,
            }))];
          this.promptEndDecoration?.onRender((element) => {
            ReactDOM.render(
              <TerminalIntellCommandController
                controller={this.controlEmitter}
                suggestions={suggestionsViewModel}
                onSuggestion={(suggestion) => {
                  const dropCharNum = suggestionBlob.charactersToDrop || 0;
                  const insertStr = suggestion.substring(dropCharNum);
                  connection.sendData(insertStr);
                  this.promptEndDecoration?.dispose();
                }}
              />,
              element,
            );
            this.isShellIntellActive = true;
          });
          this.promptEndDecoration?.onDispose(() => {
            if (this.promptEndDecoration?.element) {
              this.isShellIntellActive = false;
              console.log('dispose react component');
              ReactDOM.unmountComponentAtNode(this.promptEndDecoration?.element);
            }
          });
        }
      }
      console.timeEnd('Term onData');
    });
  }
}
