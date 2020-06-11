import { Terminal } from 'xterm';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { isElectronEnv, Emitter, ILogger, Event, isWindows } from '@ali/ide-core-common';
import { Emitter as Dispatcher } from 'event-kit';
import { electronEnv, AppConfig } from '@ali/ide-core-browser';
import { WSChannelHandler as IWSChanneHandler, RPCService } from '@ali/ide-connection';
import { generate, ITerminalExternalService, ITerminalInternalService, ITerminalError, ITerminalServiceClient, ITerminalServicePath, ITerminalConnection, IPtyExitEvent  } from '../common';

export interface EventMessage {
  data: string;
}

@Injectable()
export class TerminalInternalService implements ITerminalInternalService {
  @Autowired(ITerminalExternalService)
  service: ITerminalExternalService;

  generateSessionId() {
    return this.service.generateSessionId ? this.service.generateSessionId() : generate();
  }

  getOptions() {
    return this.service.getOptions ? this.service.getOptions() : {};
  }

  check(sessionIds: string[]) {
    return this.service.check ? this.service.check(sessionIds) : Promise.resolve(true);
  }

  attach(sessionId: string, xterm: Terminal, rows: number, cols: number, options = {}, type: string) {
    return this.service.attach(sessionId, xterm, rows, cols, options, type);
  }

  sendText(id: string, message: string) {
    return this.service.sendText(id, message);
  }

  resize(sessionId: string, cols: number, rows: number) {
    return this.service.resize(sessionId, cols, rows);
  }

  disposeById(sessionId: string) {
    return this.service.disposeById(sessionId);
  }

  getProcessId(sessionId: string) {
    return this.service.getProcessId(sessionId);
  }

  onError(handler: (error: ITerminalError) => void) {
    return this.service.onError(handler);
  }

  onExit(handler: (event: IPtyExitEvent) => void) {
    return this.service.onExit(handler);
  }
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

  private _onExit = new Emitter<IPtyExitEvent>();
  public onExit: Event<IPtyExitEvent> = this._onExit.event;

  private _dispatcher = new Dispatcher();

  generateSessionId() {
    if (isElectronEnv()) {
      return electronEnv.metadata.windowClientId + '|' + generate();
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      return WSChanneHandler.clientId + '|' + generate();
    }
  }

  async check(ids: string[]) {
    const ensureResult = await this.service.ensureTerminal(ids);
    return ensureResult;
  }

  private _createCustomWebSocket(sessionId: string, name: string): ITerminalConnection {
    return {
      name,
      readonly: false,
      onData: (handler: (value: string | ArrayBuffer) => void) => {
        return this._dispatcher.on(sessionId, handler);
      },
      sendData: (message: string) => {
        this.sendText(sessionId, message);
      },
    };
  }

  async attach(sessionId: string, _: Terminal, rows: number, cols: number, options = {}, type?: string) {
    let shellPath: string | undefined;
    // default 的情况交给系统环境来决定使用的终端类型
    if ( type === 'default') {
      type = undefined;
    }
    if (type) {
      if (isWindows) {
        shellPath = {
          ['cmd']: 'cmd.exe',
          ['powershell']: 'powershell.exe',
        }[type];
      } else {
        shellPath = `/bin/${type}`;
      }
    }
    const { name, pid } = await this.service.create(sessionId, rows, cols, {
      cwd: this.config.workspaceDir,
      shellPath,
      ...options,
    });

    if (!pid || !name) {
      return;
    }

    return this._createCustomWebSocket(sessionId, name);
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

  disposeById(sessionId: string) {
    this.service.disposeById(sessionId);
  }

  async getProcessId(sessionId: string) {
    return this.service.getProcessId(sessionId);
  }

  /**
   * for pty node
   *
   * @param sessionId
   * @param type
   * @param message
   */
  onMessage(sessionId: string, message: string) {
    this._dispatcher.emit(sessionId, message);
  }

  /**
   * for pty node
   *
   * @param sessionId
   */
  closeClient(sessionId: string, code?: number, signal?: number) {
    this._onExit.fire({ sessionId, code, signal });
  }
}
