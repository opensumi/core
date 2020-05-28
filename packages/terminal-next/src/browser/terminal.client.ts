import { observable } from 'mobx';
import { Terminal, ITerminalOptions } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Injectable, Autowired, Injector } from '@ali/common-di';
import { Disposable, Deferred, Emitter, debounce, Event } from '@ali/ide-core-common';
import { WorkbenchEditorService } from '@ali/ide-editor/lib/common';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { IWorkspaceService } from '@ali/ide-workspace/lib/common';
import { PreferenceService } from '@ali/ide-core-browser';
import { FilePathAddon, AttachAddon } from './terminal.addon';
import { TerminalKeyBoardInputService } from './terminal.input';
import { TerminalOptions, ITerminalController, ITerminalClient, ITerminalTheme, TerminalSupportType, ITerminalGroupViewService, ITerminalInternalService, ITerminalConnection, IWidget, defaultTerminalFontFamily } from '../common';

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
  /** end */

  private readonly ptyProcessMessageEvent = new Emitter<{ id: string; message: string }>();
  public onReceivePtyMessage: Event<{ id: string; message: string }> = this.ptyProcessMessageEvent.event;

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

  @Autowired(PreferenceService)
  protected readonly preference: PreferenceService;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(TerminalKeyBoardInputService)
  protected readonly keyboard: TerminalKeyBoardInputService;

  static defaultOptions: ITerminalOptions = {
    allowTransparency: true,
    macOptionIsMeta: false,
    cursorBlink: false,
    scrollback: 2500,
    tabStopWidth: 8,
    fontSize: 12,
  };

  init(widget: IWidget, options: TerminalOptions = {}, autofocus: boolean = true) {
    this._autofocus = autofocus;
    this._uid = widget.id;
    this._options = options || {};
    this.name = this._options.name || '';
    this._container = document.createElement('div');
    this._container.className = styles.terminalInstance;
    this._term = new Terminal({
      theme: this.theme.terminalTheme,
      ...TerminalClient.defaultOptions,
      ...this.service.getOptions(),
      ...this._customTermOptions(),
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

  private _handleTerminalOption(name: string, value: any) {
    switch (name) {
      case 'fontFamily':
        this._term.setOption(name, value || defaultTerminalFontFamily);
        break;
      case 'fontSize':
        // TODO: 现在 client 自己这里限制，保证 windows 不会卡死
        // FIXME: preference validation 完成后去除, windows下大小为 1 会导致界面卡死
        this._term.setOption(name, value > 2 ? value : 2);
        break;
      default:
        this._term.setOption(name, value);
        break;
    }
  }

  private _customTermOptions(): ITerminalOptions {
    const options = {};
    const support = TerminalSupportType;

    Object.keys(support).forEach((key) => {
      let value = this.preference.get<any>(key);
      if (value !== undefined && value !== '') {
        // FIXME: preference validation完成后去除
        if (support[key] === 'fontSize') {
            value = value > 2 ? value : 2;
        }
        options[support[key]] = value;
      }
    });

    this.addDispose(this.preference.onPreferenceChanged(({ preferenceName, newValue }) => {
      if (support[preferenceName]) {
        const option = this._term.getOption(support[preferenceName]);
        if (option !== newValue) {
          this._handleTerminalOption(support[preferenceName], newValue);
        }
      }
    }));

    return options;
  }

  private _prepareAddons(connection: ITerminalConnection) {
    this._attachAddon = new AttachAddon(connection);
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

  private _attachXterm(connection: ITerminalConnection) {
    this._prepareAddons(connection);
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
    const connection = await this.service.attach(sessionId, this._term, this._options, type);

    if (!connection) {
      this._attached.resolve();
      return;
    }

    this.addDispose(connection.onData((e) => {
      this.ptyProcessMessageEvent.fire({ id: this.id, message: e.toString() });
    }));

    this.name = (this.name || connection.name) || 'shell';
    this._attachXterm(connection);
    this._attached.resolve();
    this._ready = true;
  }

  reset() {
    this._ready = false;
    this._attached = new Deferred<void>();
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
      this._container.innerHTML = '';
      this._term.open(this._container);

      try {
        this._fitAddon.fit();
      } catch { /** nothing */ }
    } else {
      this._fitAddon.fit();
    }
  }

  private async _firstOnRender() {
    this._widget.element.appendChild(this._container);
    await this.attached.promise;
    this._widget.name = this.name;
    this.layout();
  }

  @debounce(100)
  private _debouceResize() {
    this.layout();
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
    return this.service.sendText(this.id, message);
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
