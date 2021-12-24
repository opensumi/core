import { observable } from 'mobx';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  Disposable,
  Deferred,
  Emitter,
  Event,
  debounce,
  ILogger,
  IDisposable,
  URI,
  IApplicationService,
  IReporter,
  REPORT_NAME,
} from '@opensumi/ide-core-common';
import { OperatingSystem, OS } from '@opensumi/ide-core-common/lib/platform';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { IVariableResolverService } from '@opensumi/ide-variable/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common';
import { AttachAddon, DEFAULT_COL, DEFAULT_ROW } from './terminal.addon';
import { TerminalKeyBoardInputService } from './terminal.input';
import {
  TerminalOptions,
  ITerminalController,
  ITerminalClient,
  ITerminalTheme,
  ITerminalGroupViewService,
  ITerminalInternalService,
  IWidget,
  ITerminalDataEvent,
  ITerminalExitEvent,
  ITerminalConnection,
  ITerminalExternalLinkProvider,
  IShellLaunchConfig,
} from '../common';
import { ITerminalPreference } from '../common/preference';
import { CorePreferences, QuickPickService } from '@opensumi/ide-core-browser';
import { TerminalLinkManager } from './links/link-manager';
import { EnvironmentVariableServiceToken, IEnvironmentVariableService } from '../common/environmentVariable';
import { IMessageService } from '@opensumi/ide-overlay';

import styles from './component/terminal.module.less';

@Injectable()
export class TerminalClient extends Disposable implements ITerminalClient {
  static WORKSPACE_PATH_CACHED: Map<string, string> = new Map();

  /** properties */
  private _container: HTMLDivElement;
  private _term: Terminal;
  private _uid: string;
  private _options: TerminalOptions;
  private _widget: IWidget;
  private _workspacePath: string;
  private _linkManager: TerminalLinkManager;
  /** end */

  /** addons */
  private _fitAddon: FitAddon;
  private _attachAddon: AttachAddon;
  private _searchAddon: SearchAddon;
  /** end */

  /** status */
  private _ready = false;
  private _attached: Deferred<void>;
  private _firstStdout: Deferred<void>;
  private _error: Deferred<void>;
  private _show: Deferred<void> | null;
  private _hasOutput = false;
  private _areLinksReady = false;
  private _os: OperatingSystem = OS;
  /** end */

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(ITerminalInternalService)
  protected readonly internalService: ITerminalInternalService;

  @Autowired(IWorkspaceService)
  protected readonly workspace: IWorkspaceService;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  @Autowired(IFileServiceClient)
  protected readonly fileService: IFileServiceClient;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

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

  @Autowired(QuickPickService)
  protected readonly quickPick: QuickPickService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(IReporter)
  reporter: IReporter;

  @Autowired(EnvironmentVariableServiceToken)
  protected readonly environmentService: IEnvironmentVariableService;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  @Autowired(IVariableResolverService)
  variableResolver: IVariableResolverService;

  private _onInput = new Emitter<ITerminalDataEvent>();
  onInput: Event<ITerminalDataEvent> = this._onInput.event;

  private _onOutput = new Emitter<ITerminalDataEvent>();
  onOutput: Event<ITerminalDataEvent> = this._onOutput.event;

  private _onExit = new Emitter<ITerminalExitEvent>();
  onExit: Event<ITerminalExitEvent> = this._onExit.event;

  private readonly _onLinksReady = new Emitter<ITerminalClient>();
  onLinksReady: Event<ITerminalClient> = this._onLinksReady.event;

  private readonly _onResponseTime = new Emitter<number>();
  onResponseTime: Event<number> = this._onResponseTime.event;

  async init(widget: IWidget, options: TerminalOptions = {}) {
    this._uid = widget.id;
    this._options = options || {};
    this.name = this._options.name || '';
    this._container = document.createElement('div');
    this._container.className = styles.terminalInstance;
    this._prepare();

    this._term = new Terminal({
      theme: this.theme.terminalTheme,
      ...this.preference.toJSON(),
      ...this.internalService.getOptions(),
    });

    if (options.message) {
      this._term.writeln(options.message);
    }

    // 可能存在 env 为 undefined 的情况，做一下初始化
    if (!this._options.env) {
      this._options.env = {};
    }

    this.environmentService.mergedCollection?.applyToProcessEnvironment(
      this._options.env,
      this.applicationService.backendOS,
      this.variableResolver.resolve.bind(this.variableResolver),
    );

    this.addDispose(
      this.environmentService.onDidChangeCollections((collection) => {
        // 环境变量更新只会在新建的终端中生效，已有的终端需要重启才可以生效
        collection.applyToProcessEnvironment(
          this._options.env || {},
          this.applicationService.backendOS,
          this.variableResolver.resolve.bind(this.variableResolver),
        );
      }),
    );

    this.addDispose(
      this._term.onTitleChange((e) => {
        this.updateOptions({ name: e });
      }),
    );

    this.addDispose(
      Disposable.create(() => {
        TerminalClient.WORKSPACE_PATH_CACHED.delete(widget.group.id);
      }),
    );

    this.addDispose(
      this.preference.onChange(async ({ name, value }) => {
        if (!widget.show && !this._show) {
          this._show = new Deferred();
        }
        if (this._show) {
          await this._show.promise;
        }
        this._setOption(name, value);
      }),
    );

    this.addDispose(
      widget.onShow((status) => {
        if (status) {
          if (this._show) {
            this._show.resolve();
            this._show = null;
          }
          this._layout();
        }
      }),
    );

    this.addDispose(
      widget.onError((status) => {
        if (status) {
          // fit 操作在对比行列没有发送变化的时候不会做任何操作，
          // 但是实际上是设置为 display none 了，所以手动 resize 一下
          // this._term.resize(1, 1);
        } else {
          this._error.resolve();
          this._layout();
        }
      }),
    );

    this._apply(widget);
    if (await this._checkWorkspace()) {
      this._attachXterm();
      this._attachAfterRender();
    }
  }

  @observable
  name = '';

  get term() {
    return this._term;
  }

  get pid() {
    return this.internalService.getProcessId(this.id);
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

  get areLinksReady(): boolean {
    return this._areLinksReady;
  }

  get os() {
    return this._os;
  }

  private _prepareAddons() {
    this._attachAddon = new AttachAddon();
    this._searchAddon = new SearchAddon();
    this._fitAddon = new FitAddon();
    this.addDispose([
      this._attachAddon,
      this._searchAddon,
      this._fitAddon,
      this._attachAddon.onData((data) => {
        this._onOutput.fire({ id: this.id, data });
      }),
      this._attachAddon.onExit((code) => {
        this.logger.warn(`${this.id} ${this.name} exit with ${code}`);
        this._onExit.fire({ id: this.id, code });
      }),
      this._attachAddon.onError((e) => {
        this.messageService.error(`Terminal ${this.name}(${e.bin}) exited with code ${e.code}`);
      }),

      this._attachAddon.onTime((delta) => {
        this._onResponseTime.fire(delta);
        this.reporter.performance(REPORT_NAME.TERMINAL_MEASURE, {
          duration: delta,
          msg: 'terminal.response',
        });
      }),
    ]);
  }

  private _loadAddons() {
    this._term.loadAddon(this._attachAddon);
    this._term.loadAddon(this._fitAddon);
    this._term.loadAddon(this._searchAddon);
  }

  private _xtermEvents() {
    this.addDispose(
      this._term.onResize((_event) => {
        if (this._hasOutput) {
          this._doResize();
        }
      }),
    );
  }

  private _attachXterm() {
    this._prepareAddons();
    this._loadAddons();
    this._xtermEvents();
    this._linkManager = this.injector.get(TerminalLinkManager, [this._term, this]);
    this._linkManager.processCwd = this._workspacePath;
    this.addDispose(this._linkManager);
    this.addDispose(this._term);
    this._areLinksReady = true;
    this._onLinksReady.fire(this);
  }

  private prepareShellLaunchConfig() {
    const type = this.preference.get<string>('type');
    const { rows = DEFAULT_ROW, cols = DEFAULT_COL } = this._term;

    const ptyOptions: IShellLaunchConfig = {
      shellPath: this._options.shellPath,
      cwd: this._options.cwd?.toString() || this._workspacePath,
      args: [],
      cols,
      rows,
      shellType: type,
      os: this._os,
      env: this._options.env,
      name: this._options.name,
      strictEnv: this._options.strictEnv,
      isExtensionTerminal: this._options.isExtensionTerminal,
    };

    // 将 shellArgs 的 string | string[] 转为 string[]
    if (this._options.shellArgs) {
      if (Array.isArray(this._options.shellArgs)) {
        ptyOptions.args?.push(...this._options.shellArgs);
      } else {
        ptyOptions.args?.push(this._options.shellArgs);
      }
    }

    return ptyOptions;
  }

  private async _doAttach() {
    const sessionId = this.id;
    const launchConfig = this.prepareShellLaunchConfig();

    let connection: ITerminalConnection | undefined;

    try {
      connection = await this.internalService.attach(sessionId, this._term, launchConfig);
    } catch (e) {
      // TODO emit error
      console.error(`attach ${sessionId} terminal failed`, connection, JSON.stringify(launchConfig), e);
    }

    this._attachAddon.setConnection(connection);

    if (!connection) {
      this._attached.resolve();
      return;
    }

    this.name = this.name || connection.name || 'shell';
    this._ready = true;
    this._attached.resolve();
    this._widget.name = this.name;

    this._firstStdout.promise.then(() => {
      this._doResize();
    });
  }

  _doResize() {
    this.internalService.resize(this.id, this._term.cols, this._term.rows);
  }

  _prepare() {
    this._attached?.reject();
    this._firstStdout?.reject();
    this._error?.reject();
    this._show?.reject();
    this._ready = false;
    this._hasOutput = false;
    this._attached = new Deferred<void>();
    this._show = new Deferred<void>();
    this._error = new Deferred<void>();
    this._firstStdout = new Deferred<void>();
    this._attachAddon?.setConnection(undefined);
    const { dispose } = this.onOutput(() => {
      dispose();
      this._hasOutput = true;
      this._firstStdout.resolve();
    });
  }

  _attachAfterRender() {
    // 等待 widget 渲染后再 attach，尽可能在创建时获取到准确的宽高
    // requestAnimationFrame 在不可见状态下会丢失，所以一定要用 queueMicrotask
    queueMicrotask(() => {
      this._layout();
      this.internalService.getOs().then((os) => {
        this._os = os;
      });
      this.attach();
      if (!this.widget.show) {
        this._show?.promise.then(async () => {
          this._show = new Deferred<void>();
        });
      }
    });
  }

  private async _pickWorkspace() {
    if (this.workspace.isMultiRootWorkspaceOpened) {
      // 工作区模式下每次新建终端都需要用户手动进行一次路径选择
      const roots = this.workspace.tryGetRoots();
      const choose = await this.quickPick.show(roots.map((file) => new URI(file.uri).codeUri.fsPath));
      return choose;
    } else {
      return new URI(this.workspace.workspace?.uri).codeUri.fsPath;
    }
  }

  private async _checkWorkspace() {
    const widget = this._widget;
    if (TerminalClient.WORKSPACE_PATH_CACHED.has(widget.group.id)) {
      this._workspacePath = TerminalClient.WORKSPACE_PATH_CACHED.get(widget.group.id)!;
    } else {
      const choose = await this._pickWorkspace();
      if (!choose) {
        this.view.removeWidget(widget.id);
        return false;
      }
      this._workspacePath = choose;
      TerminalClient.WORKSPACE_PATH_CACHED.set(widget.group.id, this._workspacePath);
    }
    return true;
  }

  reset() {
    this._prepare();
    this._attachAfterRender();
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
      this._layout();
    } catch {
      /** nothing */
    }
  }

  private _checkReady() {
    if (!this._ready) {
      throw new Error('terminal client not ready');
    }
  }

  private _layout() {
    // 如果 xterm 视图还没初始化，则先尝试初始化
    this._renderOnDemand();
    if (this._term.element) {
      try {
        this._fitAddon.fit();
      } catch {
        // noop
      }
    }
  }

  private _renderOnDemand() {
    // 避免重复创建 xterm 视图，后果是终端实例和视图不匹配，表现为整个卡住
    if (this._term.element) {
      return;
    }
    // xterm 视图容器没准备好，取消渲染 xterm 视图
    if (!this._widget.element?.clientHeight) {
      return;
    }
    // 多 workspace 模式下，等待 workspace 选择后再渲染
    if (!this._workspacePath) {
      return;
    }
    this._widget.element.appendChild(this._container);
    this._term.open(this._container);
    // 首次渲染且为当前选中的 client 时，聚焦
    // 等待数据更新、terminal 渲染完成，但是无需等待连接成功，体验上会更快一些
    setTimeout(() => {
      if (this.controller.activeClient?.id === this.id) {
        this.focus();
      }
    });
  }

  @debounce(100)
  private _debounceResize() {
    this._layout();
  }

  private _apply(widget: IWidget) {
    this._widget = widget;
    this.addDispose(
      widget.onResize(async () => {
        this._debounceResize();
      }),
    );
  }

  focus() {
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

  paste(text: string) {
    this._checkReady();
    return this._term.paste(text);
  }

  findNext(text: string) {
    this._checkReady();
    return this._searchAddon.findNext(text);
  }

  getSelection() {
    this._checkReady();
    if (this._term.hasSelection()) {
      return this._term.getSelection();
    } else {
      this.logger.warn('The terminal has no selection to copy');
      return '';
    }
  }

  updateTheme() {
    return this._term.setOption('theme', this.theme.terminalTheme);
  }

  updateOptions(options: TerminalOptions) {
    this._options = { ...this._options, ...options };
    this._widget.name = options.name || this.name;
  }

  async sendText(message: string) {
    await this.internalService.sendText(this.id, message);
    this._onInput.fire({ id: this.id, data: message });
  }

  registerLinkProvider(provider: ITerminalExternalLinkProvider): IDisposable {
    if (!this._linkManager) {
      throw new Error('TerminalInstance.registerLinkProvider before link manager was ready');
    }
    return this._linkManager.registerExternalLinkProvider(this, provider);
  }

  dispose(clear = true) {
    this._container.remove();
    super.dispose();

    if (clear) {
      this.internalService.disposeById(this.id);
    }
  }
}

@Injectable()
export class TerminalClientFactory {
  static createClient(injector: Injector, widget: IWidget, options?: TerminalOptions) {
    const child = injector.createChild([
      {
        token: TerminalClient,
        useClass: TerminalClient,
      },
    ]);
    const client = child.get(TerminalClient);
    client.init(widget, options);
    return client;
  }
}
