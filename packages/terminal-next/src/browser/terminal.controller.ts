import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, Emitter } from '@ali/ide-core-common';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { TabBarHandler } from '@ali/ide-main-layout/lib/browser/tabbar-handler';
import { IThemeService } from '@ali/ide-theme';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ITerminalController, ITerminalClient, ITerminalClientFactory, IWidget, ITerminalInfo, ITerminalBrowserHistory, ITerminalTheme, ITerminalGroupViewService, TerminalOptions, ITerminalErrorService, ITerminalInternalService } from '../common';
import { TerminalGroupViewService } from './terminal.view';
import { TerminalContextKey } from './terminal.context-key';
import { ResizeEvent, getSlotLocation, AppConfig } from '@ali/ide-core-browser';

@Injectable()
export class TerminalController extends WithEventBus implements ITerminalController {
  protected _focus: boolean;
  protected _tabbarHandler: TabBarHandler | undefined;
  protected _clients: Map<string, ITerminalClient>;
  protected _onDidOpenTerminal = new Emitter<ITerminalInfo>();
  protected _onDidCloseTerminal = new Emitter<string>();

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

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  @Autowired(ITerminalErrorService)
  protected readonly errorService: ITerminalErrorService;

  @Autowired(TerminalContextKey)
  protected readonly terminalContextKey: TerminalContextKey;

  @Autowired(AppConfig)
  config: AppConfig;

  @observable
  themeBackground: string;

  get clients() {
    return this._clients;
  }

  get focused() {
    return this._focus;
  }

  private _createClient(widget: IWidget, options = {}, autofocus = true) {
    if (this._clients.has(widget.id)) {
      return;
    }

    const client = this.clientFactory(widget, options, autofocus);
    this._clients.set(client.id, client);

    client.addDispose({
      dispose: () => {
        this._clients.delete(client.id);
        this._onDidCloseTerminal.fire(client.id);
      },
    });

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
    let currentWidgetId: string = '';
    const { groups, current } = history;

    const ids: (string | { clientId: string })[] = [];

    groups.forEach((widgets) => ids.concat(widgets));
    const checked = await this.service.check(ids.map((id) => typeof id === 'string' ? id : id.clientId));

    if (!checked) {
      return;
    }

    for (const widgets of groups) {
      const { group, index } = this._createOneGroup();

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
        const widget = this.terminalView.createWidget(group,
          typeof sessionId === 'string' ? sessionId : sessionId.clientId);
        const client = this.clientFactory(widget, {}, false);
        this._clients.set(client.id, client);

        /**
         * 恢复旧的终端需要尝试预先连接后端
         */
        await client.attach();
        widget.name = client.name;

        /**
         * 不成功的时候则认为这个连接已经失效了，去掉这个 widget
         */
        if (!client.ready) {
          this.terminalView.removeWidget(widget.id);
        } else if (current === client.id) {
          currentWidgetId = widget.id;
        }
      }

      if (group.length === 0) {
        this.terminalView.removeGroup(index);
      }
    }

    let selectedIndex = -1;
    this.terminalView.groups.forEach((group, index) =>
      Array.from(group.widgetsMap.keys()).find((v) => v === currentWidgetId)
      && (selectedIndex = index));

    if (selectedIndex > -1 && currentWidgetId) {
      this.terminalView.selectWidget(currentWidgetId);
    }
  }

  firstInitialize() {
    this._tabbarHandler = this.layoutService.getTabbarHandler('terminal')!;
    this.themeBackground = this.terminalTheme.terminalTheme.background || '';
    this.terminalContextKey.isTerminalFocused.set(this._focus);
    this.terminalContextKey.isTerminalViewInitialized.set(true);

    this.addDispose(this.terminalView.onWidgetCreated((widget) => {
      this._createClient(widget, {}, true);
    }));

    this.addDispose(this.terminalView.onWidgetSelected(async (widget) => {
      const client = this._clients.get(widget.id);
      if (client) {
        await client.attached.promise;
        setTimeout(() => {
          client.layout();
          client.focus();
        }, 0);
      }
    }));

    this.addDispose(this.terminalView.onWidgetDisposed((widget) => {
      this._disposeClient(widget);
    }));

    this.addDispose(this.terminalView.onWidgetEmpty(() => {
      this.hideTerminalPanel();
    }));

    this.addDispose(this.themeService.onThemeChange((_) => {
      this._clients.forEach((client) => {
        client.updateTheme();
        this.themeBackground = this.terminalTheme.terminalTheme.background || '';
      });
    }));

    this.addDispose(this.eventBus.on(ResizeEvent, (e: ResizeEvent) => {
      if (
        (this._tabbarHandler && this._tabbarHandler?.isActivated) &&
        e.payload.slotLocation === getSlotLocation('@ali/ide-terminal-next', this.config.layoutConfig)
      ) {
        this.terminalView.resize();
      }
    }));

    if (this._tabbarHandler) {
      this.addDispose(this._tabbarHandler.onActivate(() => {
        if (this.terminalView.empty()) {
          const current = this._reset();
          this.terminalView.selectWidget(current.id);
        } else {
          const widget = this.terminalView.currentWidget;
          this.terminalView.selectWidget(widget.id);
        }
      }));

      this.addDispose(this._tabbarHandler.onInActivate(() => {
        if (this.editorService.currentEditor) {
          this.editorService.currentEditor.monacoEditor.focus();
        }
      }));

      if (this._tabbarHandler.isActivated()) {
        if (this.terminalView.empty()) {
          const widget = this._reset();
          this.terminalView.selectWidget(widget.id);
        } else {
          this.terminalView.selectGroup(this.terminalView.currentGroupIndex > -1 ? this.terminalView.currentGroupIndex : 0);
        }
      }
    }

    this.terminalContextKey.isTerminalViewInitialized.set(true);
  }

  async reconnect() {
    const clients = Array.from(this._clients.values());
    const canReconnected = await this.service.check(clients.map((client) => client.id));

    if (!canReconnected) {
      this.terminalView.clear();
      this._reset();
    } else {
      clients.map((client) => {
        if (client) {
          client.attach();
        }
      });
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

  createClientWithWidget(options: TerminalOptions) {
    const widgetId = this.service.generateSessionId();
    const { group } = this._createOneGroup();
    // @ts-ignore
    this._clients.set(widgetId, undefined);
    const widget = this.terminalView.createWidget(group, widgetId, !options.closeWhenExited);
    return this.clientFactory(widget, options, false);
  }

  clearCurrentGroup() {
    this.terminalView.currentGroup && this.terminalView.currentGroup.widgets.forEach((widget) => {
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
}
