import { isUndefined } from '@ali/ide-core-common';
import { Terminal as XTerm } from 'xterm';
import { observable } from 'mobx';
import {
  Terminal,
  TerminalCreateOptions,
  ITerminalClient,
  ITerminalService,
} from '../common';

export class TerminalImpl implements Terminal {
  readonly xterm: XTerm;
  readonly el: HTMLElement;

  private terminalClient: ITerminalClient;
  private terminalService: ITerminalService;
  private _processId: number;

  @observable
  name: string;

  id: string;
  isActive: boolean = false;

  constructor(options: TerminalCreateOptions) {
    this.name = options.name || '';

    this.terminalClient = options.terminalClient;
    this.terminalService = options.terminalService;
    this.id = options.id;
    this.xterm = options.xterm;
    this.el = options.el;

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
    this.name = name;
  }

  setProcessId(id: number) {
    this._processId = id;
  }

  sendText(text: string, addNewLine?: boolean) {
    if (isUndefined(addNewLine)) {
      addNewLine = true;
    }
    this.terminalClient.send(this.id, text + (addNewLine ? `\r\n` : ''));
  }

  show(preserveFocus?: boolean) {
    this.terminalClient.showTerm(this.id, !!preserveFocus);
  }

  hide() {
    this.terminalClient.hideTerm(this.id);
  }

  dispose() {
    this.el.remove();
    this.terminalService.disposeById(this.id);
  }
}
