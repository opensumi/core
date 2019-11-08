import { Disposable } from '@ali/ide-core-common';
import { Terminal, ITerminalOptions } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { AttachAddon } from 'xterm-addon-attach';
import { ITerminalExternalService } from '../common';

export class TerminalTheme {

}

export class TerminalClient extends Disposable {
  private _container: HTMLDivElement;
  private _term: Terminal;
  private _uid: string;

  // add on
  private _fitAddon: FitAddon;
  private _attachAddon: AttachAddon;

  private _attached: boolean;
  private _activated: boolean;

  private showPromiseResolve: (() => void) | null;
  private focusPromiseResolve: (() => void) | null;

  static defaultOptions: ITerminalOptions = {
    macOptionIsMeta: false,
    cursorBlink: false,
    scrollback: 2500,
    tabStopWidth: 8,
    fontSize: 12,
  };

  constructor(protected readonly service: ITerminalExternalService) {
    super();

    this._attached = false;
    this._activated = false;
    this._uid = this.service.makeId();
    this._term = new Terminal({
      ...TerminalClient.defaultOptions,
      ...this.service.getOptions(),
    });
    this._fitAddon = new FitAddon();
    this._term.loadAddon(this._fitAddon);
    this._events();
  }

  get term() {
    return this._term;
  }

  get container() {
    return this._container;
  }

  get id() {
    return this._uid;
  }

  get attached() {
    return this._attached;
  }

  get activated() {
    return this._activated;
  }

  applyDomNode(dom: HTMLDivElement) {
    this._container = dom;
  }

  private _doAttach(socket: WebSocket) {
    this._attachAddon = new AttachAddon(socket);
    this._term.loadAddon(this._attachAddon);
  }

  async attach() {
    if (!this._attached) {
      return this.service.attach(this.term,
        (socket: WebSocket) => this._doAttach(socket))
        .then(() => {
          if (this.showPromiseResolve) {
            this.showPromiseResolve();
            this.showPromiseResolve = null;
          }
          this._attached = true;
        });
    }
    return Promise.resolve();
  }

  private _doShow() {
    if (this._container) {
      if (this._activated) {
        this.container.style.display = 'block';
      } else {
        this._term.open(this._container);
        this._fitAddon.fit();
        this._activated = true;
        if (this.focusPromiseResolve) {
          this.focusPromiseResolve();
          this.focusPromiseResolve = null;
        }
      }
    }
  }

  async show(): Promise<void> {
    if (this._attached) {
      this._doShow();
    } else {
      if (!this.showPromiseResolve) {
        return new Promise((resolve) => {
          this.showPromiseResolve = resolve;
        }).then(() => {
          this._doShow();
        });
      }
    }
    return Promise.resolve();
  }

  private _doFocus() {
    this._term.focus();
  }

  async focus(): Promise<void> {
    if (this._activated) {
      this._doFocus();
    } else {
      if (!this.focusPromiseResolve) {
        return new Promise((resolve) => {
          this.focusPromiseResolve = resolve;
        }).then(() => {
          this._doFocus();
        });
      }
    }
    return Promise.resolve();
  }

  hide() {
    if (this._container) {
      this._container.innerHTML = '';
    }
    this._activated = false;
  }

  async sendText(message: string) {
    return this.service.sendText(this.id, message);
  }

  private _events() {
    this._term.onResize((event) => {
      const { cols, rows } = event;
      this.service.resize(cols, rows);
    });

    this._term.onTitleChange((title) => {
      console.log(title);
    });
  }
}
