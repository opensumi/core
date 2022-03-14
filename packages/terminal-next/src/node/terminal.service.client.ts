import { Injectable, Autowired } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import { OperatingSystem, OS } from '@opensumi/ide-core-common/lib/platform';
import { INodeLogger } from '@opensumi/ide-core-node';

import {
  IShellLaunchConfig,
  ITerminalNodeService,
  ITerminalServiceClient,
  INodePtyInstance,
  ITerminalError,
} from '../common';
import { IDetectProfileOptions, ITerminalProfile } from '../common/profile';
import { IPtyProcess } from '../common/pty';
import { WindowsShellType, WINDOWS_DEFAULT_SHELL_PATH_MAPS } from '../common/shell';

import { findExecutable, findShellExecutableAsync, getSystemShell, WINDOWS_GIT_BASH_PATHS } from './shell';
import { ITerminalProfileServiceNode, TerminalProfileServiceNode } from './terminal.profile.service';


/**
 * this RPC target: NodePtyTerminalService
 */
interface IRPCTerminalService {
  closeClient(id: string, data: ITerminalError | { code?: number; signal?: number } | number, signal?: number): void;
  onMessage(id: string, msg: string): void;
}

/**
 * 标准的后端服务，供前端调用
 * 目前每个窗口会对应一个 TerminalServiceClientImpl 实例
 */
@Injectable()
export class TerminalServiceClientImpl extends RPCService<IRPCTerminalService> implements ITerminalServiceClient {
  private terminalMap: Map<string, IPtyProcess> = new Map();

  @Autowired(ITerminalNodeService)
  private terminalService: ITerminalNodeService;

  @Autowired(ITerminalProfileServiceNode)
  private terminalProfileService: TerminalProfileServiceNode;

  private clientId: string;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  setConnectionClientId(clientId: string) {
    this.clientId = clientId;
    this.terminalService.setClient(this.clientId, this);
  }

  clientMessage(id: string, data: string) {
    if (this.client) {
      this.client.onMessage(id, data);
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

  // 完成创建之后，前端进行状态同步
  ensureTerminal(terminalIdArr: string[]): boolean {
    return this.terminalService.ensureClientTerminal(this.clientId, terminalIdArr);
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
        this.terminalMap.set(id, pty);
        return {
          id,
          pid: pty.pid,
          proess: pty.process,
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

  async $resolvePotentialUnixShellPath(): Promise<string | undefined> {
    if (process.env.SHELL) {
      return process.env.SHELL;
    }

    const candidates = ['zsh', 'bash', 'sh'];
    for (const candidate of candidates) {
      const path = await this.$resolveUnixShellPath(candidate);
      if (path) {
        return path;
      }
    }
  }

  async $resolvePotentialWindowsShellPath(): Promise<{ path: string; type: WindowsShellType }> {
    let path = await findShellExecutableAsync(WINDOWS_GIT_BASH_PATHS);
    if (path) {
      return {
        path,
        type: WindowsShellType['git-bash'],
      };
    }
    path = await findExecutable(WINDOWS_DEFAULT_SHELL_PATH_MAPS.powershell);
    if (path) {
      return {
        path,
        type: WindowsShellType.powershell,
      };
    }

    return {
      path: WINDOWS_DEFAULT_SHELL_PATH_MAPS.cmd,
      type: WindowsShellType.cmd,
    };
  }

  async detectAvailableProfiles(options: IDetectProfileOptions): Promise<ITerminalProfile[]> {
    return await this.terminalProfileService.detectAvailableProfiles(options);
  }

  async getCodePlatformKey(): Promise<'osx' | 'windows' | 'linux'> {
    // follow vscode
    return this.getOs() === OperatingSystem.Macintosh ? 'osx' : OS === OperatingSystem.Windows ? 'windows' : 'linux';
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

  getOs(): OperatingSystem {
    return OS;
  }

  dispose() {
    this.terminalService.closeClient(this.clientId);
  }
}
