import { Injectable, Autowired } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import {
  IShellLaunchConfig,
  ITerminalNodeService,
  ITerminalServiceClient,
  INodePtyInstance,
  ITerminalError,
} from '../common';
import { IPty } from '../common/pty';
import { INodeLogger } from '@opensumi/ide-core-node';
import { WindowsShellType, WINDOWS_DEFAULT_SHELL_PATH_MAPS } from '../common/shell';
import { findShellExecutableAsync, WINDOWS_GIT_BASH_PATHS } from './shell';

/**
 * this RPC target: NodePtyTerminalService
 */
interface IRPCTerminalService {
  closeClient(id: string, data: ITerminalError | { code?: number; signal?: number }): void;
  onMessage(id: string, msg: string): void;
}

/**
 * 标准的后端服务，供前端调用
 * 目前每个窗口会对应一个 TerminalServiceClientImpl 实例
 */
@Injectable()
export class TerminalServiceClientImpl extends RPCService<IRPCTerminalService> implements ITerminalServiceClient {
  private terminalMap: Map<string, IPty> = new Map();

  @Autowired(ITerminalNodeService)
  private terminalService: ITerminalNodeService;

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

  closeClient(id: string, data: ITerminalError | { code?: number; signal?: number }) {
    if (this.client) {
      this.client.closeClient(id, data);
    } else {
      this.logger.warn(`clientMessage ${id} rpcClient not found`);
    }
  }

  // 完成创建之后，前端进行状态同步
  ensureTerminal(terminalIdArr: string[]): boolean {
    return this.terminalService.ensureClientTerminal(this.clientId, terminalIdArr);
  }

  async create(id: string, options: IShellLaunchConfig): Promise<INodePtyInstance | undefined> {
    const pty = await this.terminalService.create(id, options);
    if (pty) {
      this.terminalService.setClient(this.clientId, this);
      this.logger.log(`client ${id} create ${pty} with options ${JSON.stringify(options)}`);
      this.terminalMap.set(id, pty);
      return {
        id,
        pid: pty.pid,
        proess: pty.process,
        name: pty.parsedName,
        shellPath: pty.launchConfig.shellPath,
      };
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
  async $resolveLinuxShellPath(type: string): Promise<string | undefined> {
    const candidates = [type, `/bin/${type}`, `/usr/bin/${type}`];
    return await findShellExecutableAsync(candidates);
  }

  async $resolveShellPath(paths: string[]): Promise<string | undefined> {
    return await findShellExecutableAsync(paths);
  }

  async $resolvePotentialLinuxShellPath(): Promise<string | undefined> {
    if (process.env.SHELL) {
      return process.env.SHELL;
    }

    const candidates = ['zsh', 'bash', 'sh'];
    for (const candidate of candidates) {
      const path = await this.$resolveLinuxShellPath(candidate);
      if (path) {
        return path;
      }
    }
  }

  async $resolvePotentialWindowsShellPath(): Promise<{ path: string; type: WindowsShellType }> {
    const candidates = [
      WINDOWS_DEFAULT_SHELL_PATH_MAPS.powershell,
      ...WINDOWS_GIT_BASH_PATHS,
      WINDOWS_DEFAULT_SHELL_PATH_MAPS.cmd,
    ];

    // at least one of the candidates should be valid
    // because all windows has cmd
    let type: WindowsShellType;
    const path = (await findShellExecutableAsync(candidates)) as string;

    // if path is not undefined, then it is a known shell path in the candidate list
    // so we compare the path to the known shell paths to determine the type
    if (path === WINDOWS_DEFAULT_SHELL_PATH_MAPS.powershell) {
      type = WindowsShellType.powershell;
    } else if (path === WINDOWS_DEFAULT_SHELL_PATH_MAPS.cmd) {
      type = WindowsShellType.cmd;
    } else {
      type = WindowsShellType['git-bash'];
    }

    return {
      path,
      type,
    };
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

  dispose() {
    this.terminalService.closeClient(this.clientId);
  }
}
