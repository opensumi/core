import { Disposable, ThrottledDelayer } from '@ali/ide-core-common';
import { Terminal, ITerminalOptions } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { AttachAddon } from 'xterm-addon-attach';
import { ITerminalExternalService, IWidget } from '../common';
import { ITerminalTheme } from './terminal.theme';

export class TerminalClient extends Disposable {
  private _container: HTMLDivElement;
  private _term: Terminal;
  private _uid: string;
  private _widget: IWidget;

  // add on
  private _fitAddon: FitAddon;
  private _attachAddon: AttachAddon;

  private _layer = new ThrottledDelayer<void>(50);
  private _pageHideDelay = new ThrottledDelayer<void>(200);

  private _attached: boolean;
  private _activated: boolean;
  private _disposed: boolean;

  private focusPromiseResolve: (() => void) | null;
  private showPromiseResolve: (() => void) | null;

  static defaultOptions: ITerminalOptions = {
    macOptionIsMeta: false,
    cursorBlink: false,
    scrollback: 2500,
    tabStopWidth: 8,
    fontSize: 12,
  };

  constructor(
    protected readonly service: ITerminalExternalService,
    protected readonly theme: ITerminalTheme,
    widget: IWidget,
    restoreId?: string,
  ) {
    super();

    this._attached = false;
    this._activated = false;
    this._disposed = false;
    this._uid = restoreId || this.service.makeId();
    this._widget = widget;
    this._term = new Terminal({
      theme: this.theme.terminalTheme,
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

  get widget() {
    return this._widget;
  }

  applyDomNode(dom: HTMLDivElement) {
    this._container = dom;
  }

  private _doAttach(socket: WebSocket) {
    this._attachAddon = new AttachAddon(socket);
    this._term.loadAddon(this._attachAddon);
    this._attached = true;

    if (this.showPromiseResolve) {
      this.showPromiseResolve();
      this.showPromiseResolve = null;
    }
  }

  private _checkPageHide(callback: () => Promise<void>) {
    if (document.hidden) {
      return this._pageHideDelay.trigger(() => {
        this._checkPageHide(callback);
        return Promise.resolve();
      });
    } else {
      return callback();
    }
  }

  async attach(restore: boolean = false, meta: string = '') {
    if (this._disposed) {
      return;
    }

    if (!this._attached) {
      return this._checkPageHide(() => {
        return this.service.attach(this.id, this.term, restore, meta,
          (socket: WebSocket) => this._doAttach(socket));
      });
    } else {
      return Promise.resolve();
    }
  }

  private _doShow() {
    if (this._container) {
      if (!this._activated) {
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

  async show() {
    if (this._disposed) {
      return;
    }

    if (this._attached) {
      this._doShow();
    } else {
      return new Promise((resolve) => {
        this.showPromiseResolve = resolve;
      }).then(() => {
        this._doShow();
      });
    }
  }

  layout() {
    if (this._disposed || !this._activated) {
      return;
    }

    this._layer.trigger(() => {
      this._fitAddon.fit();
      return Promise.resolve();
    });
  }

  private _doFocus() {
    this._term.focus();
  }

  async focus() {
    if (this._disposed || !this._activated) {
      return;
    }

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
    if (this._disposed || !this._activated) {
      return;
    }

    if (this._container) {
      this._container.innerHTML = '';
    }
    this._activated = false;
  }

  async sendText(message: string) {
    if (this._disposed) {
      return;
    }

    return this.service.sendText(this.id, message);
  }

  private _events() {
    this.addDispose(this._term.onResize((event) => {
      const { cols, rows } = event;
      this.service.resize(this.id, cols, rows);
    }));
  }

  dispose() {
    super.dispose();

    this._activated = false;
    this._attached = false;
    this.focusPromiseResolve = null;
    this._layer && this._layer.dispose();
    this._fitAddon && this._fitAddon.dispose();
    this._attachAddon && this._attachAddon.dispose();
    this._term && this._term.dispose();

    if (this._container) {
      this._container.innerHTML = '';
    }

    this._disposed = true;
  }
}
