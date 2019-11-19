import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { uuid, CommandService, OnEvent, WithEventBus } from '@ali/ide-core-common';
import { ResizeEvent, getSlotLocation, AppConfig, SlotLocation } from '@ali/ide-core-browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { ActivityBarHandler } from '@ali/ide-activity-bar/lib/browser/activity-bar-handler';
import { TerminalClient } from './terminal.client';
import { WidgetGroup, Widget } from './component/resize.control';
import { ITerminalExternalService, ITerminalController, ITerminalError } from '../common';
import { ITerminalTheme } from './terminal.theme';

@Injectable()
export class TerminalController extends WithEventBus implements ITerminalController {
  @observable
  groups: WidgetGroup[] = [];

  @observable
  state: { index: number } = { index: -1 };

  @observable
  errors: Map<string, ITerminalError> = new Map();

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

  tabbarHandler: ActivityBarHandler;

  private _clientsMap = new Map<string, TerminalClient>();
  private _focusedId: string;

  get currentGroup() {
    return this.groups[this.state.index];
  }

  get focusedTerm() {
    return this._clientsMap.get(this._focusedId);
  }

  async recovery(history: any) {
    const { groups } = history;
    for (const widgets of (groups as any[])) {
      const index = this.createGroup(false);

      for (const item of (widgets as any[])) {
        const widget = new Widget();
        const client = new TerminalClient(this.service, this.termTheme, widget, item.clientId);
        try {
          await client.attach(true, item.meta || '');
          this._addWidgetToGroup(index, client);
        } catch { /** do nothing */ }
      }

      if (this.groups[index] && this.groups[index].length === 0) {
        this._removeGroupByIndex(index);
      }
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
    this.tabbarHandler = this.layoutService.getTabbarHandler('terminal');

    if (this._checkIfNeedInitialize() && this.tabbarHandler.isActivated()) {
      this.createGroup(true);
      this.addWidget();
    } else {
      this.selectGroup(0);
    }

    this.service.onError((error: ITerminalError) => {
      const { id: sessionId, stopped, reconnected = true } = error;

      if (!stopped) {
        return;
      }

      const [[widgetId]] = Array.from(this._clientsMap.entries())
        .filter(([_, client]) => client.id === sessionId);

      const last = this._clientsMap.get(widgetId);

      if (!last) {
        throw new Error('can not find stopped terminal client');
      }

      // 进行一次重试
      try {
        if (reconnected) {
          const widget = last.widget;
          const dom = last.container;
          const next = new TerminalClient(this.service, this.termTheme, widget, sessionId);
          const meta = this.service.meta(widgetId);
          last.dispose();
          this._clientsMap.set(widgetId, next);
          this.drawTerminalClient(dom, widgetId, true, meta);
        } else {
          this.errors.set(widgetId, error);
        }
      } catch {
        this.errors.set(widgetId, error);
      }
    });

    this.tabbarHandler.onActivate(() => {
      if (!this.currentGroup) {
        this.createGroup(true);
        this.addWidget();
      }
    });
  }

  removeFocused() {
    const group = this.currentGroup;
    const widget = group.widgetsMap.get(this._focusedId);
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

    this.focusWidget(this.currentGroup.last.id);
  }

  snapshot() {
    return 'Terminal';
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

  private _addWidgetToGroup(index: number, restoreClient?: TerminalClient) {
    const group = this.groups[index];
    const widget = restoreClient ? (restoreClient.widget as Widget) : new Widget(uuid());
    const client = restoreClient || new TerminalClient(this.service, this.termTheme, widget);
    this._clientsMap.set(widget.id, client);
    // 必须要延迟将 widget 添加到 group 的步骤
    group.createWidget(widget);

    if (this.currentGroup) {
      this.focusWidget(widget.id);
    }
  }

  addWidget(restoreClient?: TerminalClient) {
    return this._addWidgetToGroup(this.state.index, restoreClient);
  }

  focusWidget(widgetId: string) {
    const widget = this.currentGroup.widgetsMap.get(widgetId);
    const term = this._clientsMap.get(widgetId);

    if (term && widget) {
      term.focus();
      this._focusedId = widget.id;
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

  drawTerminalClient(dom: HTMLDivElement, widgetId: string, restore: boolean = false, meta: string = '') {
    const client = this._clientsMap.get(widgetId);

    if (client) {
      client.applyDomNode(dom);
      client.attach(restore);
      client.show();
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

    return { groups };
  }

  /** end */
}
