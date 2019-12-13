import { Disposable, ThrottledDelayer } from '@ali/ide-core-common';
import { Terminal, ITerminalOptions } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { AttachAddon } from 'xterm-addon-attach';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { ITerminalExternalService, IWidget, TerminalOptions, ITerminalController } from '../common';
import { ITerminalTheme } from './terminal.theme';
import * as styles from './terminal.module.less';

export class TerminalClient extends Disposable {
  private _container: HTMLDivElement;
  private _term: Terminal;
  private _uid: string;
  private _pid: number;
  private _widget: IWidget;
  private _name: string;
  private _options: TerminalOptions;

  // add on
  private _fitAddon: FitAddon;
  private _attachAddon: AttachAddon;

  private _layer = new ThrottledDelayer<void>(50);

  private _attached: boolean;
  private _activated: boolean;
  private _disposed: boolean;

  private focusPromiseResolve: (() => void) | null;
  private showPromiseResolve: (() => void) | null;
  private attachPromise: Promise<void> | null = null;

  static defaultOptions: ITerminalOptions = {
    allowTransparency: true,
    macOptionIsMeta: false,
    cursorBlink: false,
    scrollback: 2500,
    tabStopWidth: 8,
    fontSize: 12,
  };

  constructor(
    protected readonly service: ITerminalExternalService,
    protected theme: ITerminalTheme,
    protected readonly controller: ITerminalController,
    widget: IWidget,
    restoreId?: string,
    options?: TerminalOptions,
  ) {
    super();
    this._attached = false;
    this._activated = false;
    this._disposed = false;
    this._uid = restoreId || this.service.makeId();
    this._options = options || {};
    this._name = this._options.name || '';
    this._widget = widget;
    this._container = document.createElement('div');
    this._container.className = styles.terminalInstance;
    this._term = new Terminal({
      theme: this.theme.terminalTheme,
      ...TerminalClient.defaultOptions,
      ...this.service.getOptions(),
    });
    this._fitAddon = new FitAddon();
    this._term.loadAddon(this._fitAddon);

    const searchAddon = new SearchAddon();
    const weblinksAddon = new WebLinksAddon();

    this._term.loadAddon(searchAddon);
    this._term.loadAddon(weblinksAddon);

    this._events();
  }

  get term() {
    return this._term;
  }

  get name() {
    return this._name;
  }

  get pid() {
    return this._pid;
  }

  get options() {
    return this._options;
  }

  get isActive() {
    return this.controller.isTermActive(this.id);
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
    dom.appendChild(this._container);
  }

  private _doAttach(socket: WebSocket) {
    const info = this.service.intro(this.id);

    this._attachAddon = new AttachAddon(socket);
    this._term.loadAddon(this._attachAddon);
    this._attached = true;
    this.attachPromise = null;

    if (info) {
      this._name = (this._name || info.name) || 'terminal';
      this._pid = info.pid;
      this._widget.name = this._name;
    }

    if (this.showPromiseResolve) {
      this.showPromiseResolve();
      this.showPromiseResolve = null;
    }
  }

  async attach(restore: boolean = false, meta: string = '') {
    if (this._disposed) {
      return;
    }

    if (!this._attached) {
      if (!this.attachPromise) {
        this.attachPromise = this.service.attach(this.id, this.term, restore, meta,
          (socket: WebSocket) => this._doAttach(socket), this._options);
      }
      return this.attachPromise;
    } else {
      return Promise.resolve();
    }
  }

  private _doShow() {
    if (this._container) {
      if (!this._activated) {
        this._term.open(this._container);
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

  clear() {
    this._term.clear();
  }

  hide() {
    if (this._disposed) {
      return;
    }

    this._container.remove();
    this._container.innerHTML = '';
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

  updateTheme() {
    this._term.setOption('theme', this.theme.terminalTheme);
  }

  dispose() {
    if (this._disposed) {
      return;
    }

    super.dispose();

    this._attached = false;

    if (this.focusPromiseResolve) {
      this.focusPromiseResolve();
      this.focusPromiseResolve = null;
    }

    if (this.showPromiseResolve) {
      this.showPromiseResolve();
      this.showPromiseResolve = null;
    }

    this._layer && this._layer.dispose();
    this._fitAddon && this._fitAddon.dispose();
    this._attachAddon && this._attachAddon.dispose();
    this._term && this._term.dispose();

    this.hide();

    this.service.disposeById(this.id);

    this._disposed = true;
  }
}
