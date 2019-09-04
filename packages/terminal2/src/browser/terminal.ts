import { Terminal as XTerm } from 'xterm';
import {
  Terminal,
  TerminalCreateOptions,
  ITerminalClient,
  ITerminalService,
} from '../common';

export class TerminalImpl implements Terminal {
  readonly name: string;
  private terminalClient: ITerminalClient;
  private terminalService: ITerminalService;
  private id: string;
  readonly xterm: XTerm;

  isShow: boolean = false;

  constructor(options: TerminalCreateOptions) {
    this.name = options.name || 'unnamed';

    this.terminalClient = options.terminalClient;
    this.terminalService = options.terminalService;
    this.id = options.id;
    this.xterm = options.xterm;
  }

  get processId() {
    // TODO
    return Promise.resolve(1);
  }

  sendText(text: string, addNewLine?: boolean) {
    // TODO
    this.terminalClient.send(this.id, text);
  }

  show(preserveFocus?: boolean) {
    // TODO
    this.isShow = true;
  }

  hide() {
    this.isShow = false;
  }

  dispose() {
    // TODO
  }
}
