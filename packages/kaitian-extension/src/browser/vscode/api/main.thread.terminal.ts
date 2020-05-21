import * as vscode from 'vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { Disposable } from '@ali/ide-core-browser';
import { ITerminalApiService, ITerminalController, ITerminalInfo } from '@ali/ide-terminal-next';
import { IMainThreadTerminal, IExtHostTerminal, ExtHostAPIIdentifier } from '../../../common/vscode';

import { ILogger } from '@ali/ide-core-browser';

@Injectable({multiple: true})
export class MainThreadTerminal implements IMainThreadTerminal {
  private readonly proxy: IExtHostTerminal;

  @Autowired(ITerminalApiService)
  private terminalApi: ITerminalApiService;

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
    this.disposable.addDispose(this.terminalApi.onDidChangeActiveTerminal((id) => {
      this.proxy.$onDidChangeActiveTerminal(id);
    }));
    this.disposable.addDispose(this.terminalApi.onDidCloseTerminal((id) => {
      this.proxy.$onDidCloseTerminal(id);
    }));
    this.disposable.addDispose(this.terminalApi.onDidOpenTerminal((info: ITerminalInfo) => {
      this.proxy.$onDidOpenTerminal(info);
    }));
  }

  private initData() {
    const terminals = this.terminalApi.terminals;
    const infoList: ITerminalInfo[] = [];

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
    return this.terminalApi.sendText(id, text, addNewLine);
  }

  $show(id: string, preserveFocus?: boolean) {
    return this.terminalApi.showTerm(id, preserveFocus);
  }

  $hide(id: string) {
    return this.terminalApi.hideTerm(id);
  }

  $dispose(id: string) {
    return this.terminalApi.removeTerm(id);
  }

  $getProcessId(id: string) {
    return this.terminalApi.getProcessId(id);
  }

  async $createTerminal(options: vscode.TerminalOptions) {
    await this.controller.ready.promise;
    const terminal = await this.terminalApi.createTerminal(options);
    if (!terminal) {
      return this.logger.error('创建终端失败');
    }
    return terminal.id;
  }
}
