import { Emitter as Dispatcher } from 'event-kit';
import { Terminal } from 'xterm';

import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { WSChannelHandler as IWSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import { AppConfig, electronEnv, PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, ILogger, Event } from '@opensumi/ide-core-common';
import { OperatingSystem, OS } from '@opensumi/ide-core-common/lib/platform';

import {
  generateSessionId,
  ITerminalService,
  ITerminalError,
  ITerminalServiceClient,
  ITerminalServicePath,
  ITerminalConnection,
  IPtyExitEvent,
  INodePtyInstance,
  isTerminalError,
  TerminalOptions,
  ITerminalProfile,
  IShellLaunchConfig,
  IDetectProfileOptionsPreference,
} from '../common';
import { CodeTerminalSettingPrefix } from '../common/preference';
import { ShellType, WindowsShellType } from '../common/shell';

export interface EventMessage {
  data: string;
}
@Injectable()
export class NodePtyTerminalService implements ITerminalService {
  static countId = 1;

  private backendOs: OperatingSystem | undefined;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(ITerminalServicePath)
  protected readonly serviceClientRPC: ITerminalServiceClient;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

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
    // Electron 环境下，未指定 isRemote 时默认使用本地连接
    // 否则使用 WebSocket 连接
    if (this.appConfig.isElectronRenderer && !this.appConfig.isRemote) {
      return electronEnv.metadata.windowClientId + '|' + generateSessionId();
    } else {
      const WSChannelHandler = this.injector.get(IWSChannelHandler);
      return WSChannelHandler.clientId + '|' + generateSessionId();
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
    const platformKey = await this.getCodePlatformKey();
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

      // if we still can not find the shell path, we use shellType as the target shell path
      if (!shellPath && shellType !== 'default') {
        shellPath = shellType;
      }

      const platformSpecificArgs = this.preferenceService.get<string[]>(
        `${CodeTerminalSettingPrefix.ShellArgs}${platformKey}`,
        [],
      );

      shellArgs.push(...platformSpecificArgs);

      if (shellType === WindowsShellType['git-bash']) {
        shellArgs.push('--login');
      }
    }

    const launchConfig: IShellLaunchConfig = {
      executable: shellPath,
      cwd: options.cwd,
      args: shellArgs,
      env: options.env,
      name: options.name,
      strictEnv: options.strictEnv,
    };
    return this.attachByLaunchConfig(sessionId, cols, rows, launchConfig);
  }

  async attachByLaunchConfig(sessionId: string, cols: number, rows: number, launchConfig: IShellLaunchConfig) {
    // If code runs to here, it means that we want to create a real terminal.
    // So if `launchConfig.executable` is not set, we should use the default shell.
    if (!launchConfig.executable) {
      launchConfig.executable = await this.getDefaultSystemShell();
    }

    this.logger.log(`attachByLaunchConfig ${sessionId} with launchConfig `, launchConfig);

    const ptyInstance = await this.serviceClientRPC.create2(sessionId, cols, rows, launchConfig);
    if (ptyInstance && (ptyInstance.pid || ptyInstance.name)) {
      this.logger.log(`${sessionId} attach success, pid: ${ptyInstance.pid}, name: ${ptyInstance.name}`);
      // 有 pid 或者 name 的才视为创建成功
      // 创建不成功的时候会被通过 closeClient 把错误信息传递回来
      return this._createCustomWebSocket(sessionId, ptyInstance);
    }
    this.logger.error(`${sessionId} cannot create ptyInstance`, ptyInstance);
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

  async getCodePlatformKey(): Promise<'osx' | 'windows' | 'linux'> {
    return await this.serviceClientRPC.getCodePlatformKey();
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
    this.logger.log(`${sessionId} was closed, error:`, data);

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
    if (this.backendOs) {
      return this.backendOs;
    }
    return (this.backendOs = this.serviceClientRPC.getOs());
  }

  async getProfiles(autoDetect: boolean): Promise<ITerminalProfile[]> {
    const platformKey = await this.getCodePlatformKey();
    const terminalPreferences = this.preferenceService.get<IDetectProfileOptionsPreference>(
      `${CodeTerminalSettingPrefix.Profiles}${platformKey}`,
      {},
    );

    return await this.serviceClientRPC.detectAvailableProfiles({
      autoDetect,
      preference: terminalPreferences,
    });
  }

  async getDefaultSystemShell(): Promise<string> {
    return await this.serviceClientRPC.getDefaultSystemShell(await this.getOs());
  }

  dispose() {
    this._onDataDispatcher.dispose();
    this._onExitDispatcher.dispose();
  }
}
