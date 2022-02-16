import type vscode from 'vscode';
import { Injectable, Autowired } from '@opensumi/di';
import { Event, Emitter } from '@opensumi/ide-core-common';
import { capitalize } from 'lodash';
import {
  ITerminalApiService,
  ITerminalGroupViewService,
  ITerminalController,
  ITerminalInfo,
  ITerminalExternalClient,
  ITerminalInternalService,
  ITerminalNetwork,
  ITerminalExitEvent,
} from '../common';

@Injectable()
export class TerminalApiService implements ITerminalApiService {
  private _onDidOpenTerminal = new Emitter<ITerminalInfo>();
  private _onDidCloseTerminal = new Emitter<ITerminalExitEvent>();
  private _onDidChangeActiveTerminal = new Emitter<string>();

  readonly onDidOpenTerminal: Event<ITerminalInfo> = this._onDidOpenTerminal.event;
  readonly onDidCloseTerminal: Event<ITerminalExitEvent> = this._onDidCloseTerminal.event;
  readonly onDidChangeActiveTerminal: Event<string> = this._onDidChangeActiveTerminal.event;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  @Autowired(ITerminalNetwork)
  protected readonly network: ITerminalNetwork;

  protected _entries = new Map<string, ITerminalExternalClient>();

  constructor() {
    this.controller.onDidOpenTerminal((info) => {
      this._onDidOpenTerminal.fire(info);
    });

    this.controller.onDidCloseTerminal((e) => {
      this._onDidCloseTerminal.fire(e);
    });

    this.controller.onDidChangeActiveTerminal((id) => {
      this._onDidChangeActiveTerminal.fire(id);
    });
  }

  get terminals() {
    return Array.from(this.controller.clients.values()).map((v) => ({
      id: v.id,
      name: v.name,
      isActive: this.view.currentWidgetId === v.id,
    }));
  }

  async createTerminal(options: vscode.TerminalOptions): Promise<ITerminalExternalClient> {
    const client = await this.controller.createClientWithWidget2({
      terminalOptions: options,
    });

    const external = {
      get id() {
        return client.id;
      },
      get name() {
        return client.name;
      },
      get processId() {
        return client.pid;
      },
      show: (preserveFocus = true) => {
        const widget = client.widget;
        this.view.selectWidget(widget.id);
        this.controller.showTerminalPanel();

        if (!preserveFocus) {
          setTimeout(() => client.focus());
        }
      },
      hide: () => {
        this.controller.hideTerminalPanel();
      },
      dispose: () => {
        this.view.removeWidget(client.widget.id);
        this._entries.delete(client.id);
      },
    };

    this._entries.set(client.id, external);

    await client.attached.promise;

    external.show();

    return external;
  }

  getProcessId(sessionId: string) {
    return this.service.getProcessId(sessionId);
  }

  sendText(id: string, text: string, addNewLine = true) {
    this.service.sendText(id, `${text}${addNewLine ? '\r' : ''}`);
  }

  showTerm(clientId: string, preserveFocus = true) {
    const client = this._entries.get(clientId);

    if (!client) {
      return;
    }

    client.show(preserveFocus);
  }

  hideTerm(clientId: string) {
    const client = this._entries.get(clientId);

    if (!client) {
      return;
    }

    client.hide();
  }

  removeTerm(clientId: string) {
    const client = this._entries.get(clientId);

    if (!client) {
      return;
    }

    client.dispose();
  }

  createWidget(uniqName: string, widgetRenderFunc: (element: HTMLDivElement) => void) {
    const widgetId = uniqName;
    const groupIndex = this.view.createGroup();
    const group = this.view.getGroup(groupIndex);
    const widget = this.view.createWidget(group, widgetId, false, true);
    widget.name = capitalize(uniqName);
    this.view.selectWidget(widgetId);

    widget.onRender(() => {
      widgetRenderFunc(widget.element);
    });

    return widget;
  }

  /**
   * 启动终端重连任务，可多次调用不会频繁触发，具体触发时机由底层控制
   */
  scheduleReconnection() {
    return this.network.scheduleReconnection();
  }
}
