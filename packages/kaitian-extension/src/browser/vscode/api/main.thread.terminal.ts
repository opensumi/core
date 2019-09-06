import * as vscode from 'vscode';
import { isUndefined } from '@ali/ide-core-common';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadTerminal, IExtHostTerminal, ExtHostAPIIdentifier } from '../../../common/vscode';
import { ITerminalClient, TerminalInfo } from '@ali/ide-terminal2/lib/common';

@Injectable()
export class MainThreadTerminal implements IMainThreadTerminal {
  private readonly proxy: IExtHostTerminal;

  @Autowired(ITerminalClient)
  private terminalClient: ITerminalClient;

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTerminal);
    this.initData();
    this.bindEvent();
  }

  private bindEvent() {
    this.terminalClient.onDidChangeActiveTerminal((id) => {
      this.proxy.$onDidChangeActiveTerminal(id);
    });
    this.terminalClient.onDidCloseTerminal((id) => {
      this.proxy.$onDidCloseTerminal(id);
    });
    this.terminalClient.onDidOpenTerminal((info: TerminalInfo) => {
      this.proxy.$onDidOpenTerminal(info);
    });
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

  $createTerminal(options: vscode.TerminalOptions, id: string) {
    this.terminalClient.createTerminal(options, id);
  }
}
