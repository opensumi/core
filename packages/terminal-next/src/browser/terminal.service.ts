import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { isElectronEnv, uuid, Emitter, ILogger, Event } from '@ali/ide-core-common';
import { Emitter as Dispatcher, Disposable as DispatcherDisposable } from 'event-kit';
import { electronEnv, AppConfig } from '@ali/ide-core-browser';
import { WSChanneHandler as IWSChanneHandler, RPCService } from '@ali/ide-connection';
import { Terminal } from 'xterm';
import { ITerminalExternalService, ITerminalError, ITerminalServiceClient, ITerminalServicePath  } from '../common';

export interface EventMessage {
  data: string;
}

function oneStringType(sessionId: string, type: string) {
  return `${sessionId}/${type}`;
}

@Injectable()
export class NodePtyTerminalService extends RPCService implements ITerminalExternalService {

  static countId = 1;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(ITerminalServicePath)
  service: ITerminalServiceClient;

  private _onError = new Emitter<ITerminalError>();
  public onError: Event<ITerminalError> = this._onError.event;

  private _dispatcher = new Dispatcher();
  private _info = new Map<string, { pid: number, name: string }>();

  async check(ids: string[]) {
    const ensureResult = await this.service.ensureTerminal(ids);
    return ensureResult;
  }

  getOptions() {
    return {};
  }

  intro(id: string) {
    return this._info.get(id);
  }

  makeId(createdId?: string) {
    if (isElectronEnv()) {
      return electronEnv.metadata.windowClientId + '|' + (createdId || uuid());
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      return WSChanneHandler.clientId + '|' + (createdId || uuid());
    }
  }

  meta() {
    return '';
  }

  restore() {
    return 'KAITIAN.RESTORE';
  }

  private _createCustomWebSocket(sessionId: string) {
    const disposeMap = new Map<string, DispatcherDisposable>();
    return {
      addEventListener: (type: string, handler: (value: any) => void) => {
        const dispose = this._dispatcher.on(oneStringType(sessionId, type), handler);
        disposeMap.set(type, dispose);
      },
      removeEventListener: (type: string) => {
        const dispose = disposeMap.get(type);
        if (dispose && !dispose.disposed) {
          dispose.dispose();
        }
      },
      send: (message: string) => {
        this.sendText(sessionId, message);
      },
      readyState: 1,
    };
  }

  async attach(sessionId: string, term: Terminal, restore: boolean, __: string, attachMethod: (s: WebSocket) => void, options = {}, type: string) {
    if (restore) {
      throw new Error('default terminal service not support restore');
    }
    const handler = this._createCustomWebSocket(sessionId);
    attachMethod(handler as any);
    const info = await this.service.create(sessionId, term.rows, term.cols, {
      ...options,
      cwd: this.config.workspaceDir,
      shellPath: `/bin/${type}`,
    });
    this._info.set(sessionId, info);
  }

  private _sendMessage(sessionId: string, json: any, requestId?: number) {
    const id = requestId || NodePtyTerminalService.countId++;

    this.service.onMessage(sessionId, JSON.stringify({
      id,
      ...json,
    }));
  }

  async sendText(sessionId: string, message: string) {
    this._sendMessage(sessionId, {
      data: message,
    });
  }

  async resize(sessionId: string, cols: number, rows: number) {
    this._sendMessage(sessionId, {
      method: 'resize',
      params: { cols, rows },
    });
  }

  async getProcessId(sessionId: string) {
    return this.service.getProcessId(sessionId);
  }

  disposeById(sessionId: string) {
    this.sendText(sessionId, '\u0004');
  }

  /**
   * for pty node
   *
   * @param sessionId
   * @param type
   * @param message
   */
  onMessage(sessionId: string, type: string, message: string) {
    this._dispatcher.emit(oneStringType(sessionId, type), {
      data: message,
    });
  }

  dispose() {
    Array.from(this._info.keys()).forEach((sessionId) => {
      this._onError.fire({
        id: sessionId,
        reconnected: false,
        stopped: true,
        message: 'disconnected',
      });
    });
  }
}
