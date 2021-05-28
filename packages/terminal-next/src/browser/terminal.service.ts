import { Terminal } from 'xterm';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { isElectronEnv, Emitter, ILogger, Event, isWindows } from '@ali/ide-core-common';
import { OS } from '@ali/ide-core-common/lib/platform';
import { Emitter as Dispatcher } from 'event-kit';
import { electronEnv } from '@ali/ide-core-browser';
import { WSChannelHandler as IWSChanneHandler, RPCService } from '@ali/ide-connection';
import { generate, ITerminalService, ITerminalInternalService, ITerminalError, ITerminalServiceClient, ITerminalServicePath, ITerminalConnection, IPtyExitEvent, TerminalOptions, ITerminalController } from '../common';
import { TerminalProcessExtHostProxy } from './terminal.ext.host.proxy';

export interface EventMessage {
  data: string;
}

@Injectable()
export class TerminalInternalService implements ITerminalInternalService {
  @Autowired(ITerminalService)
  protected readonly service: ITerminalService;

  @Autowired(ITerminalController)
  protected readonly controller: ITerminalController;

  private _processExtHostProxies = new Map<string, TerminalProcessExtHostProxy>();

  generateSessionId() {
    return this.service.generateSessionId ? this.service.generateSessionId() : generate();
  }

  getOptions() {
    return this.service.getOptions ? this.service.getOptions() : {};
  }

  check(sessionIds: string[]) {
    return this.service.check ? this.service.check(sessionIds) : Promise.resolve(true);
  }

  private _getExtHostProxy(id: string) {
    return this._processExtHostProxies.get(id);
  }

  async attach(sessionId: string, xterm: Terminal, rows: number, cols: number, options: TerminalOptions = {}, type: string) {
    if (options.isExtensionTerminal) {
      const proxy = new TerminalProcessExtHostProxy(sessionId, cols, rows, this.controller);
      proxy.start();
      proxy.onProcessExit((code) => {
        this._processExtHostProxies.delete(sessionId);
      });
      this._processExtHostProxies.set(sessionId, proxy);
      return {
        name: options.name || '',
        readonly: false,
        onData: proxy.onProcessData.bind(proxy),
        sendData: proxy.input.bind(proxy),
        onExit: proxy.onProcessExit.bind(proxy),
      };
    }
    return this.service.attach(sessionId, xterm, rows, cols, options, type);
  }

  async sendText(sessionId: string, message: string) {
    const proxy = this._getExtHostProxy(sessionId);
    if (proxy) {
      return proxy.emitData(message);
    }
    return this.service.sendText(sessionId, message);
  }

  async resize(sessionId: string, cols: number, rows: number) {
    const proxy = this._getExtHostProxy(sessionId);
    if (proxy) {
      return proxy.resize(cols, rows);
    }
    return this.service.resize(sessionId, cols, rows);
  }

  disposeById(sessionId: string) {
    const proxy = this._getExtHostProxy(sessionId);
    if (proxy) {
      this._processExtHostProxies.delete(sessionId);
      return proxy.dispose();
    }
    return this.service.disposeById(sessionId);
  }

  async getProcessId(sessionId: string) {
    const proxy = this._getExtHostProxy(sessionId);
    if (proxy) {
      return -1;
    }
    return this.service.getProcessId(sessionId);
  }

  onError(handler: (error: ITerminalError) => void) {
    return this.service.onError(handler);
  }

  onExit(handler: (event: IPtyExitEvent) => void) {
    return this.service.onExit(handler);
  }

  async getOs() {
    return this.service.getOs();
  }
}

@Injectable()
export class NodePtyTerminalService extends RPCService implements ITerminalService {

  static countId = 1;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(ITerminalServicePath)
  protected readonly service: ITerminalServiceClient;

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

  async getOs() {
    return OS;
  }
}
