import * as vscode from 'vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { Disposable } from '@ali/ide-core-browser';
import { ITerminalController, TerminalInfo } from '@ali/ide-terminal-next/lib/common';
import { IMainThreadTerminal, IExtHostTerminal, ExtHostAPIIdentifier } from '../../../common/vscode';

import { ILogger } from '@ali/ide-core-browser';

@Injectable({multiple: true})
export class MainThreadTerminal implements IMainThreadTerminal {
  private readonly proxy: IExtHostTerminal;

  @Autowired(ITerminalController)
  private controller: ITerminalController;
  private disposable = new Disposable();

  @Autowired(ILogger)
  logger: ILogger;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTerminal);
    this.initData();
    this.bindEvent();
  }

  public dispose() {
    this.disposable.dispose();
  }

  private bindEvent() {
    this.disposable.addDispose(this.controller.onDidChangeActiveTerminal((id) => {
      this.proxy.$onDidChangeActiveTerminal(id);
    }));
    this.disposable.addDispose(this.controller.onDidCloseTerminal((id) => {
      this.proxy.$onDidCloseTerminal(id);
    }));
    this.disposable.addDispose(this.controller.onDidOpenTerminal((info: TerminalInfo) => {
      this.proxy.$onDidOpenTerminal(info);
    }));
  }

  private initData() {
    const terminals = this.controller.terminals;
    const infoList: TerminalInfo[] = [];

    terminals.forEach((term) => {
      infoList.push({
        id: term.id,
        name: term.name,
        isActive: term.isActive,
      });
    });

    this.proxy.$setTerminals(infoList);
  }

  $sendText(id: string, text: string, addNewLine?: boolean) {
    return this.controller.sendText(id, text, addNewLine);
  }

  $show(id: string, preserveFocus?: boolean) {
    return this.controller.showTerm(id, preserveFocus);
  }

  $hide(id: string) {
    return this.controller.hideTerm(id);
  }

  $dispose(id: string) {
    return this.controller.removeTerm(id);
  }

  $getProcessId(id: string) {
    return this.controller.getProcessId(id);
  }

  async $createTerminal(options: vscode.TerminalOptions) {
    const terminal = await this.controller.createTerminal(options);
    if (!terminal) {
      return this.logger.error('创建终端失败');
    }
    return terminal.id;
  }
}
