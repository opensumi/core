import { observable } from 'mobx';
import type vscode from 'vscode';

import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { CorePreferences, QuickPickService } from '@opensumi/ide-core-browser';
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
  Uri,
  withNullAsUndefined,
  IThemeColor,
} from '@opensumi/ide-core-common';
import { OperatingSystem, OS } from '@opensumi/ide-core-common/lib/platform';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/common';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { IMessageService } from '@opensumi/ide-overlay';
import { IVariableResolverService } from '@opensumi/ide-variable/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common';

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
  ICreateTerminalOptions,
  ITerminalProfileService,
  ITerminalProfile,
  IShellLaunchConfig,
  ITerminalProfileInternalService,
  TerminalIcon,
} from '../common';
import { EnvironmentVariableServiceToken, IEnvironmentVariableService } from '../common/environmentVariable';
import { ITerminalPreference } from '../common/preference';

import { TerminalLinkManager } from './links/link-manager';
import { AttachAddon, DEFAULT_COL, DEFAULT_ROW } from './terminal.addon';
import { TerminalProcessExtHostProxy } from './terminal.ext.host.proxy';
import { TerminalKeyBoardInputService } from './terminal.input';
import { XTerm } from './xterm';

@Injectable()
export class TerminalClient extends Disposable implements ITerminalClient {
  static WORKSPACE_PATH_CACHED: Map<string, string> = new Map();

  /** properties */
  private _uid: string;
  private _terminalOptions: TerminalOptions;
  private _widget: IWidget;
  private _workspacePath: string;
  private _linkManager: TerminalLinkManager;
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

  @Autowired(ITerminalProfileService)
  terminalProfileService: ITerminalProfileService;

  @Autowired(ITerminalProfileInternalService)
  terminalProfileInternalService: ITerminalProfileInternalService;

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
  private _attachAddon: AttachAddon;

  xterm: XTerm;
  private _launchConfig: IShellLaunchConfig;

  constructor() {
    super();

    this.xterm = this.injector.get(XTerm, [
      {
        xtermOptions: {
          theme: this.theme.terminalTheme,
          ...this.preference.toJSON(),
          ...this.internalService.getOptions(),
        },
      },
    ]);

    this.addDispose(this.xterm);

    this.addDispose(
      this.xterm.raw.onTitleChange((e) => {
        this.updateOptions({ name: e });
      }),
    );

    this.addDispose(
      this.internalService.onError((error) => {
        this.messageService.error(error.message);
        if (error.launchConfig?.executable) {
          this.updateOptions({
            name: 'error: ' + error.launchConfig.executable,
          });
        } else {
          this.updateOptions({
            name: 'error',
          });
        }
      }),
    );
  }

  private onWidgetShow() {
    if (this._show) {
      this._show.resolve();
      this._show = null;
    }
    this._layout();
  }

  async setupWidget(widget: IWidget) {
    this._widget = widget;
    this._prepare();

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

    // 在拆分终端时，widget 渲染的时机会比较早
    // 如果 widget show 已经为 true，确保
    // Deferred 已经 resolve, 否则无法监听
    // 到后续的事件
    if (widget.show) {
      this.onWidgetShow();
    } else {
      this.addDispose(
        widget.onShow((status) => {
          if (status) {
            this.onWidgetShow();
          }
        }),
      );
    }

    this.addDispose(
      widget.onError((status) => {
        if (status) {
          // fit 操作在对比行列没有发送变化的时候不会做任何操作，
          // 但是实际上是设置为 display none 了，所以手动 resize 一下
          // this._term.resize(1, 1);
        } else {
          this._error?.resolve();
          this._layout();
        }
      }),
    );

    this.addDispose(
      widget.onResize(async () => {
        this._debounceResize();
      }),
    );
  }

  convertTerminalOptionsToLaunchConfig() {
    const options = this._terminalOptions;
    const shellLaunchConfig: IShellLaunchConfig = {
      name: options.name,
      executable: withNullAsUndefined(options.shellPath),
      args: withNullAsUndefined(options.shellArgs),
      cwd: withNullAsUndefined(options.cwd),
      env: withNullAsUndefined(options.env),
      icon: withNullAsUndefined(asTerminalIcon(options.iconPath)),
      // color: ThemeColor.isThemeColor(options.color) ? options.color.id : undefined,
      initialText: withNullAsUndefined(options.message),
      strictEnv: withNullAsUndefined(options.strictEnv),
      hideFromUser: withNullAsUndefined(options.hideFromUser),
      // isFeatureTerminal: withNullAsUndefined(options?.isFeatureTerminal),
      isExtensionOwnedTerminal: true,
      // useShellEnvironment: withNullAsUndefined(internalOptions?.useShellEnvironment),
      // location:
      // internalOptions?.location ||
      // this._serializeParentTerminal(options.location, internalOptions?.resolvedExtHostIdentifier),
      // disablePersistence: withNullAsUndefined(options.disablePersistence),
    };

    if (options.isExtensionTerminal) {
      shellLaunchConfig.customPtyImplementation = (sessionId, cols, rows) =>
        new TerminalProcessExtHostProxy(sessionId, cols, rows, this.controller);
    }
    return shellLaunchConfig;
  }

  /**
   * @deprecated Please use `init2` instead.
   */
  async init(widget: IWidget, options: TerminalOptions = {}) {
    this._terminalOptions = options;
    await this.init2(widget, {
      config: this.convertTerminalOptionsToLaunchConfig(),
    });
  }

  convertProfileToLaunchConfig(
    shellLaunchConfigOrProfile: IShellLaunchConfig | ITerminalProfile | undefined,
    cwd?: Uri | string,
  ): IShellLaunchConfig {
    if (!shellLaunchConfigOrProfile) {
      return {};
    }
    // Profile was provided
    if (shellLaunchConfigOrProfile && 'profileName' in shellLaunchConfigOrProfile) {
      const profile = shellLaunchConfigOrProfile;
      if (!profile.path) {
        return shellLaunchConfigOrProfile;
      }
      return {
        executable: profile.path,
        args: profile.args,
        env: profile.env,
        // icon: profile.icon,
        color: profile.color,
        name: profile.overrideName ? profile.profileName : undefined,
        cwd,
      };
    }

    if (cwd) {
      shellLaunchConfigOrProfile.cwd = cwd;
    }
    return shellLaunchConfigOrProfile;
  }

  async init2(widget: IWidget, options?: ICreateTerminalOptions) {
    this._uid = widget.id;
    this.setupWidget(widget);

    if (!options || Object.keys(options).length === 0) {
      // 应该是必定能 resolve 到 profile 的
      const defaultProfile = await this.terminalProfileInternalService.resolveDefaultProfile();
      options = {
        config: defaultProfile,
      };
    }
    await this._checkWorkspace();

    const cwd = options.cwd ?? (options?.config as IShellLaunchConfig)?.cwd ?? this._workspacePath;
    const launchConfig = this.convertProfileToLaunchConfig(options.config, cwd);
    this._launchConfig = launchConfig;
    this.name = launchConfig.name || '';

    if (launchConfig.initialText) {
      this.xterm.raw.writeln(launchConfig.initialText);
    }
    if (!launchConfig.env) {
      launchConfig.env = {};
    }
    this.environmentService.mergedCollection?.applyToProcessEnvironment(
      launchConfig.env,
      this.applicationService.backendOS,
      this.variableResolver.resolve.bind(this.variableResolver),
    );

    this.addDispose(
      this.environmentService.onDidChangeCollections((collection) => {
        // 环境变量更新只会在新建的终端中生效，已有的终端需要重启才可以生效
        collection.applyToProcessEnvironment(
          launchConfig.env!,
          this.applicationService.backendOS,
          this.variableResolver.resolve.bind(this.variableResolver),
        );
      }),
    );
    this._attachXterm();
    this._attachAfterRender();
  }

  @observable
  name = '';

  get term() {
    return this.xterm.raw;
  }

  get pid() {
    return this.internalService.getProcessId(this.id);
  }

  get options() {
    return this._terminalOptions;
  }

  get createOptions() {
    return;
  }

  get container() {
    return this.xterm.container;
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
    this.addDispose([
      this._attachAddon,
      this._attachAddon.onData((data) => {
        this._onOutput.fire({ id: this.id, data });
      }),
      this._attachAddon.onExit((code) => {
        this.logger.warn(`${this.id} ${this.name} exit with ${code}`);
        if (code !== 0) {
          this.messageService.error(
            `terminal ${this.name}(${this._attachAddon.connection?.ptyInstance?.shellPath}) exited with non-zero code ${code}`,
          );
        }
        this._onExit.fire({ id: this.id, code });
      }),

      this._attachAddon.onTime((delta) => {
        this._onResponseTime.fire(delta);
        this.reporter.performance(REPORT_NAME.TERMINAL_MEASURE, {
          duration: delta,
          msg: 'terminal.response',
        });
      }),
    ]);
    this.xterm.raw.loadAddon(this._attachAddon);
  }

  private _xtermEvents() {
    this.addDispose(
      this.xterm.raw.onResize((_event) => {
        if (this._hasOutput) {
          this._doResize();
        }
      }),
    );
  }

  private _attachXterm() {
    this._prepareAddons();
    this._xtermEvents();
    this._linkManager = this.injector.get(TerminalLinkManager, [this.xterm.raw, this]);
    this._linkManager.processCwd = this._workspacePath;
    this.addDispose(this._linkManager);
    this._areLinksReady = true;
    this._onLinksReady.fire(this);
  }

  _doResize() {
    this.internalService.resize(this.id, this.xterm.raw.cols, this.xterm.raw.rows);
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
    this.internalService.getOs().then((os) => {
      this._os = os;
    });
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
    } else if (this.workspace.workspace) {
      return new URI(this.workspace.workspace?.uri).codeUri.fsPath;
    } else {
      return undefined;
    }
  }

  /**
   * if we want open a terminal, we need a parameter: `cwd`
   * we don't care whether it valid. our backend service will check it.
   *
   * 如果当前工作区不存在，这里就会获得空，后端的逻辑中终端会打开用户的家目录。
   * 多工作区模式下用户没有选中任何一个工作区，也是会打开用户的家目录。
   */
  private async _checkWorkspace() {
    const widget = this._widget;
    if (TerminalClient.WORKSPACE_PATH_CACHED.has(widget.group.id)) {
      this._workspacePath = TerminalClient.WORKSPACE_PATH_CACHED.get(widget.group.id)!;
    } else {
      const choose = await this._pickWorkspace();
      if (choose) {
        this._workspacePath = choose;
        TerminalClient.WORKSPACE_PATH_CACHED.set(widget.group.id, this._workspacePath);
      }
    }
  }

  reset() {
    this._prepare();
    this._attachAfterRender();
  }

  private async attach() {
    if (!this._ready) {
      return this._doAttach2();
    }
  }

  private async _doAttach2() {
    const sessionId = this.id;
    const { rows = DEFAULT_ROW, cols = DEFAULT_COL } = this.xterm.raw;

    let connection: ITerminalConnection | undefined;

    const finalLaunchConfig = {
      ...this._launchConfig,
      cwd: this._launchConfig?.cwd || this._workspacePath,
    };

    this._launchConfig = finalLaunchConfig;
    this.logger.log('attach terminal by launchConfig: ', this._launchConfig);

    try {
      connection = await this.internalService.attachByLaunchConfig(sessionId, cols, rows, this._launchConfig);
    } catch (e) {
      this.logger.error(`attach ${sessionId} terminal failed, _launchConfig`, JSON.stringify(this._launchConfig), e);
    }

    this.resolveConnection(connection);
  }

  resolveConnection(connection: ITerminalConnection | undefined) {
    if (!connection) {
      this._attached.resolve();
      return;
    }

    this._attachAddon.setConnection(connection);
    this.name = this.name || connection.name || 'shell';
    this._ready = true;
    this._attached.resolve();
    this._widget.name = this.name;

    this._firstStdout.promise.then(() => {
      this._doResize();
    });
  }

  private _setOption(name: string, value: string | number | boolean) {
    /**
     * 有可能 preference 引起的修改并不是对应终端的 option，
     * 这种情况可能会报错
     */
    try {
      this.xterm.raw.setOption(name, value);
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
    if (this.xterm.raw.element) {
      try {
        this.xterm.fit();
      } catch {
        // noop
      }
    }
  }

  private _renderOnDemand() {
    // 避免重复创建 xterm 视图，后果是终端实例和视图不匹配，表现为整个卡住
    if (this.xterm.raw.element) {
      return;
    }
    // xterm 视图容器没准备好，取消渲染 xterm 视图
    if (!this._widget.element?.clientHeight) {
      return;
    }

    this._widget.element.appendChild(this.xterm.container);
    this.xterm.open();
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

  focus() {
    return this.xterm.raw.focus();
  }

  clear() {
    this._checkReady();
    return this.xterm.raw.clear();
  }

  selectAll() {
    this._checkReady();
    return this.xterm.raw.selectAll();
  }

  paste(text: string) {
    this._checkReady();
    return this.xterm.raw.paste(text);
  }

  findNext(text: string) {
    this._checkReady();
    return this.xterm.findNext(text);
  }

  getSelection() {
    this._checkReady();
    if (this.xterm.raw.hasSelection()) {
      return this.xterm.raw.getSelection();
    } else {
      this.logger.warn('The terminal has no selection to copy');
      return '';
    }
  }

  updateTheme() {
    return this.xterm.updateTheme(this.theme.terminalTheme);
  }

  updateOptions(options: TerminalOptions) {
    this._terminalOptions = { ...this._terminalOptions, ...options };
    this._launchConfig = this.convertTerminalOptionsToLaunchConfig();

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
    super.dispose();

    if (clear) {
      this.internalService.disposeById(this.id);
    }
  }
}

@Injectable()
export class TerminalClientFactory {
  /**
   * 创建 terminal 实例最终都会调用该方法
   */
  static async createClient(injector: Injector, widget: IWidget, options?: TerminalOptions) {
    // 每一个 widget.id 对应一个 TerminalClient
    // 但是 TerminalClient 内部又依赖了一堆的其他要注入的，所以这里新创建一个 child injector
    // 让 TerminalClient 依赖的所有类都重新初始化一遍

    const child = injector.createChild([
      {
        token: TerminalClient,
        useClass: TerminalClient,
      },
    ]);

    const client = child.get(TerminalClient);
    await client.init(widget, options);
    return client;
  }
  /**
   * 创建 terminal 实例最终都会调用该方法
   */
  static async createClient2(injector: Injector, widget: IWidget, options?: ICreateTerminalOptions) {
    const child = injector.createChild([
      {
        token: TerminalClient,
        useClass: TerminalClient,
      },
    ]);

    const client = child.get(TerminalClient);
    await client.init2(widget, options);
    return client;
  }
}

export const createTerminalClientFactory = (injector: Injector) => (widget: IWidget, options?: TerminalOptions) =>
  TerminalClientFactory.createClient(injector, widget, options);

export const createTerminalClientFactory2 =
  (injector: Injector) => (widget: IWidget, options?: ICreateTerminalOptions) =>
    TerminalClientFactory.createClient2(injector, widget, options);

function asTerminalIcon(iconPath?: Uri | { light: Uri; dark: Uri } | vscode.ThemeIcon): TerminalIcon | undefined {
  if (!iconPath || typeof iconPath === 'string') {
    return undefined;
  }

  if (!('id' in iconPath)) {
    return iconPath;
  }

  return {
    id: iconPath.id,
    color: iconPath.color as IThemeColor,
  };
}
