import { Autowired, Injectable } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import { INodeLogger, OperatingSystem, isMacintosh, isWindows } from '@opensumi/ide-core-node';

import {
  INodePtyInstance,
  IShellLaunchConfig,
  ITerminalError,
  ITerminalNodeService,
  ITerminalServiceClient,
} from '../common';
import { IDetectProfileOptions, ITerminalProfile } from '../common/profile';
import { IPtyProcessProxy } from '../common/pty';
import { WINDOWS_DEFAULT_SHELL_PATH_MAPS, WindowsShellType } from '../common/shell';

import { WINDOWS_GIT_BASH_PATHS, findShellExecutableAsync, getSystemShell } from './shell';
import { ITerminalProfileServiceNode, TerminalProfileServiceNode } from './terminal.profile.service';

/**
 * this RPC target: NodePtyTerminalService
 */
interface IRPCTerminalService {
  closeClient(id: string, data: ITerminalError | { code?: number; signal?: number } | number, signal?: number): void;
  $processChange(id: string, processName: string): void;
  onMessage(id: string, msg: string): void;
}

/**
 * 标准的后端服务，供前端调用
 * 目前每个窗口会对应一个 TerminalServiceClientImpl 实例
 */
@Injectable()
export class TerminalServiceClientImpl extends RPCService<IRPCTerminalService> implements ITerminalServiceClient {
  @Autowired(ITerminalNodeService)
  private terminalService: ITerminalNodeService;

  @Autowired(ITerminalProfileServiceNode)
  private terminalProfileService: TerminalProfileServiceNode;

  private clientId: string;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  setConnectionClientId(clientId: string) {
    this.clientId = clientId;
    this.logger.debug('TerminalServiceClientImpl', 'setConnectionClientId', clientId);
    this.terminalService.setClient(this.clientId, this);
  }

  clientMessage(id: string, data: string) {
    if (this.client) {
      return this.client.onMessage(id, data);
    } else {
      this.logger.warn(`clientMessage ${id} rpcClient not found`);
    }
  }

  closeClient(id: string, data: ITerminalError | { code?: number; signal?: number } | number, signal?: number) {
    if (this.client) {
      this.client.closeClient(id, data, signal);
    } else {
      this.logger.warn(`clientMessage ${id} rpcClient not found`);
    }
  }

  processChange(clientId: string, processName: string): void {
    if (this.client) {
      this.logger.log(`processChange ${clientId} ${processName}`);
      this.client.$processChange(clientId, processName);
    }
  }

  // 检查终端状态，终端是否存活
  async ensureTerminal(terminalIdArr: string[]): Promise<boolean> {
    return await this.terminalService.ensureClientTerminal(this.clientId, terminalIdArr);
  }

  async create2(
    id: string,
    cols: number,
    rows: number,
    launchConfig: IShellLaunchConfig,
  ): Promise<INodePtyInstance | undefined> {
    try {
      const pty = await this.terminalService.create2(id, cols, rows, launchConfig);
      if (pty) {
        this.terminalService.setClient(this.clientId, this);
        this.logger.log(`client ${id} create ${pty.pid} with options `, launchConfig);
        this.logger.log(
          `terminal client ${id} and clientID: ${this.clientId} create ${pty.pid} with options `,
          launchConfig,
        );
        return {
          id,
          pid: pty.pid,
          process: pty.process,
          name: pty.parsedName,
          shellPath: pty.launchConfig.executable,
        };
      } else {
        this.logger.log(`cannot create pty instance ${id} `, launchConfig);
      }
    } catch (error) {
      this.logger.error(`create pty instance error ${id}`, launchConfig, error);
    }
  }

  async $resolveWindowsShellPath(type: WindowsShellType): Promise<string | undefined> {
    switch (type) {
      case WindowsShellType.powershell:
        return WINDOWS_DEFAULT_SHELL_PATH_MAPS.powershell;
      case WindowsShellType.cmd:
        return WINDOWS_DEFAULT_SHELL_PATH_MAPS.cmd;
      case WindowsShellType['git-bash']: {
        const shell = await findShellExecutableAsync(WINDOWS_GIT_BASH_PATHS);
        return shell;
      }
      default:
        // 未知的 shell，返回 undefined，后续会使用系统默认值处理
        return undefined;
    }
  }

  async $resolveUnixShellPath(type: string): Promise<string | undefined> {
    const candidates = [type, `/bin/${type}`, `/usr/bin/${type}`];
    return await findShellExecutableAsync(candidates);
  }

  async $resolveShellPath(paths: string[]): Promise<string | undefined> {
    return await findShellExecutableAsync(paths);
  }

  async detectAvailableProfiles(options: IDetectProfileOptions): Promise<ITerminalProfile[]> {
    return await this.terminalProfileService.detectAvailableProfiles(options);
  }

  async getCodePlatformKey(): Promise<'osx' | 'windows' | 'linux'> {
    switch (this.getOS()) {
      case OperatingSystem.Macintosh:
        return 'osx';
      case OperatingSystem.Windows:
        return 'windows';
      case OperatingSystem.Linux:
        return 'linux';
      default:
        return 'linux';
    }
  }

  async getDefaultSystemShell(os: OperatingSystem) {
    return await getSystemShell(os);
  }

  onMessage(id: string, msg: string): void {
    const { data, params, method } = JSON.parse(msg);

    if (method === 'resize') {
      this.resize(id, params.rows, params.cols);
    } else {
      this.terminalService.onMessage(id, data);
    }
  }

  resize(id: string, rows: number, cols: number) {
    this.terminalService.resize(id, rows, cols);
  }

  disposeById(id: string) {
    this.terminalService.disposeById(id);
  }

  getProcessId(id: string): number {
    return this.terminalService.getProcessId(id);
  }

  getShellName(id: string): string {
    return this.terminalService.getShellName(id);
  }

  getOS(): OperatingSystem {
    return isWindows ? OperatingSystem.Windows : isMacintosh ? OperatingSystem.Macintosh : OperatingSystem.Linux;
  }

  dispose() {
    // TODO 后续需要一个合理的 Dispose 逻辑，暂时不要 Dispose，避免重连时终端不可用
    // this.terminalService.closeClient(this.clientId);
  }

  getCwd(id: string): Promise<string | undefined> {
    return this.terminalService.getCwd(id);
  }
}
