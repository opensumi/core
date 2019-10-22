import { Terminal as XTerm } from 'xterm';
import { observable } from 'mobx';
import {
  Terminal,
  TerminalCreateOptions,
  ITerminalClient,
  IExternlTerminalService,
} from '../common';

export class TerminalImpl implements Terminal {
  readonly xterm: XTerm;
  readonly el: HTMLElement;

  private terminalClient: ITerminalClient;
  private terminalService: IExternlTerminalService;
  private _processId: number;

  private serviceInitPromiseResolve;

  serviceInitPromise: Promise<void> | null = new Promise((resolve) => {
    this.serviceInitPromiseResolve = resolve;
  });

  @observable
  name: string;

  id: string;
  isActive: boolean = false;
  isAppendEl: boolean = false;

  constructor(options: TerminalCreateOptions) {
    this.name = options.name || '';

    this.terminalClient = options.terminalClient;
    this.terminalService = options.terminalService;
    this.id = options.id;
    this.xterm = options.xterm;
    this.el = options.el;
  }

  finishServiceInitPromise() {
    if (!this.serviceInitPromiseResolve) {
      return;
    }
    this.serviceInitPromiseResolve();
    this.serviceInitPromiseResolve = null;
    this.serviceInitPromise = null;
  }

  get processId() {
    if (this._processId) {
      return Promise.resolve(this.processId);
    }
    return new Promise(async (resolve) => {
      this._processId = await this.terminalService.getProcessId(this.id) || -1;
      resolve(this.processId);
    });
  }

  setName(name: string) {
    this.name = name || '';
  }

  setProcessId(id: number) {
    this._processId = id;
  }

  sendText(text: string, addNewLine?: boolean) {
    this.terminalClient.sendText(this.id, text + (addNewLine ? `\r` : ''));
  }

  show(preserveFocus?: boolean) {
    this.terminalClient.showTerm(this.id, !!preserveFocus);
  }

  hide() {
    this.terminalClient.hideTerm(this.id);
  }

  appendEl() {
    if (this.isAppendEl) {
      return;
    }
    this.isAppendEl = true;
    this.xterm.open(this.el);
    // @ts-ignore
    this.xterm.webLinksInit();
  }

  dispose() {
    this.el.remove();
    this.terminalService.disposeById(this.id);
  }

  clear() {
    this.xterm.clear();
  }
}
