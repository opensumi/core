import { Terminal } from 'xterm';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { isElectronEnv, Emitter, ILogger, Event } from '@opensumi/ide-core-common';
import { OperatingSystem, OS } from '@opensumi/ide-core-common/lib/platform';
import { Emitter as Dispatcher } from 'event-kit';
import { CorePreferences, electronEnv } from '@opensumi/ide-core-browser';
import { WSChannelHandler as IWSChanneHandler } from '@opensumi/ide-connection';
import {
  generateSessionId,
  ITerminalService,
  ITerminalError,
  ITerminalServiceClient,
  ITerminalServicePath,
  ITerminalConnection,
  IPtyExitEvent,
  IShellLaunchConfig,
  INodePtyInstance,
  isTerminalError,
  TerminalOptions,
} from '../common';
import { ShellType, WindowsShellType } from '../common/shell';

export interface EventMessage {
  data: string;
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

  private _createCustomWebSocket = (sessionId: string, pty: INodePtyInstance): ITerminalConnection => ({
    name: pty.name,
    readonly: false,
    onData: (handler: (value: string | ArrayBuffer) => void) => this._onDataDispatcher.on(sessionId, handler),
    onExit: (handler: (exitCode: number | undefined) => void) =>
      this._onExitDispatcher.on(sessionId, (e) => {
        handler(e.code);
      }),
    sendData: (message: string) => {
      this.sendText(sessionId, message);
    },
    ptyInstance: pty,
  });

  /**
   *
   * @param sessionId
   * @param _
   * @param rows
   * @param cols
   * @param options
   * @param shellType
   * @returns
   */
  async attach(
    sessionId: string,
    _: Terminal,
    rows: number,
    cols: number,
    options: TerminalOptions = {},
    shellType?: ShellType,
  ) {
    let shellPath = options.shellPath;
    const shellArgs = typeof options.shellArgs === 'string' ? [options.shellArgs] : options.shellArgs || [];
    const platformKey = await this.getPlatformKey();
    const terminalOs = await this.getOs();
    if (!shellPath) {
      // if terminal options.shellPath is not set, we should resolve the shell path from preference: `terminal.type`
      if (shellType && shellType !== 'default') {
        if (terminalOs === OperatingSystem.Windows) {
          shellPath = await this.serviceClientRPC.$resolveWindowsShellPath(shellType as WindowsShellType);
        } else {
          shellPath = await this.serviceClientRPC.$resolveUnixShellPath(shellType);
        }

        if (!shellPath) {
          // TODO: we can show error message here
          // "the shell you want to launch is not exists"
        }
      }

      // and now, we have the following two situations:
      if (!shellPath) {
        if (!shellType || shellType === 'default') {
          // 1. `terminal.type` is set to a falsy value, or set to `default`
          if (terminalOs === OperatingSystem.Windows) {
            // in windows, at least we can launch the cmd.exe
            const { type: _type, path } = await this.serviceClientRPC.$resolvePotentialWindowsShellPath();
            shellType = _type;
            shellPath = path;
          } else {
            // in unix, at least we can launch the sh
            shellPath = await this.serviceClientRPC.$resolvePotentialUnixShellPath();
          }
        } else {
          // 2. `terminal.type` is set to a truthy value, but the shell path is not resolved, for example cannot resolve 'git-bash'
          //     but in this situation, we preserve the user settings, launch the type as shell path
          //     on PtyService we also have a fallback to check the shellPath is valid
          shellPath = shellType;
        }
      }

      const platformSpecificArgs = this.corePreferences.get(`terminal.integrated.shellArgs.${platformKey}`);
      shellArgs.push(...platformSpecificArgs);

      if (shellType === WindowsShellType['git-bash']) {
        shellArgs.push('--login');
      }
    }

    const launchConfig: IShellLaunchConfig = {
      shellPath,
      cwd: options.cwd,
      args: shellArgs,
      cols,
      rows,
      os: terminalOs,
      env: options.env,
      name: options.name,
      strictEnv: options.strictEnv,
    };

    this.logger.log(`attach ${sessionId} with options ${JSON.stringify(launchConfig)}`);

    const ptyInstance = await this.serviceClientRPC.create2(sessionId, launchConfig);
    if (ptyInstance && (ptyInstance.pid || ptyInstance.name)) {
      // 有 pid 或者 name 的才视为创建成功
      // 创建不成功的时候会被通过 closeClient 把错误信息传递回来
      return this._createCustomWebSocket(sessionId, ptyInstance);
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

  async getPlatformKey(): Promise<'osx' | 'windows' | 'linux'> {
    // follow vscode
    return (await this.getOs()) === OperatingSystem.Macintosh
      ? 'osx'
      : OS === OperatingSystem.Windows
      ? 'windows'
      : 'linux';
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
  closeClient(id: string, code?: number, signal?: number): void;
  closeClient(sessionId: string, data: ITerminalError | { code?: number; signal?: number }): void;
  closeClient(sessionId: string, data?: ITerminalError | { code?: number; signal?: number } | number, signal?: number) {
    if (isTerminalError(data)) {
      this._onError.fire(data);
    } else if (typeof data === 'number') {
      // 说明是 pty 报出来的正常退出
      this._onExitDispatcher.emit(sessionId, { code: data, signal });
      this._onExit.fire({ sessionId, code: data, signal });
    } else if (data) {
      // 说明是 pty 报出来的正常退出
      this._onExitDispatcher.emit(sessionId, { code: data.code, signal: data.signal });
      this._onExit.fire({ sessionId, code: data.code, signal: data.signal });
    }
  }

  async getOs() {
    // is this right to check WebIDE Terminal OS type?
    return OS;
  }

  dispose() {
    this._onDataDispatcher.dispose();
    this._onExitDispatcher.dispose();
  }
}
