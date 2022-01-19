import { observable } from 'mobx';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  WithEventBus,
  Emitter,
  Deferred,
  Event,
  IDisposable,
  DisposableStore,
  ILogger,
} from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { TabBarHandler } from '@opensumi/ide-main-layout/lib/browser/tabbar-handler';
import { IThemeService } from '@opensumi/ide-theme';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
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
} from '../common';
import { TerminalGroupViewService } from './terminal.view';
import { TerminalContextKey } from './terminal.context-key';
import { ResizeEvent, getSlotLocation, AppConfig } from '@opensumi/ide-core-browser';
import { AbstractMenuService } from '@opensumi/ide-core-browser/lib/menu/next/menu.interface';
import { generateCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/menu-util';
import { ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

@Injectable()
export class TerminalController extends WithEventBus implements ITerminalController {
  protected _focus: boolean;
  protected _tabbarHandler: TabBarHandler | undefined;
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
    let currentWidgetId = '';
    const { groups, current } = history;

    const ids: (string | { clientId: string })[] = [];

    groups.forEach((widgets) => ids.concat(widgets));
    const checked = await this.service.check(ids.map((id) => (typeof id === 'string' ? id : id.clientId)));

    if (!checked) {
      return;
    }

    for (const widgets of groups) {
      const { group } = this._createOneGroup();

      if (!widgets) {
        continue;
      }

      for (const sessionId of widgets) {
        if (!sessionId) {
          continue;
        }

        /**
         * widget 创建完成后会同时创建 client
         */
        const widget = this.terminalView.createWidget(
          group,
          typeof sessionId === 'string' ? sessionId : sessionId.clientId,
        );
        const client = await this.clientFactory(widget, {});
        this._clients.set(client.id, client);

        if (current === client.id) {
          currentWidgetId = widget.id;
        }

        /**
         * 等待预先连接成功
         */
        client.attached.promise.then(() => {
          widget.name = client.name;

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
    this._tabbarHandler = this.layoutService.getTabbarHandler(TerminalContainerId);
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
          this._tabbarHandler &&
          this._tabbarHandler.isActivated() &&
          e.payload.slotLocation === getSlotLocation('@opensumi/ide-terminal-next', this.config.layoutConfig)
        ) {
          this.terminalView.resize();
        }
      }),
    );

    if (this._tabbarHandler) {
      this.addDispose(
        this._tabbarHandler.onActivate(() => {
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
        this._tabbarHandler.onInActivate(() => {
          if (this.editorService.currentEditor) {
            this.editorService.currentEditor.monacoEditor.focus();
          }
        }),
      );

      if (this._tabbarHandler.isActivated()) {
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
    const groups: string[][] = [];
    const cClient = this._clients.get(this.terminalView.currentWidgetId);
    this.terminalView.groups.forEach((wGroup) => {
      const group: string[] = [];
      wGroup.widgets.forEach((widget) => {
        const client = this._clients.get(widget.id);

        if (!client) {
          return;
        }

        group.push(client.id);
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
   * @deprecated 请使用 `createClientWithWidget2`. Will removed in 2.14.0
   */
  async createClientWithWidget(options: TerminalOptions) {
    const widgetId = this.service.generateSessionId();
    const { group } = this._createOneGroup();
    const widget = this.terminalView.createWidget(group, widgetId, !options.closeWhenExited, true);

    if (options.beforeCreate && typeof options.beforeCreate === 'function') {
      options.beforeCreate(widgetId);
    }

    return await this._createClient(widget, options);
  }

  /**
   * @param options
   * @returns
   */
  async createClientWithWidget2(options: ICreateClientWithWidgetOptions) {
    const widgetId = this.service.generateSessionId();
    const { group } = this._createOneGroup();
    const widget = this.terminalView.createWidget(group, widgetId, !options.closeWhenExited, true);

    if (options.beforeCreate && typeof options.beforeCreate === 'function') {
      options.beforeCreate(widgetId);
    }

    return await this._createClient(widget, options.terminalOptions);
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
    if (this._tabbarHandler) {
      this._tabbarHandler.activate();
    }
  }

  hideTerminalPanel() {
    if (this._tabbarHandler && this._tabbarHandler.isActivated()) {
      this._tabbarHandler.deactivate();
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
}
