import { Terminal } from 'xterm';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { isElectronEnv, Emitter, ILogger, Event, isWindows } from '@opensumi/ide-core-common';
import { OperatingSystem, OS } from '@opensumi/ide-core-common/lib/platform';
import { Emitter as Dispatcher } from 'event-kit';
import { CorePreferences, electronEnv } from '@opensumi/ide-core-browser';
import { WSChannelHandler as IWSChanneHandler } from '@opensumi/ide-connection';
import {
  generate,
  ITerminalService,
  ITerminalInternalService,
  ITerminalError,
  ITerminalServiceClient,
  ITerminalServicePath,
  ITerminalConnection,
  IPtyExitEvent,
  ITerminalController,
  IShellLaunchConfig,
} from '../common';
import { TerminalProcessExtHostProxy } from './terminal.ext.host.proxy';
import { WindowsShellType } from '../common/shell';

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

  async attach(sessionId: string, xterm: Terminal, options: IShellLaunchConfig) {
    if (options.isExtensionTerminal) {
      const proxy = new TerminalProcessExtHostProxy(sessionId, options.cols, options.rows, this.controller);
      proxy.start();
      proxy.onProcessExit((code) => {
        this._processExtHostProxies.delete(sessionId);
      });
      this._processExtHostProxies.set(sessionId, proxy);
      return {
        name: options.name || '',
        readonly: false,
        onData: proxy.onProcessData.bind(proxy),
        onExit: proxy.onProcessExit.bind(proxy),
        sendData: proxy.input.bind(proxy),
      };
    }

    return this.service.attach(sessionId, xterm, options);
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
export class NodePtyTerminalService implements ITerminalService {
  static countId = 1;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(ITerminalServicePath)
  protected readonly serviceClientRPC: ITerminalServiceClient;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

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
    const ensureResult = await this.serviceClientRPC.ensureTerminal(ids);
    return ensureResult;
  }

  private _createCustomWebSocket(sessionId: string, name: string): ITerminalConnection {
    return {
      name,
      readonly: false,
      onData: (handler: (value: string | ArrayBuffer) => void) => this._dispatcher.on(sessionId, handler),
      onExit: (handler: (exitCode: number | undefined) => void) => this.onExit((e) => handler(e.code)),
      sendData: (message: string) => {
        this.sendText(sessionId, message);
      },
    };
  }

  private async finishShellLaunchConfig(options: IShellLaunchConfig) {
    // TODO: fix 目前设置 default 的话，不会启动 ZSH，待排查
    if (options.shellType && options.shellType !== 'default') {
      if (isWindows) {
        options.shellPath =
          (await this.serviceClientRPC.$resolveWindowsShellPath(options.shellType as WindowsShellType)) || '';
      } else {
        options.shellPath = `/bin/${options.shellType}`;
      }
    } else if (options.shellType === 'default') {
      // default 的情况交给系统环境来决定使用的终端类型
      // TODO: feat: 优化 default 逻辑
      if (options.os === OperatingSystem.Windows) {
        options.shellPath = 'powershell.exe';
        options.shellType = WindowsShellType.powershell;
      } else {
        options.shellPath = process.env['SHELL'] || '/bin/sh';
        options.shellType = options.shellPath;
      }
    }

    if (options.os === OperatingSystem.Windows) {
      if (options.shellType === WindowsShellType['git-bash']) {
        options.args.push('--login');
      }
    } else if (options.os === OperatingSystem.Linux) {
      const linuxShellArgs = this.corePreferences.get('terminal.integrated.shellArgs.linux');
      options.args.push(...linuxShellArgs);
    } else if (options.os === OperatingSystem.Macintosh) {
    }
    return options;
  }

  async attach(sessionId: string, _: Terminal, options: IShellLaunchConfig) {
    const finalOptions = await this.finishShellLaunchConfig(options);
    this.logger.log(`attach ${sessionId} with options ${JSON.stringify(finalOptions)}`);
    const { name, pid } = await this.serviceClientRPC.create(sessionId, finalOptions);

    if (!pid || !name) {
      return;
    }

    return this._createCustomWebSocket(sessionId, name);
  }

  private _sendMessage(sessionId: string, json: any, requestId?: number) {
    const id = requestId || NodePtyTerminalService.countId++;

    this.serviceClientRPC.onMessage(
      sessionId,
      JSON.stringify({
        id,
        ...json,
      }),
    );
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
    this.serviceClientRPC.disposeById(sessionId);
  }

  async getProcessId(sessionId: string) {
    return this.serviceClientRPC.getProcessId(sessionId);
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

  sendError(sessionId: string, message: string, stopped: boolean) {
    this._onError.fire({
      id: sessionId,
      message,
      stopped,
    });
  }

  async getOs() {
    return OS;
  }
}
