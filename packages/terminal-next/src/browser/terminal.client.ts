import { Terminal, ITerminalOptions } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { AttachAddon } from 'xterm-addon-attach';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Disposable, ThrottledDelayer, URI } from '@ali/ide-core-common';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { IWorkspaceService } from '@ali/ide-workspace/lib/common';
import { PreferenceService } from '@ali/ide-core-browser';
import { TerminalFilePathAddon } from './terminal.addon';
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
  private _searchAddon: SearchAddon;

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

  private _customTermOptions(): ITerminalOptions {
    const options = {};
    const support = {
      'terminal.fontFamily': 'fontFamily',
      'terminal.fontSize': 'fontSize',
      'terminal.fontWeight': 'fontWeight',
      'terminal.lineHeight': 'lineHeight',
      'terminal.cursorBlink': 'cursorBlink',
    };

    Object.keys(support).forEach((key) => {
      const value = this.preference.get<any>(key);
      if (value !== undefined && value !== '') {
        options[support[key]] = value;
      }
    });

    this.addDispose({
      dispose: () => {
        this.preference.onPreferenceChanged(({ preferenceName, newValue }) => {
          if (support[preferenceName]) {
            this._term.setOption(support[preferenceName], newValue);
          }
        });
      },
    });

    return options;
  }

  constructor(
    protected readonly service: ITerminalExternalService,
    protected readonly workspace: IWorkspaceService,
    protected readonly editorService: WorkbenchEditorService,
    protected readonly fileService: IFileServiceClient,
    protected theme: ITerminalTheme,
    protected readonly preference: PreferenceService,
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
      ...this._customTermOptions(),
    });
    this._searchAddon = new SearchAddon();
    this._fitAddon = new FitAddon();
    this._term.loadAddon(this._fitAddon);

    const weblinksAddon = new WebLinksAddon();
    const filelinksAddon = new TerminalFilePathAddon((_, uri: string) => {
      // todo: support for windows

      const mainFuntion = async () => {
        let absolute: string | undefined;
        if (uri[0] !== '/') {
          if (this.workspace.workspace) {
            // 一致处理为无 file scheme 的绝对地址
            absolute = `${this.workspace.workspace.uri}/${uri}`.substring(7);
          } else {
            return;
          }
        } else {
          absolute = uri;
        }

        if (absolute) {
          const fileUri = URI.file(absolute);
          if (fileUri && fileUri.scheme === 'file') {
            const stat = await this.fileService.getFileStat(fileUri.toString());
            if (stat && !stat.isDirectory) {
              this.editorService.open(new URI(stat.uri));
            }
          }
        }
      };
      mainFuntion();
    });

    this._term.loadAddon(this._searchAddon);
    this._term.loadAddon(filelinksAddon);
    this._term.loadAddon(weblinksAddon);

    this.addDispose({
      dispose: () => {
        if (this.focusPromiseResolve) {
          this.focusPromiseResolve();
          this.focusPromiseResolve = null;
        }

        if (this.showPromiseResolve) {
          this.showPromiseResolve();
          this.showPromiseResolve = null;
        }

        this._attachAddon && this._attachAddon.dispose();
        this._fitAddon.dispose();
        this._searchAddon.dispose();
        weblinksAddon.dispose();
        filelinksAddon.dispose();
        this._layer.dispose();
        this._term.dispose();
      },
    });

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
        const type = this.preference.get<string>('terminal.type');
        this.attachPromise = this.service.attach(this.id, this.term, restore, meta,
          (socket: WebSocket) => this._doAttach(socket), this._options, type);
      }
      return this.attachPromise;
    } else {
      return Promise.resolve();
    }
  }

  /**
   * 当 container 下面没有子节点或者子节点的高为 0 时候，
   * 这个时候不能直接渲染，需要重新 open element 才能解决渲染问题
   */
  get notReadyToShow() {
    return (this.container.children.length === 0) ||
      this.container.children[0] && (this.container.children[0].clientHeight === 0);
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

  selectAll() {
    this._term.selectAll();
  }

  hide() {
    if (this._disposed) {
      return;
    }

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

  findNext(text: string) {
    this._searchAddon.findNext(text);
  }

  /**
   * clear 参数用于判断是否需要清理 meta 信息，
   * 不需要 clear 参数的时候基本为正常推出，
   * 异常的时候需要将 clear 设为 false，保留现场
   *
   * @param clear
   */
  dispose(clear: boolean = true) {
    if (this._disposed) {
      return;
    }

    super.dispose();

    this._attached = false;

    this.hide();
    this._container.remove();

    if (clear) {
      this.service.disposeById(this.id);
    }

    this._disposed = true;
  }
}
