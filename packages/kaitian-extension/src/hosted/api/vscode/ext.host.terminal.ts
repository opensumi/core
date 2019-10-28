import * as vscode from 'vscode';
import { Event, isObject, uuid, Emitter, getLogger, isUndefined } from '@ali/ide-core-common';
import { IRPCProtocol } from '@ali/ide-connection';
import { TerminalInfo } from '@ali/ide-terminal2/lib/common';
import { IMainThreadTerminal, MainThreadAPIIdentifier, IExtHostTerminal } from '../../../common/vscode';

const debugLog = getLogger();

export class ExtHostTerminal implements IExtHostTerminal {
  private proxy: IMainThreadTerminal;
  private changeActiveTerminalEvent: Emitter<vscode.Terminal | undefined> = new Emitter();
  private closeTerminalEvent: Emitter<vscode.Terminal> = new Emitter();
  private openTerminalEvent: Emitter<vscode.Terminal> = new Emitter();
  private terminalsMap: Map<string, vscode.Terminal> = new Map();

  activeTerminal: vscode.Terminal;
  get terminals(): vscode.Terminal[] {
    return Array.from(this.terminalsMap.values());
  }

  constructor(rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadTerminal);
  }

  $onDidChangeActiveTerminal(id: string) {
    const terminal = this.terminalsMap.get(id);
    this.activeTerminal = terminal!;
    this.changeActiveTerminalEvent.fire(terminal);
  }

  get onDidChangeActiveTerminal(): Event<vscode.Terminal | undefined>  {
    return this.changeActiveTerminalEvent.event;
  }

  $onDidCloseTerminal(id: string) {
    const terminal = this.terminalsMap.get(id);
    if (!terminal) {
      return debugLog.error('没有找到终端');
    }
    this.terminalsMap.delete(id);
    this.closeTerminalEvent.fire(terminal);
  }

  get onDidCloseTerminal(): Event<vscode.Terminal> {
    return this.closeTerminalEvent.event;
  }

  $onDidOpenTerminal(info: TerminalInfo) {
    let terminal = this.terminalsMap.get(info.id);

    if (!terminal) {
      terminal = new Terminal(info.name, this.proxy, info.id);
      this.terminalsMap.set(info.id, terminal);
    }
    this.openTerminalEvent.fire(terminal);
  }

  get onDidOpenTerminal(): Event<vscode.Terminal> {
    return this.openTerminalEvent.event;
  }

  createTerminal = (
    optionsOrName?: vscode.TerminalOptions | string,
    shellPath?: string,
    shellArgs?: string[] | string,
  ): vscode.Terminal  => {
    let options: vscode.TerminalOptions = {};

    if (isObject(optionsOrName)) {
      options = optionsOrName as vscode.TerminalOptions;
    } else {
      if (optionsOrName) {
        options.name = optionsOrName;
      }
      if (shellPath) {
        options.shellPath = shellPath;
      }
      if (shellArgs) {
        options.shellArgs = shellArgs;
      }
    }
    const terminal = new Terminal(options.name || '', this.proxy);
    this.proxy.$createTerminal(options).then((id) => {
      terminal.created(id);
    });
    // 插件API 同步提供 terminal 实例
    return terminal;
  }

  $setTerminals(idList: TerminalInfo[]) {
    idList.forEach((info: TerminalInfo) => {
      if (this.terminalsMap.get(info.id)) {
        return;
      }
      const terminal =  new Terminal(info.name, this.proxy, info.id);
      if (info.isActive) {
        this.activeTerminal = terminal;
      }
      if (this.terminalsMap.get(info.id)) {
        return;
      }
      this.terminalsMap.set(info.id, terminal);
    });
  }

  dispose() {
    this.changeActiveTerminalEvent.dispose();
    this.closeTerminalEvent.dispose();
    this.openTerminalEvent.dispose();
  }
}

export class Terminal implements vscode.Terminal {
  readonly name: string;

  private id: string;
  private proxy: IMainThreadTerminal;

  private createdPromiseResolve;

  private when: Promise<any> = new Promise((resolve) => {
    this.createdPromiseResolve = resolve;
  });

  constructor(name: string, proxy: IMainThreadTerminal, id?: string) {
    this.proxy = proxy;
    this.name = name;
    if (!isUndefined(id)) {
      this.created(id);
    }
  }

  get processId(): Thenable<number> {
    return this.when.then(() => {
      return this.proxy.$getProcessId(this.id);
    });
  }

  sendText(text: string, addNewLine?: boolean): void {
    this.when.then(() => {
      this.proxy.$sendText(this.id, text, addNewLine);
    });
  }

  show(preserveFocus?: boolean): void {
    this.when.then(() => {
      this.proxy.$show(this.id, preserveFocus);
    });
  }

  hide(): void {
    this.when.then(() => {
      this.proxy.$hide(this.id);
    });
  }

  created(id) {
    this.id = id;
    this.createdPromiseResolve();
  }

  dispose(): void {
    this.proxy.$dispose(this.id);
  }
}
