import { observable } from 'mobx';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Injectable, Autowired, Injector } from '@ali/common-di';
import { Disposable, Deferred, Emitter, debounce } from '@ali/ide-core-common';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { IWorkspaceService } from '@ali/ide-workspace/lib/common';
import { FilePathAddon, AttachAddon, DEFAULT_COL, DEFAULT_ROW } from './terminal.addon';
import { TerminalKeyBoardInputService } from './terminal.input';
import { TerminalOptions, ITerminalController, ITerminalClient, ITerminalTheme, ITerminalGroupViewService, ITerminalInternalService, IWidget, ITerminalPreference, ITerminalDataEvent } from '../common';

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

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalPreference)
  protected readonly preference: ITerminalPreference;

  @Autowired(TerminalKeyBoardInputService)
  protected readonly keyboard: TerminalKeyBoardInputService;

  private _onInput = new Emitter<ITerminalDataEvent>();
  onInput = this._onInput.event;

  private _onOutput = new Emitter<ITerminalDataEvent>();
  onOutput = this._onOutput.event;

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
      this._term.setOption(name, value);
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

  private _prepareAddons() {
    this._attachAddon = new AttachAddon();
    this._searchAddon = new SearchAddon();
    this._fitAddon = new FitAddon();
    this._filelinksAddon = new FilePathAddon(this.workspace, this.fileService, this.editorService, this.keyboard);
    this._weblinksAddon = new WebLinksAddon((_, url) => {
      if (this.keyboard.isCommandOrCtrl) {
        window.open(url, '_blank');
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
    const type = this.preference.get<string>('terminal.type');
    this._attachXterm();

    const { rows = DEFAULT_ROW, cols = DEFAULT_COL } = this._fitAddon.proposeDimensions() || {};
    const connection = await this.service.attach(sessionId, this._term, rows, cols, this._options, type);

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
    this._ready = false;
    this._attached = new Deferred<void>();
    this._firstStdout = new Deferred<void>();
    this.attach();
  }

  private async attach() {
    if (!this._ready) {
      return this._doAttach();
    }
  }

  private _checkReady() {
    if (!this._ready) {
      throw new Error('client not ready');
    }
  }

  layout() {
    this._checkReady();
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
      await this._attached.promise;
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
