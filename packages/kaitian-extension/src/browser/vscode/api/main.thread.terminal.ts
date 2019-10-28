import * as vscode from 'vscode';
import {  IDisposable } from '@ali/ide-core-common';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { Disposable } from '@ali/ide-core-browser';
import { IMainThreadTerminal, IExtHostTerminal, ExtHostAPIIdentifier } from '../../../common/vscode';
import { ITerminalClient, TerminalInfo } from '@ali/ide-terminal2/lib/common';

import { ILogger } from '@ali/ide-core-browser';

@Injectable({multiple: true})
export class MainThreadTerminal implements IMainThreadTerminal {
  private readonly proxy: IExtHostTerminal;

  @Autowired(ITerminalClient)
  private terminalClient: ITerminalClient;
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
    this.disposable.addDispose(this.terminalClient.onDidChangeActiveTerminal((id) => {
      this.proxy.$onDidChangeActiveTerminal(id);
    }));
    this.disposable.addDispose(this.terminalClient.onDidCloseTerminal((id) => {
      this.proxy.$onDidCloseTerminal(id);
    }));
    this.disposable.addDispose(this.terminalClient.onDidOpenTerminal((info: TerminalInfo) => {
      this.proxy.$onDidOpenTerminal(info);
    }));
  }

  private initData() {
    const termMap = this.terminalClient.termMap;
    const infoList: TerminalInfo[] = [];

    termMap.forEach((term) => {
      infoList.push({
        id: term.id,
        name: term.name,
        isActive: term.isActive,
      });
    });

    this.proxy.$setTerminals(infoList);
  }

  $sendText(id: string, text: string, addNewLine?: boolean) {
    return this.terminalClient.sendText(id, text, addNewLine);
  }

  $show(id: string, preserveFocus?: boolean) {
    return this.terminalClient.showTerm(id, preserveFocus);
  }

  $hide(id: string) {
    return this.terminalClient.hideTerm(id);
  }

  $dispose(id: string) {
    return this.terminalClient.removeTerm(id);
  }

  $getProcessId(id: string) {
    return this.terminalClient.getProcessId(id);
  }

  async $createTerminal(options: vscode.TerminalOptions) {
    const terminal = await this.terminalClient.createTerminal(options);
    if (!terminal) {
      return this.logger.error('创建终端失败');
    }
    return terminal.id;
  }
}
