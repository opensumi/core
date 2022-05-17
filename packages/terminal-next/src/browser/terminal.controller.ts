import { observable } from 'mobx';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import { ResizeEvent, getSlotLocation, AppConfig } from '@opensumi/ide-core-browser';
import { ICtxMenuRenderer, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { generateCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/menu-util';
import { AbstractMenuService } from '@opensumi/ide-core-browser/lib/menu/next/menu.interface';
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
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { TabBarHandler } from '@opensumi/ide-main-layout/lib/browser/tabbar-handler';
import { IThemeService } from '@opensumi/ide-theme';

import {
  ITerminalController,
  ITerminalClient,
  ITerminalClientFactory,
  IWidget,
  ITerminalInfo,
  ITerminalBrowserHistory,
  ITerminalTheme,
  ITerminalGroupViewService,
  TerminalOptions,
  ITerminalErrorService,
  ITerminalInternalService,
  TerminalContainerId,
  ITerminalLaunchError,
  ITerminalProcessExtHostProxy,
  IStartExtensionTerminalRequest,
  ITerminalExitEvent,
  ITerminalExternalLinkProvider,
  ICreateTerminalOptions,
  ITerminalClientFactory2,
  ICreateClientWithWidgetOptions,
  ITerminalProfileService,
  ICreateContributedTerminalProfileOptions,
} from '../common';

import { TerminalContextKey } from './terminal.context-key';
import { TerminalGroupViewService } from './terminal.view';

@Injectable()
export class TerminalController extends WithEventBus implements ITerminalController {
  protected _focus: boolean;
  protected _tabBarHandler: TabBarHandler | undefined;
  protected _clients: Map<string, ITerminalClient>;
  protected _onDidOpenTerminal = new Emitter<ITerminalInfo>();
  protected _onDidCloseTerminal = new Emitter<ITerminalExitEvent>();
  protected _onDidChangeActiveTerminal = new Emitter<string>();
  protected _ready = new Deferred<void>();
  protected _activeClientId?: string;

  private _linkProviders: Set<ITerminalExternalLinkProvider> = new Set();
  private _linkProviderDisposables: Map<ITerminalExternalLinkProvider, DisposableStore> = new Map();

  readonly onDidOpenTerminal: Event<ITerminalInfo> = this._onDidOpenTerminal.event;
  readonly onDidCloseTerminal: Event<ITerminalExitEvent> = this._onDidCloseTerminal.event;
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

  @Autowired(ITerminalClientFactory)
  protected readonly clientFactory: ITerminalClientFactory;

  @Autowired(ITerminalClientFactory2)
  protected readonly clientFactory2: ITerminalClientFactory2;

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

  @Autowired(WSChannelHandler)
  protected readonly wsChannelHandler: WSChannelHandler;

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

  private async _createClientOrIgnore(widget: IWidget) {
    if (this._clients.has(widget.id)) {
      return this._clients.get(widget.id)!;
    }
    return await this._createClient(widget);
  }

  private async _createClient(widget: IWidget, options?: ICreateTerminalOptions | TerminalOptions | undefined) {
    let client: ITerminalClient;

    if (!options || (options as ICreateTerminalOptions).config || Object.keys(options).length === 0) {
      client = await this.clientFactory2(widget, options);
      this.logger.log('create client with clientFactory2', client);
    } else {
      client = await this.clientFactory(widget, options);
      this.logger.log('create client with clientFactory', client);
    }
    return this.setupClient(widget, client);
  }

  setupClient(widget: IWidget, client: ITerminalClient) {
    this._clients.set(client.id, client);
    this.logger.log(`setup client ${client.id}`);
    client.addDispose(
      client.onExit((e) => {
        this._onDidCloseTerminal.fire({ id: client.id, code: e.code });
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

  private _createOneGroup() {
    const index = this.terminalView.createGroup();
    const group = this.terminalView.getGroup(index);
    return { group, index };
  }

  private _reset() {
    const { group } = this._createOneGroup();
    const widget = this.terminalView.createWidget(group);
    return widget;
  }

  async recovery(history: ITerminalBrowserHistory) {
    // HACK: 因为现在的终端重连是有问题的，是ClientID机制导致的，因此在拿出记录恢复终端的时候，需要把里面的ClientID替换为当前活跃窗口的ClientID
    // 同时在独立PtyService中，把终端重连的标识转变为真正的realSessionId  也就是 ${clientId}|${realSessionId}

    const currentClientId = this.wsChannelHandler.clientId;
    const currentRealSessionId = history.current?.split('|')?.[1];
    if (history.current) {
      history.current = `${currentClientId}|${currentRealSessionId}`;
    }
    history.groups = history.groups.map((group) => {
      if (Array.isArray(group)) {
        // 替换clientId为当前窗口ClientID
        return group.map(({ client, ...other }) => ({
          client: `${currentClientId}|${(client as string)?.split('|')?.[1]}`,
          ...other,
        }));
      } else {
        return group;
      }
    });

    let currentWidgetId = '';
    const { groups, current } = history;

    const ids: (string | { clientId: string })[] = [];

    groups.forEach((widgets) => ids.push(...widgets.map((widget) => widget.client)));

    // 之前OpenSumi的Check终端活跃机制是有问题的，暂时不启用，这部分逻辑在PtyService会兜住
    // const checked = await this.service.check(ids.map((id) => (typeof id === 'string' ? id : id.clientId)));
    // if (!checked) {
    //   return;
    // }

    for (const widgets of groups) {
      const { group } = this._createOneGroup();

      if (!widgets) {
        continue;
      }

      for (const session of widgets) {
        if (!session) {
          continue;
        }

        /**
         * widget 创建完成后会同时创建 client
         */
        const widget = this.terminalView.createWidget(
          group,
          typeof session === 'string' ? session : session.client,
          !!session.task,
        );
        const client = await this.clientFactory2(widget, {});

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
      }
    }

    const selectedIndex = this.terminalView.groups.findIndex((group) => group.widgetsMap.has(currentWidgetId));

    if (selectedIndex > -1 && currentWidgetId) {
      this.terminalView.selectWidget(currentWidgetId);
    }
  }

  initContextKey(dom: HTMLDivElement) {
    if (!this.terminalContextKey) {
      this.terminalContextKey = this.injector.get(TerminalContextKey, [dom]);
      this.terminalContextKey.isTerminalFocused.set(this._focus);
      this.terminalContextKey.isTerminalViewInitialized.set(true);
    }
  }

  firstInitialize() {
    this._tabBarHandler = this.layoutService.getTabbarHandler(TerminalContainerId);
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
      this.themeService.onThemeChange((_) => {
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
    const groups: { client: string; task?: string }[][] = [];
    const cClient = this._clients.get(this.terminalView.currentWidgetId);
    this.terminalView.groups.forEach((wGroup) => {
      const group: { client: string; task?: string }[] = [];

      wGroup.widgets.forEach((widget) => {
        const client = this._clients.get(widget.id);
        if (!client) {
          return;
        }

        if (client?.options?.isExtensionTerminal || client?.options?.isTransient) {
          return;
        }

        const record: { client: string; task?: string } = { client: client.id };
        if (client.isTaskExecutor) {
          record.task = client.taskId;
        }
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

  findClientFromWidgetId(widgetId: string) {
    return this._clients.get(widgetId);
  }

  /**
   * @deprecated 请使用 `createClientWithWidget2`. Will removed in 2.17.0
   */
  async createClientWithWidget(options: TerminalOptions) {
    return await this.createClientWithWidget2({
      terminalOptions: options,
      args: options.args,
      beforeCreate: options.beforeCreate,
      closeWhenExited: options.closeWhenExited,
    });
  }

  /**
   * @param options
   * @returns
   */
  async createClientWithWidget2(options: ICreateClientWithWidgetOptions) {
    const widgetId = this.wsChannelHandler.clientId + '|' + options.id || this.service.generateSessionId();
    const { group } = this._createOneGroup();
    const widget = this.terminalView.createWidget(
      group,
      widgetId,
      options.isTaskExecutor || !options.closeWhenExited,
      true,
    );

    if (options.beforeCreate && typeof options.beforeCreate === 'function') {
      options.beforeCreate(widgetId);
    }

    const client = await this._createClient(widget, options.terminalOptions);

    if (options.isTaskExecutor) {
      client.isTaskExecutor = true;
      client.taskId = options.taskId;
    }
    return client;
  }

  async createTerminal(options: ICreateTerminalOptions) {
    const widgetId = options.id || this.service.generateSessionId();
    const { group } = this._createOneGroup();
    const widget = this.terminalView.createWidget(group, widgetId, false, true);

    const client = await this._createClient(widget, options);

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
              await this.profileService.createContributedTerminalProfile(profile.extensionIdentifier, profile.id, {});
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
