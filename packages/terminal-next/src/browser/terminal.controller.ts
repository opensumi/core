import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { uuid, CommandService, OnEvent, WithEventBus, Emitter, Event, ILogger } from '@ali/ide-core-common';
import { ResizeEvent, getSlotLocation, AppConfig, SlotLocation } from '@ali/ide-core-browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IThemeService } from '@ali/ide-theme/lib/common';
import { TerminalClient } from './terminal.client';
import { WidgetGroup, Widget } from './component/resize.control';
import { ITerminalExternalService, ITerminalController, ITerminalError, TerminalOptions, IWidget, TerminalInfo, ITerminalClient } from '../common';
import { ITerminalTheme } from './terminal.theme';
import { TabBarHandler } from '@ali/ide-main-layout/lib/browser/tabbar-handler';

@Injectable()
export class TerminalController extends WithEventBus implements ITerminalController {
  @observable
  groups: WidgetGroup[] = [];

  @observable
  state: { index: number } = { index: -1 };

  @observable
  errors: Map<string, ITerminalError> = new Map();

  @observable
  themeBackground: string;

  @Autowired(ITerminalExternalService)
  service: ITerminalExternalService;

  @Autowired(CommandService)
  commands: CommandService;

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(ITerminalTheme)
  private termTheme: ITerminalTheme;

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(ILogger)
  logger: ILogger;
  @Autowired(IThemeService)
  themeService: IThemeService;

  tabbarHandler: TabBarHandler;

  private _clientsMap = new Map<string, TerminalClient>();
  private _focusedId: string;

  private _onDidOpenTerminal = new Emitter<TerminalInfo>();
  private _onDidCloseTerminal = new Emitter<string>();
  private _onDidChangeActiveTerminal = new Emitter<string>();

  get currentGroup() {
    return this.groups[this.state.index];
  }

  get focusedTerm() {
    return this._clientsMap.get(this._focusedId);
  }

  public async reconnect() {
    let canReconnected = true;

    if (this.service.check) {
      canReconnected = await this.service.check(this.terminals.map((term) => term.id));
    }

    if (!canReconnected) {
      this.groups.forEach((_, index) => {
        this._removeGroupByIndex(index);
      });

      this.groups = [];
      this.createGroup(true);
      this.addWidget();
    } else {
      this.terminals.map((term) => {
        const client = this._clientsMap.get(term.id);
        if (client) {
          this.retryTerminalClient(client.widget.id);
        }
      });
    }
  }

  private _createTerminalClientInstance(widget: IWidget, restoreId?: string, options = {}) {
    const client = new TerminalClient(this.service, this.termTheme, this, widget, restoreId, options);
    client.addDispose({
      dispose: () => {
        this._onDidCloseTerminal.fire(client.id);
      },
    });
    this._onDidOpenTerminal.fire({
      id: client.id,
      name: client.name,
      isActive: false,
    });
    return client;
  }

  async recovery(history: any) {
    let currentWidgetId: string = '';
    const { groups, current } = history;
    for (const widgets of (groups as any[])) {
      const index = this.createGroup(false);

      for (const item of (widgets as any[])) {
        const widget = new Widget();
        const client = this._createTerminalClientInstance(widget, item.clientId);
        try {
          await client.attach(true, item.meta || '');
          this._addWidgetToGroup(index, client);

          if (current === client.id) {
            currentWidgetId = widget.id;
          }
        } catch { /** do nothing */ }
      }

      if (this.groups[index] && this.groups[index].length === 0) {
        this._removeGroupByIndex(index);
      }
    }

    let selectedIndex = -1;
    this.groups.forEach((group, index) =>
      Array.from(group.widgetsMap.keys()).find((v) => v === currentWidgetId)
      && (selectedIndex = index));

    if (selectedIndex > -1 && currentWidgetId) {
      this.selectGroup(selectedIndex);
      this._focusedId = currentWidgetId;
    }
  }

  private _checkIfNeedInitialize(): boolean {
    let needed = true;
    if (this.groups[0] && this.groups[0].length > 0) {
      needed = false;
    }
    return needed;
  }

  firstInitialize() {
    this.tabbarHandler = this.layoutService.getTabbarHandler('terminal')!;
    this.themeBackground = this.termTheme.terminalTheme.background || '';

    if (this.tabbarHandler.isActivated()) {
      if (this._checkIfNeedInitialize()) {
        this.createGroup(true);
        this.addWidget();
      } else {
        this.selectGroup(this.state.index > -1 ? this.state.index : 0);
      }
    }

    this.addDispose(this.service.onError((error: ITerminalError) => {
      const { id: sessionId, stopped, reconnected = true } = error;

      this.logger.log('TermError: ', error);

      if (!stopped) {
        return;
      }

      const [[widgetId]] = Array.from(this._clientsMap.entries())
        .filter(([_, client]) => client.id === sessionId);

      // 进行一次重试
      try {
        if (reconnected) {
          this.retryTerminalClient(widgetId);
        } else {
          this.errors.set(widgetId, error);
        }
      } catch {
        this.errors.set(widgetId, error);
      }
    }));

    this.addDispose(this.tabbarHandler.onActivate(() => {
      if (!this.currentGroup) {
        if (!this.groups[0]) {
          this.createGroup(true);
          this.addWidget();
        } else {
          this.selectGroup(0);
        }
      } else {
        this.currentGroup.widgets.forEach((widget) => {
          this.layoutTerminalClient(widget.id);
        });
      }
    }));

    this.addDispose(this.themeService.onThemeChange((theme) => {
      this._clientsMap.forEach((client) => {
        client.updateTheme();
        this.themeBackground = this.termTheme.terminalTheme.background || '';
      });
    }));
  }

  private _removeWidgetFromWidgetId(widgetId: string) {
    const group = this.currentGroup;
    const widget = group.widgetsMap.get(widgetId);
    const index = group.widgets.findIndex((w) => w === widget);
    const term = this.focusedTerm;

    if (term && widget) {
      term.dispose();
      this._delWidgetByIndex(index);

      if (this.currentGroup.length === 0) {
        this._removeGroupByIndex(this.state.index);
        this.selectGroup(Math.max(0, this.state.index - 1));

        if (this.groups.length === 0) {
          this.state.index = -1;
          this.layoutService.toggleSlot(SlotLocation.bottom);
          return;
        }
      }
    }
  }

  removeFocused() {
    this._removeWidgetFromWidgetId(this._focusedId);

    if (this.currentGroup &&
      this.currentGroup.length > 0 &&
      this.currentGroup.last) {
      this.focusWidget(this.currentGroup.last.id);
    }
  }

  snapshot(index: number) {
    let name = '';
    const group = this.groups[index];

    if (group) {
      const length = group.length;
      group.widgets.forEach((widget, index) => {
        const client = this._clientsMap.get(widget.id);
        if (client) {
          name += `${client.name}${index !== (length - 1) ? ', ' : ''}`;
        }
      });
    }

    return name || 'Terminal';
  }

  /** resize widget operations */

  private _delWidgetByIndex(index: number) {
    const group = this.currentGroup;
    const widget = group.widgets.find((_, i) => index === i);

    if (!widget) {
      throw new Error('widget not found');
    }

    const client = this._clientsMap.get(widget.id);

    if (!client) {
      throw new Error('session not found');
    }

    this._clientsMap.delete(widget.id);

    client.dispose();
    group.removeWidgetByIndex(index);
  }

  private _addWidgetToGroup(index: number, restoreClient?: TerminalClient, options?: TerminalOptions) {
    const group = this.groups[index];
    const widget = restoreClient ? (restoreClient.widget as Widget) : new Widget(uuid());
    const client = restoreClient || this._createTerminalClientInstance(widget, undefined, options);
    this._clientsMap.set(widget.id, client);
    // 必须要延迟将 widget 添加到 group 的步骤
    group.createWidget(widget);

    if (this.currentGroup) {
      this.focusWidget(widget.id);
    }

    return widget.id;
  }

  addWidget(restoreClient?: TerminalClient, options: TerminalOptions = {}) {
    return this._addWidgetToGroup(this.state.index, restoreClient, options);
  }

  focusWidget(widgetId: string) {
    const widget = this.currentGroup.widgetsMap.get(widgetId);
    const client = this._clientsMap.get(widgetId);

    if (client && widget) {
      client.focus();
      this._focusedId = widget.id;
      this._onDidChangeActiveTerminal.fire(client.id);
    }
  }

  removeWidget(widgetId: string) {
    const widget = this.currentGroup.widgetsMap.get(widgetId);
    const client = this._clientsMap.get(widgetId);

    if (widget && client) {
      this.focusWidget(widgetId);
      this.removeFocused();
      this._clientsMap.delete(widgetId);
      this.service.disposeById(client.id);
      client.dispose();
    }
  }

  /** end */

  /** resize view group operation */

  private _removeGroupByIndex(index: number) {
    this.groups.splice(index, 1);
  }

  selectGroup(index: number) {
    this.state.index = index;
  }

  createGroup(selected: boolean = true) {
    const group = new WidgetGroup();
    this.groups.push(group);
    if (selected) {
      this.selectGroup(this.groups.length - 1);
    }
    return this.groups.length - 1;
  }

  /** end */

  /** terminal client operations */

  async drawTerminalClient(dom: HTMLDivElement, widgetId: string, restore: boolean = false, extra: string = '') {
    let meta: string = extra;
    const client = this._clientsMap.get(widgetId);

    if (client) {
      try {
        meta = restore ? (meta || this.service.meta(widgetId)) : '';
      } catch {
        meta = '';
        restore = false;
      }
      client.applyDomNode(dom);
      try {
        await client.attach(restore, meta);
      } catch {
        this.errors.set(widgetId, {
          id: client.id,
          stopped: true,
          reconnected: false,
          message: 'terminal attached error',
        });
      }
    }
  }

  async showTerminalClient(widgetId: string) {
    const client = this._clientsMap.get(widgetId);
    if (client) {
      await client.show();
    }
  }

  async retryTerminalClient(widgetId: string) {
    let meta = '';
    const last = this._clientsMap.get(widgetId);

    if (!last) {
      throw new Error('widget not found');
    }

    const widget = last.widget;
    const dom = last.container.parentNode;

    if (!dom) {
      throw new Error('widget is not rendered');
    }

    const next = this._createTerminalClientInstance(widget, last.id, last.options);

    try {
      meta = this.service.meta(last.id);
    } catch { /** do nothing */ }

    last.dispose();
    this._clientsMap.set(widgetId, next);

    /**
     * 注意，这里先删除 widgetId 的原因是保证在后续渲染的时候，
     * 这个 widget 不会是 display none 的状态，
     * 防止 terminal fit 会出现错误。
     */
    this.errors.delete(widgetId);
    await this.drawTerminalClient(dom as HTMLDivElement, widgetId, true, meta);

    if (this.tabbarHandler.isActivated()) {
      this.layoutTerminalClient(widgetId);
    }
  }

  layoutTerminalClient(widgetId: string) {
    const client = this._clientsMap.get(widgetId);
    if (client) {
      client.layout();
    }
  }

  eraseTerminalClient(widgetId: string) {
    const client = this._clientsMap.get(widgetId);

    if (client) {
      client.hide();
    }
  }

  /** end */

  /** layout resize event */

  @OnEvent(ResizeEvent)
  onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === getSlotLocation('@ali/ide-terminal-next', this.config.layoutConfig)) {
      this.currentGroup && this.currentGroup.widgets.forEach((widget) => {
        this.layoutTerminalClient(widget.id);
      });
    }
  }

  /** end */

  /** save widget ids and client ids */

  toJSON() {
    const cClient = this._clientsMap.get(this._focusedId);
    const groups = this.groups.map((group) => {
      return group.widgets.map((widget, index) => {
        const client = this._clientsMap.get(widget.id);

        if (!client) {
          return null;
        }

        return {
          clientId: client.id,
          meta: this.service.meta(client.id),
          order: index,
        };
      });
    });

    return {
      groups,
      current: cClient && cClient.id,
    };
  }

  /** end */

  /** terminal operation*/

  get terminals() {
    const infos: TerminalInfo[] = [];
    this._clientsMap.forEach((client) => {
      infos.push({
        id: client.id,
        name: client.name,
        isActive: client.widget.id === this._focusedId,
      });
    });
    return infos;
  }

  createTerminal(options: TerminalOptions): ITerminalClient {
    this.createGroup(true);
    const widgetId = this.addWidget(undefined, options);
    const client = this._clientsMap.get(widgetId);

    if (!client) {
      throw new Error('session not find');
    }

    const target = client;
    const self = this;

    return {
      get id() { return target.id; },
      get processId() { return target.pid; },
      get name() { return target.name; },
      show() {
        self.tabbarHandler.activate();
        self.showTerm(client.id, true);
        self._focusedId = widgetId;
      },
      hide() { /** do nothing */ },
      dispose() {
        self._removeWidgetFromWidgetId(widgetId);
      },
    };
  }

  getProcessId(sessionId: string) {
    return this.service.getProcessId(sessionId);
  }

  readonly onDidOpenTerminal: Event<TerminalInfo> = this._onDidOpenTerminal.event;
  readonly onDidCloseTerminal: Event<string> = this._onDidCloseTerminal.event;
  readonly onDidChangeActiveTerminal: Event<string> = this._onDidChangeActiveTerminal.event;

  showTerm(clientId: string, preserveFocus: boolean = true) {
    let index: number = -1;

    const [[widgetId]] = Array.from(this._clientsMap.entries())
      .filter(([_, client]) => client.id === clientId);
    const client = this._clientsMap.get(widgetId);

    this.groups.forEach((group, i) => {
      if (group.widgetsMap.has(widgetId)) {
        index = i;
      }
    });

    if (index > -1 && client) {
      this._focusedId = widgetId;
      this.selectGroup(index);

      if (preserveFocus) {
        client.attach();
        client.focus();
      }
    }
  }

  isTermActive(clientId: string) {
    const current = this._clientsMap.get(this._focusedId);

    return !!(current && (current.id === clientId));
  }

  hideTerm(_: string) {
    // TODO: why should do this,
  }

  removeTerm(clientId: string) {
    const [[widgetId]] = Array.from(this._clientsMap.entries())
      .filter(([_, client]) => client.id === clientId);

    this._removeWidgetFromWidgetId(widgetId);
  }

  sendText(id: string, text: string, addNewLine = true) {
    this.service.sendText(id, `${text}${addNewLine ? '\r\n' : ''}`);
  }

  /** end */
}
