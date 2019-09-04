import { Terminal } from '../common';

export class TerminalImpl implements Terminal {
  readonly name: string;

  get processId() {
    return Promise.resolve(1);
  }

  sendText(text: string, addNewLine?: boolean) {

  }

  show(preserveFocus?: boolean) {

  }

  hide() {

  }

  dispose() {

  }
}
