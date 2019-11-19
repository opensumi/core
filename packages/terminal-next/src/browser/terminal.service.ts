import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { isElectronEnv, uuid, Emitter, ILogger } from '@ali/ide-core-common';
import { electronEnv } from '@ali/ide-core-browser';
import { WSChanneHandler as IWSChanneHandler } from '@ali/ide-connection';
import { ITerminalServiceClient, ITerminalServicePath } from '@ali/ide-terminal2/lib/common';
import { Terminal } from 'xterm';
import { ITerminalExternalService } from '../common';

export interface EventMessage {
  data: string;
}

export interface WebSocketLike {
  addEventListener: (type: string, event: EventMessage) => void;
  removeEventListener: (tyoe: string) => void;
  readyState: number;
}

/*
@Injectable()
export class NodePtyTerminalService implements ITerminalExternalService {
  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(ITerminalServicePath)
  private terminalService: ITerminalServiceClient;

  private eventMap: Map<string, Emitter<any>> = new Map();

  private _send(id: string, message: string) {
    this.terminalService.onMessage(id, message);
  }

  private _createMockSocket(id: string) {
    const self = this;
    return {
      addEventListener: (type: string, handler: (e: any) => void) => {
        this.logger.debug('terminal type:', type);
        const emitter = new Emitter<any>();
        emitter.event((event) => handler(event));
        self.eventMap.set(id + type, emitter);
      },
      send: (message: string) => {
        self._send(id, message);
      },
      readyState: 1,
    };
  }

  onMessage() {

  }

  makeId(createdId?: string) {
    if (isElectronEnv()) {
      return electronEnv.metadata.windowClientId + '|' + (createdId || uuid());
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      return WSChanneHandler.clientId + '|' + (createdId || uuid());
    }
  }

  getOptions() {
    return {};
  }

  async attach(sessionId: string, term: Terminal, restore: boolean, attachMethod: (s: WebSocket) => void) {
    const uuid = this.makeId();
    const sock = this._createMockSocket(uuid);

    (this.terminalService.create(uuid, 180, 45, {}) as Promise<{
      pid: number,
      name: string,
    }>)
      .then(() => {
        attachMethod(sock as any);
      });
  }

  async sendText(id: string, text: string, addNewLine?: boolean) {
    this._send(id, text + (!addNewLine ? `\r` : ''));
  }

  async resize() {

  }
}
*/
