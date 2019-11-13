import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { uuid, CommandService, OnEvent, WithEventBus, ThrottledDelayer } from '@ali/ide-core-common';
import { TerminalClient } from './terminal.client';
import { WidgetGroup } from './component/resize.control';
import { ITerminalExternalService, ITerminalController } from '../common';
import { toggleBottomPanel } from './terminal.command';
import { ITerminalTheme } from './terminal.theme';
import { ResizeEvent, getSlotLocation, AppConfig } from '@ali/ide-core-browser';

@Injectable()
export class TerminalController extends WithEventBus implements ITerminalController {
  @observable
  groups: WidgetGroup[] = [];

  @observable
  state: { index: number } = { index: -1 };

  @Autowired(ITerminalExternalService)
  service: ITerminalExternalService;

  @Autowired(CommandService)
  commands: CommandService;

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(ITerminalTheme)
  private termTheme: ITerminalTheme;

  private _clientsMap = new Map<string, TerminalClient>();
  private _focusedId: string;

  get currentGroup() {
    return this.groups[this.state.index];
  }

  get focusedTerm() {
    return this._clientsMap.get(this._focusedId);
  }

  firstInitialize() {
    this.createGroup();
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
          this.commands.executeCommand(toggleBottomPanel.id);
          return;
        }
      }
    }

    this.focusWidget(this.currentGroup.last.id);
  }

  snapshot() {
    return 'bash';
  }

  /** resize widget operations */

  private _delWidgetByIndex(index: number) {
    const group = this.currentGroup;
    const widget = group.removeWidgetByIndex(index);
    this._clientsMap.delete(widget.id);
  }

  addWidget() {
    const id = uuid();
    const group = this.currentGroup;
    const client = new TerminalClient(this.service, this.termTheme);
    this._clientsMap.set(id, client);
    group.createWidget(id);
    this.focusWidget(id);
  }

  focusWidget(widgetId: string) {
    const widget = this.currentGroup.widgetsMap.get(widgetId);
    const term = this._clientsMap.get(widgetId);

    if (term && widget) {
      term.focus();
      this._focusedId = widget.id;
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

  createGroup() {
    const group = new WidgetGroup();
    this.groups.push(group);
    this.selectGroup(this.groups.length - 1);
    this.addWidget();
  }

  /** end */

  /** terminal client operations */

  drawTerminalClient(dom: HTMLDivElement, widgetId: string) {
    const client = this._clientsMap.get(widgetId);

    if (client) {
      client.applyDomNode(dom);
      client.attach();
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
      this.currentGroup.widgets.forEach((widget) => {
        this.layoutTerminalClient(widget.id);
      });
    }
  }

  /** end */
}
