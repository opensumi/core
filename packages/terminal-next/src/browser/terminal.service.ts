import { Terminal } from 'xterm';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { isElectronEnv, Emitter, ILogger, Event, isWindows } from '@opensumi/ide-core-common';
import { OperatingSystem, OS } from '@opensumi/ide-core-common/lib/platform';
import { Emitter as Dispatcher } from 'event-kit';
import { CorePreferences, electronEnv } from '@opensumi/ide-core-browser';
import { WSChannelHandler as IWSChanneHandler } from '@opensumi/ide-connection';
import {
  generateSessionId,
  ITerminalService,
  ITerminalInternalService,
  ITerminalError,
  ITerminalServiceClient,
  ITerminalServicePath,
  ITerminalConnection,
  IPtyExitEvent,
  ITerminalController,
  IShellLaunchConfig,
  INodePtyInstance,
  isTerminalError,
} from '../common';
import { TerminalProcessExtHostProxy } from './terminal.ext.host.proxy';
import { WindowsShellType, WINDOWS_DEFAULT_SHELL_PATH_MAPS } from '../common/shell';

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
    return this.service.generateSessionId ? this.service.generateSessionId() : generateSessionId();
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

  async attach(sessionId: string, xterm: Terminal, launchConfig: IShellLaunchConfig) {
    if (launchConfig.isExtensionTerminal) {
      const proxy = new TerminalProcessExtHostProxy(sessionId, launchConfig.cols, launchConfig.rows, this.controller);
      proxy.start();
      proxy.onProcessExit(() => {
        this._processExtHostProxies.delete(sessionId);
      });
      this._processExtHostProxies.set(sessionId, proxy);
      return {
        name: launchConfig.name || '',
        readonly: false,
        launchConfig,
        onData: proxy.onProcessData.bind(proxy),
        onExit: proxy.onProcessExit.bind(proxy),
        sendData: proxy.input.bind(proxy),
      };
    }

    return this.service.attach(sessionId, xterm, launchConfig);
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

  private _onDataDispatcher = new Dispatcher<void, { [key: string]: string }>();
  private _onExitDispatcher = new Dispatcher<
    void,
    {
      [key: string]: {
        code?: number;
        signal?: number;
      };
    }
  >();

  generateSessionId() {
    if (isElectronEnv()) {
      return electronEnv.metadata.windowClientId + '|' + generateSessionId();
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      return WSChanneHandler.clientId + '|' + generateSessionId();
    }
  }

  async check(ids: string[]) {
    const ensureResult = await this.serviceClientRPC.ensureTerminal(ids);
    return ensureResult;
  }

  private _createCustomWebSocket = (
    sessionId: string,
    pty: INodePtyInstance,
    launchConfig: IShellLaunchConfig,
  ): ITerminalConnection => ({
    name: pty.name,
    readonly: false,
    launchConfig,
    onData: (handler: (value: string | ArrayBuffer) => void) => this._onDataDispatcher.on(sessionId, handler),
    onExit: (handler: (exitCode: number | undefined) => void) =>
      this._onExitDispatcher.on(sessionId, (e) => {
        handler(e.code);
      }),
    sendData: (message: string) => {
      this.sendText(sessionId, message);
    },
  });

  private async finishShellLaunchConfig(options: IShellLaunchConfig) {
    if (!options.shellType || options.shellType === 'default') {
      // default 的情况交给系统环境来决定使用的终端类型
      if (options.os === OperatingSystem.Windows) {
        options.shellPath = WINDOWS_DEFAULT_SHELL_PATH_MAPS.powershell;
        options.shellType = WindowsShellType.powershell;
      } else {
        options.shellPath = await this.serviceClientRPC.$resolvePotentialLinuxShellPath();
        options.shellType = options.shellPath;
      }
    } else {
      // 此时显然 shellType 存在并且不会是 default
      if (isWindows) {
        options.shellPath = await this.serviceClientRPC.$resolveWindowsShellPath(options.shellType as WindowsShellType);
      } else {
        options.shellPath = await this.serviceClientRPC.$resolveLinuxShellPath(options.shellType);
      }
      // 如果经过了上面的解析， options.shellPath 还是 undefined，那么就让 shellPath === type
      // 在之后的 PtyService 会再校验 shellPath 是否存在
      if (!options.shellPath) {
        options.shellPath = options.shellType;
      }
    }

    if (options.os === OperatingSystem.Windows) {
      if (options.shellType === WindowsShellType['git-bash']) {
        options.args?.push('--login');
      }
    } else if (options.os === OperatingSystem.Linux) {
      const linuxShellArgs = this.corePreferences.get('terminal.integrated.shellArgs.linux');
      options.args?.push(...linuxShellArgs);
    } else if (options.os === OperatingSystem.Macintosh) {
    }
    return options;
  }

  async attach(sessionId: string, _: Terminal, options: IShellLaunchConfig) {
    const finalOptions = await this.finishShellLaunchConfig(options);
    this.logger.log(`attach ${sessionId} with options ${JSON.stringify(finalOptions)}`);

    const ptyInstance = await this.serviceClientRPC.create(sessionId, finalOptions);
    if (ptyInstance && (ptyInstance.pid || ptyInstance.name)) {
      // 有 pid 或者 name 的才视为创建成功
      // 创建不成功的时候会被通过 closeClient 把错误信息传递回来
      return this._createCustomWebSocket(sessionId, ptyInstance, finalOptions);
    }
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
   * @param message
   */
  onMessage(sessionId: string, message: string) {
    this._onDataDispatcher.emit(sessionId, message);
  }

  /**
   * for pty node
   *
   * @param sessionId
   */
  closeClient(sessionId: string, data: ITerminalError | { code?: number; signal?: number }) {
    if (isTerminalError(data)) {
      this._onError.fire(data);
    } else {
      // 说明是 pty 报出来的正常退出
      this._onExitDispatcher.emit(sessionId, { code: data.code, signal: data.signal });
      this._onExit.fire({ sessionId, code: data.code, signal: data.signal });
    }
  }

  async getOs() {
    return OS;
  }

  dispose() {
    this._onDataDispatcher.dispose();
    this._onExitDispatcher.dispose();
  }
}
