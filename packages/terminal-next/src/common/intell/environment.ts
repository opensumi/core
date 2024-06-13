import { CommandToken } from './parser';

interface Dirent {
  /**
   * Returns `true` if the `fs.Dirent` object describes a regular file.
   * @since v10.10.0
   */
  isFile(): boolean;
  /**
   * Returns `true` if the `fs.Dirent` object describes a file system
   * directory.
   * @since v10.10.0
   */
  isDirectory(): boolean;
  name: string;
}

export interface TerminalIntellFileSystem {
  readdir(path: string, options: { withFileTypes: boolean }): Promise<Dirent[]>;
}

export enum Shell {
  Bash = 'bash',
  Powershell = 'powershell',
  Pwsh = 'pwsh',
  Zsh = 'zsh',
  Fish = 'fish',
  Cmd = 'cmd',
  Xonsh = 'xonsh',
  Nushell = 'nu',
}

export interface ITerminalIntellLogger {
  debug(...args: any[]): void;
}

/**
 * 用于尽可能抹除平台限制的 Terminal 智能补全环境
 * Node.js 可以提供完整实现
 * 未来若要在 Browser 上使用，需要根据使用场景对接该接口
 */
export interface ITerminalIntellEnvironment {
  getFileSystem(): Promise<TerminalIntellFileSystem>;
  buildExecuteShellCommand(timeout: number): Fig.ExecuteCommandFunction;
  resolveCwd(
    cmdToken: CommandToken | undefined,
    cwd: string,
    shell: Shell,
  ): Promise<{ cwd: string; pathy: boolean; complete: boolean }>;
  getEnv(): Promise<Record<string, string | undefined>>;
  getLogger(): ITerminalIntellLogger;
}

export const ITerminalIntellEnvironment = Symbol('TokenITerminalIntellEnvironment');
