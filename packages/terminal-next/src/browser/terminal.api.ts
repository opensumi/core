import { Injectable, Autowired } from '@ali/common-di';
import { Event, Emitter } from '@ali/ide-core-common';
import { ITerminalApiService, ITerminalGroupViewService, ITerminalController, ITerminalInfo, TerminalOptions, ITerminalExternalClient, ITerminalInternalService } from '../common';

@Injectable()
export class TerminalApiService implements ITerminalApiService {
  private _onDidOpenTerminal = new Emitter<ITerminalInfo>();
  private _onDidCloseTerminal = new Emitter<string>();
  private _onDidChangeActiveTerminal = new Emitter<string>();

  readonly onDidOpenTerminal: Event<ITerminalInfo> = this._onDidOpenTerminal.event;
  readonly onDidCloseTerminal: Event<string> = this._onDidCloseTerminal.event;
  readonly onDidChangeActiveTerminal: Event<string> = this._onDidChangeActiveTerminal.event;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalInternalService)
  protected readonly service: ITerminalInternalService;

  protected _entries = new Map<string, ITerminalExternalClient>();

  get terminals() {
    return Array.from(this._entries.values()).map((v) => {
      return {
        id: v.id,
        name: v.name,
        isActive: this.view.currentWidgetId === v.id,
      };
    });
  }

  createTerminal(options: TerminalOptions): ITerminalExternalClient {
    const self = this;
    const client = this.controller.createClientWithWidget(options);

    const external = {
      get id() { return client.id; },
      get processId() { return client.pid; },
      get name() { return client.name; },
      show() {
        const widget = client.widget;
        self.view.selectWidget(widget.id);
        self.controller.showTerminalPanel();
      },
      hide() {
        self.controller.hideTerminalPanel();
      },
      dispose() {
        self.view.removeWidget(client.widget.id);
        self._entries.delete(client.id);
      },
      ready() {
        return client.attached.promise;
      },
    };

    this._entries.set(client.id, external);

    return external;
  }

  getProcessId(sessionId: string) {
    return this.service.getProcessId(sessionId);
  }

  sendText(id: string, text: string, addNewLine = true) {
    this.service.sendText(id, `${text}${addNewLine ? '\r' : ''}`);
  }

  showTerm(clientId: string, preserveFocus: boolean = true) {
    const client = this.controller.clients.get(clientId);

    if (!client) {
      return;
    }

    const widget = client.widget;
    this.controller.showTerminalPanel();
    if (preserveFocus) {
      this.view.selectWidget(widget.id);
    }
  }

  hideTerm(_: string) {
    this.controller.hideTerminalPanel();
  }

  removeTerm(clientId: string) {
    const client = this.controller.clients.get(clientId);

    if (!client) {
      return;
    }

    this.view.removeWidget(client.id);
    this._entries.delete(client.id);
  }
}
