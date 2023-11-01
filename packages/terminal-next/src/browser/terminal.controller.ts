import { observable } from 'mobx';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { ResizeEvent, getSlotLocation, AppConfig } from '@opensumi/ide-core-browser';
import { TERMINAL_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import { ICtxMenuRenderer, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { generateCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/menu-util';
import { AbstractMenuService } from '@opensumi/ide-core-browser/lib/menu/next/menu.interface';
import { PreferenceService } from '@opensumi/ide-core-browser/lib/preferences/types';
import {
  WithEventBus,
  Emitter,
  Deferred,
  Event,
  IDisposable,
  DisposableStore,
  ILogger,
  DisposableCollection,
  CommandRegistry,
  replaceLocalizePlaceholder,
  withNullAsUndefined,
  isThemeColor,
  Uri,
  IApplicationService,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { TabBarHandler } from '@opensumi/ide-main-layout/lib/browser/tabbar-handler';
import { IThemeService } from '@opensumi/ide-theme';

import {
  ITerminalController,
  ITerminalClient,
  IWidget,
  ITerminalInfo,
  ITerminalBrowserHistory,
  ITerminalTheme,
  ITerminalGroupViewService,
  IShellLaunchConfig,
  ITerminalErrorService,
  ITerminalInternalService,
  ITerminalLaunchError,
  ITerminalProcessExtHostProxy,
  IStartExtensionTerminalRequest,
  ITerminalExitEvent,
  ITerminalTitleChangeEvent,
  ITerminalExternalLinkProvider,
  ICreateTerminalOptions,
  ITerminalClientFactory2,
  ICreateClientWithWidgetOptions,
  ITerminalProfileService,
  TerminalOptions,
  asTerminalIcon,
  TERMINAL_ID_SEPARATOR,
  ITerminalProfile,
  TerminalCliterFilter,
  TerminalLocation,
} from '../common';
import { CodeTerminalSettingId } from '../common/preference';

import { TerminalContextKey } from './terminal.context-key';
import { TerminalGroupViewService } from './terminal.view';

@Injectable()
export class TerminalController extends WithEventBus implements ITerminalController {
  protected _focus: boolean;
  protected _tabBarHandler: TabBarHandler | undefined;
  protected _clients: Map<string, ITerminalClient>;
  protected _onDidOpenTerminal = new Emitter<ITerminalInfo>();
  protected _onDidCloseTerminal = new Emitter<ITerminalExitEvent>();
  protected _onDidTerminalTitleChange = new Emitter<ITerminalTitleChangeEvent>();
  protected _onDidChangeActiveTerminal = new Emitter<string>();
  protected _ready = new Deferred<void>();
  protected _activeClientId?: string;

  private _linkProviders: Set<ITerminalExternalLinkProvider> = new Set();
  private _linkProviderDisposables: Map<ITerminalExternalLinkProvider, DisposableStore> = new Map();

  readonly onDidOpenTerminal: Event<ITerminalInfo> = this._onDidOpenTerminal.event;
  readonly onDidCloseTerminal: Event<ITerminalExitEvent> = this._onDidCloseTerminal.event;
  readonly onDidTerminalTitleChange: Event<ITerminalTitleChangeEvent> = this._onDidTerminalTitleChange.event;
  readonly onDidChangeActiveTerminal: Event<string> = this._onDidChangeActiveTerminal.event;

  private readonly _onInstanceRequestStartExtensionTerminal = new Emitter<IStartExtensionTerminalRequest>();
  readonly onInstanceRequestStartExtensionTerminal: Event<IStartExtensionTerminalRequest> =
    this._onInstanceRequestStartExtensionTerminal.event;

  private commandAndMenuDisposeCollection: DisposableCollection;

  @Autowired(IMainLayoutService)
  protected readonly layoutService: IMainLayoutService;

  @Autowired(IThemeService)
  protected readonly themeService: IThemeService;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  @Autowired(ITerminalTheme)
  protected readonly terminalTheme: ITerminalTheme;

  @Autowired(ITerminalGroupViewService)
  protected readonly terminalView: TerminalGroupViewService;

  @Autowired(ITerminalClientFactory2)
  protected readonly clientFactory: ITerminalClientFactory2;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  @Autowired(ITerminalErrorService)
  protected readonly errorService: ITerminalErrorService;

  @Autowired(ITerminalProfileService)
  protected readonly profileService: ITerminalProfileService;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(ICtxMenuRenderer)
  private ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  private _clientId: string;

  public viewReady = new Deferred<void>();

  /**
   * 如果这个值在被用到的时候还是 undefined，那说明视图渲染出了问题。
   * 请排查 terminal.view 视图层为什么没有把这个 contextKey 注入进来。
   */
  private terminalContextKey: TerminalContextKey;

  @observable
  themeBackground: string;

  get clients() {
    return this._clients;
  }

  get focused() {
    return this._focus;
  }

  get ready() {
    return this._ready;
  }

  get activeClient() {
    if (this._activeClientId) {
      return this._clients.get(this._activeClientId);
    }
  }

  get contextKeyService() {
    if (this.terminalContextKey) {
      return this.terminalContextKey.service;
    }
  }

  get clientId() {
    if (this._clientId) {
      return this._clientId;
    }
    this._clientId = this.applicationService.clientId;
    return this._clientId;
  }

  private async _createClientOrIgnore(widget: IWidget) {
    if (this._clients.has(widget.id)) {
      return this._clients.get(widget.id)!;
    }
    return await this._createClient(widget);
  }

  private async _createClient(widget: IWidget, options?: ICreateTerminalOptions) {
    const client = await this.clientFactory(widget, options);
    this.logger.log('create client with ITerminalClientFactory2', client);
    return this.setupClient(widget, client);
  }

  setupClient(widget: IWidget, client: ITerminalClient) {
    this._clients.set(client.id, client);
    this.logger.log(`setup client ${client.id}`);
    client.addDispose(
      client.onExit((e) => {
        // 在这个函数内不要 removeWidget，会导致 TerminalTask 场景下任务执行完毕直接退出而不是用户手动触发 onKeyDown 退出

        this._onDidCloseTerminal.fire({ id: client.id, code: e.code });
      }),
    );

    client.addDispose(
      client.onTitleChange((e) => {
        this._onDidTerminalTitleChange.fire({ id: client.id, name: e.name });
      }),
    );

    client.addDispose({
      dispose: () => {
        this._clients.delete(client.id);
        this._onDidCloseTerminal.fire({ id: client.id, code: -1 });
      },
    });

    client.addDispose(
      client.onLinksReady(() => {
        this._setInstanceLinkProviders(client);
      }),
    );

    this._onDidOpenTerminal.fire({
      id: client.id,
      name: client.name,
      isActive: false,
    });

    this.terminalView.selectWidget(widget.id);

    return client;
  }

  private _disposeClient(widget: IWidget) {
    const client = this.findClientFromWidgetId(widget.id);
    client && client.dispose();
  }

  constructor() {
    super();
    this._focus = false;
    this._clients = new Map();
  }

  private _createOneGroup(options?: IShellLaunchConfig) {
    const index = this.terminalView.createGroup(options);
    const group = this.terminalView.getGroup(index);
    return { group, index };
  }

  private _reset() {
    const { group } = this._createOneGroup();
    const widget = this.terminalView.createWidget(group);
    return widget;
  }

  async recovery(history: ITerminalBrowserHistory) {
    // Electron的环境下，不启用终端恢复能力
    // 而且在Electron的环境下，clientId的获取方式也不一样，但因为不启用恢复能力，所以后面的代码也无需做额外处理
    if (this.config.isElectronRenderer && !this.config.isRemote) {
      return;
    }

    // 先对recovery数据做一个简单校验，因为之前groups数据可能是字符串或object，而现在抛弃了字符串的方式
    // 所以为了避免旧逻辑写入localStorage的数据混乱，这里做一个简单的校验
    if (!history.current || !history?.groups?.[0]?.[0]?.client) {
      return;
    }

    // HACK: 因为现在的终端重连是有问题的，是ClientID机制导致的，因此在拿出记录恢复终端的时候，需要把里面的ClientID替换为当前活跃窗口的ClientID
    // 同时在独立PtyService中，把终端重连的标识转变为真正的realSessionId  也就是 ${clientId}|${realSessionId}
    const currentRealSessionId = history.current?.split(TERMINAL_ID_SEPARATOR)?.[1];
    if (history.current && history.current.includes(TERMINAL_ID_SEPARATOR)) {
      history.current = `${this.clientId}|${currentRealSessionId}`;
    }
    history.groups = history.groups.map((group) => {
      if (Array.isArray(group)) {
        // 替换clientId为当前窗口ClientID
        return group
          .map(({ client, ...other }) => {
            if (other.task) {
              // #1531 不恢复 Task 类型的终端
              return undefined;
            }
            return {
              client: client.includes(TERMINAL_ID_SEPARATOR)
                ? `${this.clientId}${TERMINAL_ID_SEPARATOR}${(client as string)?.split(TERMINAL_ID_SEPARATOR)?.[1]}`
                : client,
              ...other,
            };
          })
          .filter(Boolean) as { client: string }[];
      } else {
        return group;
      }
    });

    let currentWidgetId = '';
    let firstAvailableId = '';
    const { groups, current } = history;

    // const ids: (string | { client: string })[] = [];

    // groups.forEach((widgets) => ids.push(...widgets.map((widget) => widget.client)));

    // 之前OpenSumi的Check终端活跃机制是有问题的，暂时不启用，这部分逻辑在PtyService会兜住
    // const checked = await this.service.check(ids.map((id) => (typeof id === 'string' ? id : id.clientId)));
    // if (!checked) {
    //   return;
    // }

    for (const widgets of groups) {
      if (!widgets) {
        continue;
      }
      if (widgets.length === 0) {
        continue;
      }

      const { group } = this._createOneGroup();

      const promises = [] as Promise<void>[];
      for (const session of widgets) {
        if (!session) {
          continue;
        }
        promises.push(
          (async () => {
            /**
             * widget 创建完成后会同时创建 client
             */
            const widget = this.terminalView.createWidget(
              group,
              typeof session === 'string' ? session : session.client,
              !!session.task,
            );
            const client = await this.clientFactory(widget);

            // 终端被Resume的场景下也要绑定终端事件，避免意料之外的BUG
            this.setupClient(widget, client);

            if (session.task) {
              client.isTaskExecutor = true;
              client.taskId = session.task;
            }

            this._clients.set(client.id, client);

            if (current === client.id) {
              currentWidgetId = widget.id;
            }
            if (!firstAvailableId) {
              firstAvailableId = widget.id;
            }
            /**
             * 等待预先连接成功
             */
            client.attached.promise.then(() => {
              widget.name = client.name;
              // client.term.writeln('\x1b[2mTerminal restored\x1b[22m');

              /**
               * 不成功的时候则认为这个连接已经失效了，去掉这个 widget
               */
              if (!client.ready) {
                this.terminalView.removeWidget(widget.id);
              }
            });
          })(),
        );
      }

      await Promise.all(promises);
    }

    const selectedIndex = this.terminalView.groups.findIndex((group) => group.widgetsMap.has(currentWidgetId));

    if (selectedIndex > -1 && currentWidgetId) {
      this.terminalView.selectWidget(currentWidgetId);
    } else if (firstAvailableId) {
      this.terminalView.selectWidget(firstAvailableId);
    }
  }

  initContextKey(dom: HTMLDivElement) {
    if (!this.terminalContextKey) {
      this.terminalContextKey = this.injector.get(TerminalContextKey, [dom]);
      this.terminalContextKey.isTerminalFocused.set(this._focus);
      this.terminalContextKey.isTerminalViewInitialized.set(true);
    }
  }

  async firstInitialize() {
    await Promise.race([
      (async () => {
        await this.layoutService.viewReady.promise;
        await this.viewReady.promise;
      })(),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          this.logger.warn("TerminalView didn't initialize in 2s, skip waiting, but may cause some problem");
          resolve();
        }, 2000);
      }),
    ]);

    this._tabBarHandler = this.layoutService.getTabbarHandler(TERMINAL_CONTAINER_ID);
    this.themeBackground = this.terminalTheme.terminalTheme.background || '';

    this.addDispose(
      this.terminalView.onWidgetCreated((widget) => {
        this._createClientOrIgnore(widget);
      }),
    );

    this.addDispose(
      this.terminalView.onWidgetDisposed((widget) => {
        this._disposeClient(widget);
      }),
    );

    this.addDispose(
      this.terminalView.onWidgetEmpty(() => {
        this.hideTerminalPanel();
      }),
    );

    this.addDispose(
      this.terminalView.onWidgetSelected((widget) => {
        const client = this.findClientFromWidgetId(widget.id);
        if (client) {
          this._onDidChangeActiveTerminal.fire(client.id);
          if (client.ready) {
            // 事件是同步触发的，事件发出时，界面可能还没更新完成，所以加个延迟
            // 当前选中的 client 已经完成渲染，聚焦
            setTimeout(() => {
              client.focus();
            });
          }
        }
        this._activeClientId = client?.id;
      }),
    );

    this.addDispose(
      this.themeService.onThemeChange(() => {
        this._clients.forEach((client) => {
          client.updateTheme();
        });
        this.themeBackground = this.terminalTheme.terminalTheme.background || '';
      }),
    );

    this.addDispose(
      this.eventBus.on(ResizeEvent, (e: ResizeEvent) => {
        if (
          this._tabBarHandler &&
          this._tabBarHandler.isActivated() &&
          e.payload.slotLocation === getSlotLocation('@opensumi/ide-terminal-next', this.config.layoutConfig)
        ) {
          this.terminalView.resize();
        }
      }),
    );

    this.registerContributedProfilesCommandAndMenu();
    this.addDispose(
      this.profileService.onDidChangeAvailableProfiles(() => {
        this.registerContributedProfilesCommandAndMenu();
      }),
    );

    if (this._tabBarHandler) {
      this.addDispose(
        this._tabBarHandler.onActivate(() => {
          if (this.terminalView.empty()) {
            const current = this._reset();
            this.terminalView.selectWidget(current.id);
          } else {
            this.terminalView.selectGroup(
              this.terminalView.currentGroupIndex > -1 ? this.terminalView.currentGroupIndex : 0,
            );
          }
        }),
      );

      this.addDispose(
        this._tabBarHandler.onInActivate(() => {
          if (this.editorService.currentEditor) {
            this.editorService.currentEditor.monacoEditor.focus();
          }
        }),
      );

      if (this._tabBarHandler.isActivated()) {
        if (this.terminalView.empty()) {
          const widget = this._reset();
          this.terminalView.selectWidget(widget.id);
        } else {
          this.terminalView.selectGroup(
            this.terminalView.currentGroupIndex > -1 ? this.terminalView.currentGroupIndex : 0,
          );
        }
      }
    }

    this.terminalContextKey.isTerminalViewInitialized.set(true);
    this._ready.resolve();
  }

  async reconnect() {
    const clients = Array.from(this._clients.values());
    const canReconnected = await this.service.check(clients.map((client) => client.id));

    if (!canReconnected) {
      this.terminalView.clear();
      this._reset();
    }
  }

  focus() {
    this._focus = true;
    this.terminalContextKey.isTerminalFocused.set(true);
  }

  blur() {
    this._focus = false;
    this.terminalContextKey.isTerminalFocused.set(false);
  }

  onContextMenu(e: React.MouseEvent<HTMLElement>): void {
    e.preventDefault();
    const menus = this.menuService.createMenu(MenuId.TerminalInstanceContext);
    const menuNodes = generateCtxMenu({ menus });
    this.ctxMenuRenderer.show({
      menuNodes: menuNodes[1],
      anchor: {
        x: e.clientX,
        y: e.clientY,
      },
    });
  }

  toJSON() {
    const groups: { client: string }[][] = [];
    let cClient = this._clients.get(this.terminalView.currentWidgetId);
    this.terminalView.groups.forEach((wGroup) => {
      const group: { client: string }[] = [];

      wGroup.widgets.forEach((widget) => {
        const client = this._clients.get(widget.id);
        const disablePersistence =
          !this.preferenceService.get(CodeTerminalSettingId.EnablePersistentSessions) ||
          client?.launchConfig?.disablePersistence;

        if (!client || disablePersistence || client?.isTaskExecutor) {
          return;
        }

        if (!cClient) {
          cClient = client;
        }

        const record: { client: string } = { client: client.id };
        group.push(record);
      });

      if (group.length > 0) {
        groups.push(group);
      }
    });

    return {
      groups,
      current: cClient && cClient.id,
    };
  }

  disposeTerminalClients(filter?: TerminalCliterFilter) {
    const clients = Array.from(this.clients.values()).filter(
      (client) =>
        client.id === filter?.id || client.isTaskExecutor === filter?.isTaskExecutor || client.name === filter?.name,
    );

    for (const client of clients) {
      try {
        client.dispose();
      } catch (err) {
        //
      }
    }
  }

  findClientFromWidgetId(widgetId: string) {
    return this._clients.get(widgetId);
  }

  public convertTerminalOptionsToLaunchConfig(options: TerminalOptions): IShellLaunchConfig {
    const shellLaunchConfig: IShellLaunchConfig = {
      name: options.name,
      executable: withNullAsUndefined(options.shellPath),
      args: withNullAsUndefined(options.shellArgs),
      cwd: withNullAsUndefined(options.cwd),
      env: withNullAsUndefined(options.env),
      icon: withNullAsUndefined(asTerminalIcon(options.iconPath)),
      color: isThemeColor(options.color) ? options.color.id : undefined,
      initialText: withNullAsUndefined(options.message),
      strictEnv: withNullAsUndefined(options.strictEnv),
      hideFromUser: withNullAsUndefined(options.hideFromUser),
      // isFeatureTerminal: withNullAsUndefined(options?.isFeatureTerminal),
      isExtensionOwnedTerminal: options.isExtensionTerminal,
      // useShellEnvironment: withNullAsUndefined(internalOptions?.useShellEnvironment),
      // 只支持 Panel
      location: TerminalLocation.Panel,
      disablePersistence: withNullAsUndefined(options.isTransient),
    };
    shellLaunchConfig.__fromTerminalOptions = options;
    return shellLaunchConfig;
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

  async createTerminalWithWidgetByTerminalOptions(options: ICreateClientWithWidgetOptions) {
    const launchConfig = this.convertTerminalOptionsToLaunchConfig(options.terminalOptions);
    return this.createTerminalWithWidget({
      ...options,
      config: launchConfig,
    });
  }

  async createTerminal(options: ICreateTerminalOptions) {
    const widgetId = options.id || this.service.generateSessionId();
    const { group } = this._createOneGroup();
    const widget = this.terminalView.createWidget(group, widgetId, false, true);

    const client = await this._createClient(widget, options);

    return client;
  }
  async createTerminalWithWidget(options: ICreateTerminalOptions) {
    const widgetId = options.id ? this.clientId + TERMINAL_ID_SEPARATOR + options.id : this.service.generateSessionId();
    // 这里转一遍是为了拿到 LaunchConfig，但是在 TerminalClient 内部还是会对 options.config 做可用检测并转换
    const launchConfig = this.convertProfileToLaunchConfig(options.config);

    const { group } = this._createOneGroup(launchConfig);
    const widget = this.terminalView.createWidget(
      group,
      widgetId,
      options.isTaskExecutor || !options.closeWhenExited,
      true,
    );

    if (options.beforeCreate && typeof options.beforeCreate === 'function') {
      options.beforeCreate(widgetId);
    }

    const client = await this._createClient(widget, {
      id: widgetId,
      config: launchConfig,
      cwd: options?.cwd,
      location: options?.location,
      resource: options?.resource,
    });

    if (options.isTaskExecutor) {
      client.isTaskExecutor = true;
      client.taskId = options.taskId;
    }
    return client;
  }

  clearCurrentGroup() {
    this.terminalView.currentGroup &&
      this.terminalView.currentGroup.widgets.forEach((widget) => {
        const client = this._clients.get(widget.id);
        if (client) {
          client.clear();
        }
      });
  }

  clearAllGroups() {
    this._clients.forEach((client) => {
      if (client) {
        client.clear();
      }
    });
  }

  showTerminalPanel() {
    if (this._tabBarHandler) {
      this._tabBarHandler.activate();
    }
  }

  hideTerminalPanel() {
    if (this._tabBarHandler && this._tabBarHandler.isActivated()) {
      this._tabBarHandler.deactivate();
    }
  }

  toggleTerminalPanel() {
    if (!this._tabBarHandler) {
      return;
    }
    if (this._tabBarHandler.isActivated()) {
      this._tabBarHandler.deactivate();
    } else {
      this._tabBarHandler.activate();
    }
  }

  requestStartExtensionTerminal(
    proxy: ITerminalProcessExtHostProxy,
    cols: number,
    rows: number,
  ): Promise<ITerminalLaunchError | undefined> {
    // The initial request came from the extension host, no need to wait for it
    return new Promise<ITerminalLaunchError | undefined>((callback) => {
      this._onInstanceRequestStartExtensionTerminal.fire({ proxy, cols, rows, callback });
    });
  }

  public registerLinkProvider(linkProvider: ITerminalExternalLinkProvider): IDisposable {
    const disposable = new DisposableStore();
    this._linkProviders.add(linkProvider);
    for (const client of this._clients.values()) {
      if (client.areLinksReady) {
        disposable.add(client.registerLinkProvider(linkProvider));
      }
    }
    this._linkProviderDisposables.set(linkProvider, disposable);
    return {
      dispose: () => {
        const disposable = this._linkProviderDisposables.get(linkProvider);
        disposable?.dispose();
        this._linkProviders.delete(linkProvider);
      },
    };
  }

  private _setInstanceLinkProviders(instance: ITerminalClient): void {
    for (const linkProvider of this._linkProviders) {
      const disposable = this._linkProviderDisposables.get(linkProvider);
      const provider = instance.registerLinkProvider(linkProvider);
      disposable?.add(provider);
    }
  }

  private registerContributedProfilesCommandAndMenu() {
    if (this.commandAndMenuDisposeCollection) {
      this.commandAndMenuDisposeCollection.dispose();
    }
    this.commandAndMenuDisposeCollection = new DisposableCollection();
    // 展示在下拉列表的数据
    const notAutoDetectedProfiles = this.profileService.availableProfiles.filter((profile) => !profile.isAutoDetected);
    notAutoDetectedProfiles.forEach((profile) => {
      const id = `TerminalProfilesCommand:${profile.path}:${profile.profileName}`;
      this.commandAndMenuDisposeCollection.push(
        this.commandRegistry.registerCommand(
          {
            id,
          },
          {
            execute: async () => {
              await this.createTerminal({
                config: profile,
              });
            },
          },
        ),
      );
      this.commandAndMenuDisposeCollection.push(
        this.menuRegistry.registerMenuItem(MenuId.TerminalNewDropdownContext, {
          command: {
            id,
            label: profile.profileName || 'unknown profile',
          },
        }),
      );
    });
    this.profileService.contributedProfiles.forEach((profile) => {
      const id = `TerminalProfilesCommand:${profile.extensionIdentifier}:${profile.id}`;
      this.commandAndMenuDisposeCollection.push(
        this.commandRegistry.registerCommand(
          {
            id,
          },
          {
            execute: async () => {
              await this.profileService.createContributedTerminalProfile(profile.extensionIdentifier, profile.id, {
                icon: profile.icon,
              });
            },
          },
        ),
      );
      this.commandAndMenuDisposeCollection.push(
        this.menuRegistry.registerMenuItem(MenuId.TerminalNewDropdownContext, {
          command: {
            id,
            label: replaceLocalizePlaceholder(profile.title) || profile.title || 'unknown profile',
          },
        }),
      );
    });
  }
}
