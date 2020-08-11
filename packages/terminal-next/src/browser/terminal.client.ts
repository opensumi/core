import { observable } from 'mobx';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Injectable, Autowired, Injector } from '@ali/common-di';
import { Disposable, Deferred, Emitter, Event, debounce } from '@ali/ide-core-common';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { IWorkspaceService } from '@ali/ide-workspace/lib/common';
import { FilePathAddon, AttachAddon, DEFAULT_COL, DEFAULT_ROW } from './terminal.addon';
import { TerminalKeyBoardInputService } from './terminal.input';
import { TerminalOptions, ITerminalController, ITerminalClient, ITerminalTheme, ITerminalGroupViewService, ITerminalInternalService, IWidget, ITerminalDataEvent } from '../common';
import { ITerminalPreference } from '../common/preference';
import { CorePreferences, IOpenerService } from '@ali/ide-core-browser';

import * as styles from './component/terminal.module.less';

@Injectable()
export class TerminalClient extends Disposable implements ITerminalClient {
  /** properties */
  private _container: HTMLDivElement;
  private _term: Terminal;
  private _uid: string;
  private _options: TerminalOptions;
  private _autofocus: boolean;
  private _widget: IWidget;
  /** end */

  /** addons */
  private _fitAddon: FitAddon;
  private _attachAddon: AttachAddon;
  private _searchAddon: SearchAddon;
  private _weblinksAddon: WebLinksAddon;
  private _filelinksAddon: FilePathAddon;
  /** end */

  /** status */
  private _ready: boolean = false;
  private _attached = new Deferred<void>();
  private _firstStdout = new Deferred<void>();
  private _error = new Deferred<void>();
  private _show: Deferred<void> | null;
  /** end */

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  @Autowired(IWorkspaceService)
  protected readonly workspace: IWorkspaceService;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  @Autowired(IFileServiceClient)
  protected readonly fileService: IFileServiceClient;

  @Autowired(ITerminalTheme)
  protected readonly theme: ITerminalTheme;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalPreference)
  protected readonly preference: ITerminalPreference;

  @Autowired(TerminalKeyBoardInputService)
  protected readonly keyboard: TerminalKeyBoardInputService;

  private _onInput = new Emitter<ITerminalDataEvent>();
  onInput: Event<ITerminalDataEvent> = this._onInput.event;

  private _onOutput = new Emitter<ITerminalDataEvent>();
  onOutput: Event<ITerminalDataEvent> = this._onOutput.event;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  init(widget: IWidget, options: TerminalOptions = {}, autofocus: boolean = true) {
    this._autofocus = autofocus;
    this._uid = widget.id;
    this._options = options || {};
    this.name = this._options.name || '';
    this._container = document.createElement('div');
    this._container.className = styles.terminalInstance;
    this._term = new Terminal({
      theme: this.theme.terminalTheme,
      ...this.preference.toJSON(),
      ...this.service.getOptions(),
    });

    this.addDispose(this.preference.onChange(({ name, value }) => {
      if (!widget.show) {
        if (!this._show) {
          this._show = new Deferred();
          this._show.promise.then(() => this._setOption(name, value));
        } else {
          this._show.promise.then(() => this._setOption(name, value));
        }
      } else {
        this._setOption(name, value);
      }
    }));

    this.addDispose(widget.onShow((status) => {
      if (status) {
        if (this._show) {
          this._show.resolve();
          this._show = null;
        }
        this.layout();
      }
    }));

    this.addDispose(widget.onError((status) => {
      if (status) {
        // fit 操作在对比行列没有发送变化的时候不会做任何操作，
        // 但是实际上是设置为 display none 了，所以手动 resize 一下
        // this._term.resize(1, 1);
      } else {
        this._error.resolve();
        this.layout();
      }
    }));

    const { dispose } = this.onOutput(() => {
      dispose();
      this._firstStdout.resolve();
    });

    this._apply(widget);
    this.attach();
  }

  @observable
  name: string = '';

  get term() {
    return this._term;
  }

  get pid() {
    return this.service.getProcessId(this.id);
  }

  get autofocus() {
    return this._autofocus;
  }

  get options() {
    return this._options;
  }

  get container() {
    return this._container;
  }

  get id() {
    return this._uid;
  }

  get widget() {
    return this._widget;
  }

  get ready() {
    return this._ready;
  }

  get attached() {
    return this._attached;
  }

  get firstOutput() {
    return this._firstStdout;
  }

  get show() {
    return this._show;
  }

  private _prepareAddons() {
    this._attachAddon = new AttachAddon();
    this._searchAddon = new SearchAddon();
    this._fitAddon = new FitAddon();
    this._filelinksAddon = new FilePathAddon(this.workspace, this.fileService, this.editorService, this.keyboard);
    this._weblinksAddon = new WebLinksAddon((_, url) => {
      if (this.keyboard.isCommandOrCtrl) {
        this.openerService.open(url);
      }
    });

    this.addDispose({
      dispose: () => {
        this._attachAddon.dispose();
        this._fitAddon.dispose();
        this._searchAddon.dispose();
        this._weblinksAddon.dispose();
        this._filelinksAddon.dispose();
      },
    });
  }

  private _loadAddons() {
    this._term.loadAddon(this._attachAddon);
    this._term.loadAddon(this._fitAddon);
    this._term.loadAddon(this._searchAddon);
    this._term.loadAddon(this._filelinksAddon);
    this._term.loadAddon(this._weblinksAddon);
  }

  private _xtermEvents() {
    this.addDispose(this._term.onResize((event) => {
      const { cols, rows } = event;
      this.service.resize(this.id, cols, rows);
    }));
  }

  private _attachXterm() {
    this._prepareAddons();
    this._loadAddons();
    this._xtermEvents();

    this.addDispose({
      dispose: () => {
        this._term.dispose();
      },
    });
  }

  private async _doAttach() {
    const sessionId = this.id;
    const type = this.preference.get<string>('type');
    this._attachXterm();

    const linuxShellArgs = this.corePreferences.get('terminal.integrated.shellArgs.linux');

    const ptyOptions = {
      ...this._options,
      shellArgs: [
        ...(this._options.shellArgs || []),
        ...(linuxShellArgs || []),
      ],
    };

    const { rows = DEFAULT_ROW, cols = DEFAULT_COL } = this._term;
    const connection = await this.service.attach(sessionId, this._term, rows, cols, ptyOptions, type);

    if (!connection) {
      this._attached.resolve();
      return;
    }

    this._attachAddon.setConnection(connection);
    this.addDispose(connection.onData((data) => {
      this._onOutput.fire({ id: this.id, data });
    }));

    this.name = (this.name || connection.name) || 'shell';
    this._ready = true;
    this._attached.resolve();
  }

  reset() {
    this._attached.reject();
    this._firstStdout.reject();
    this._error.reject();
    this._show && this._show.reject();
    this._ready = false;
    this._attached = new Deferred<void>();
    this._show = new Deferred<void>();
    this._error = new Deferred<void>();
    this._attachAddon.dispose();
    const { dispose } = this.onOutput(() => {
      dispose();
      this._firstStdout.resolve();
    });
    if (this.widget.show) {
      this.attach();
    } else {
      this._show.promise.then(async () => {
        await this.attach();
        this._show = new Deferred<void>();
      });
    }
  }

  private async attach() {
    if (!this._ready) {
      return this._doAttach();
    }
  }

  private _setOption(name: string, value: string | number | boolean) {
    /**
     * 有可能 preference 引起的修改并不是对应终端的 option，
     * 这种情况可能会报错
     */
    try {
      this._term.setOption(name, value);
      this.layout();
    } catch { /** nothing */ }
  }

  private _checkReady() {
    if (!this._ready) {
      throw new Error('client not ready');
    }
  }

  private async layout() {
    await this._attached.promise;
    if (!this._term.element || this._term.element.clientHeight === 0 || this._term.element.clientWidth === 0) {
      setTimeout(() => {
        this._container.innerHTML = '';
        this._term.open(this._container);
        try {
          this._fitAddon.fit();
        } catch { /** nothing */ }
      }, 0);
    } else {
      this._fitAddon.fit();
    }
  }

  private async _firstOnRender() {
    this._widget.element.appendChild(this._container);
    this._term.open(this._container);
    await this.attached.promise;
    this._widget.name = this.name;
  }

  @debounce(100)
  private _debouceResize() {
    // 云环境下面，容器 resize 终端的宽高信息可能存在时间竞争，
    // 所以这里我们加一个等待首次 stdout 的 deferred，
    // 保证 resize 消息一定能够生效
    this._firstStdout.promise.then(() => {
      this.layout();
    });
  }

  private async _apply(widget: IWidget) {
    this.addDispose(widget.onRender(async () => {
      await this._firstOnRender();
    }));

    this.addDispose(widget.onResize(async () => {
      this._debouceResize();
    }));

    this._widget = widget;
    if (widget.element) {
      await this._firstOnRender();
    }
  }

  focus() {
    this._checkReady();
    return this._term.focus();
  }

  clear() {
    this._checkReady();
    return this._term.clear();
  }

  selectAll() {
    this._checkReady();
    return this._term.selectAll();
  }

  findNext(text: string) {
    this._checkReady();
    return this._searchAddon.findNext(text);
  }

  updateTheme() {
    return this._term.setOption('theme', this.theme.terminalTheme);
  }

  updateOptions(options: TerminalOptions) {
    this._options = { ...this._options, ...options };
    this._widget.name = options.name || this.name;
  }

  async sendText(message: string) {
    await this.service.sendText(this.id, message);
    this._onInput.fire({ id: this.id, data: message });
  }

  dispose(clear: boolean = true) {
    this._container.remove();
    super.dispose();

    if (clear) {
      this.service.disposeById(this.id);
    }
  }
}

@Injectable()
export class TerminalClientFactory {

  static createClient(injector: Injector, widget: IWidget, options?: TerminalOptions, autofocus?: boolean) {
    const child = injector.createChild([
      {
        token: TerminalClient,
        useClass: TerminalClient,
      },
    ]);
    const client = child.get(TerminalClient);
    client.init(widget, options, autofocus);
    return client;
  }
}
