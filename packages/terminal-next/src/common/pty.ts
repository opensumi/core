import type vscode from 'vscode';
import { Terminal as XTerm } from 'xterm';
import { Uri } from '@opensumi/ide-core-common';
import { ShellType, WindowsShellType } from './shell';
import { IPty as INodePty } from 'node-pty';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';
import { ITerminalError } from './error';

export interface IPty extends INodePty {
  /**
   * @deprecated 请使用 `IPty.launchConfig` 的 shellPath 字段
   */
  bin: string;
  launchConfig: IShellLaunchConfig;
  parsedName: string;
}

export const ITerminalServicePath = 'ITerminalServicePath';
export const ITerminalProcessPath = 'ITerminalProcessPath';

export interface Terminal {
  readonly xterm: XTerm;

  /**
   * The name of the terminal.
   */
  readonly name: string;

  /**
   * The process ID of the shell process.
   */
  readonly processId: Promise<number>;

  /**
   * Send text to the terminal. The text is written to the stdin of the underlying pty process
   * (shell) of the terminal.
   *
   * @param text The text to send.
   * @param addNewLine Whether to add a new line to the text being sent, this is normally
   * required to run a command in the terminal. The character(s) added are \n or \r\n
   * depending on the platform. This defaults to `true`.
   */
  sendText(text: string, addNewLine?: boolean): void;

  /**
   * Show the terminal panel and reveal this terminal in the UI.
   *
   * @param preserveFocus When `true` the terminal will not take focus.
   */
  show(preserveFocus?: boolean): void;

  /**
   * Hide the terminal panel if this terminal is currently showing.
   */
  hide(): void;

  isActive: boolean;

  id: string;

  serviceInitPromise: Promise<void> | null;

  finishServiceInitPromise();

  setName(name: string);

  setProcessId(id: number);

  /**
   * Dispose and free associated resources.
   */
  dispose(): void;

  clear(): void;
}

export interface TerminalOptions {
  /**
   * A human-readable string which will be used to represent the terminal in the UI.
   */
  name?: string;

  /**
   * A path to a custom shell executable to be used in the terminal.
   */
  shellPath?: string;

  /**
   * Args for the custom shell executable. A string can be used on Windows only which allows
   * specifying shell args in [command-line format](https://msdn.microsoft.com/en-au/08dfcab2-eb6e-49a4-80eb-87d4076c98c6).
   */
  shellArgs?: string[] | string;

  /**
   * A path or Uri for the current working directory to be used for the terminal.
   */
  cwd?: string | Uri;

  /**
   * Object with environment variables that will be added to the VS Code process.
   */
  env?: { [key: string]: string | null };

  /**
   * Whether an extension is controlling the terminal via a `vscode.Pseudoterminal`.
   */
  isExtensionTerminal?: boolean;

  /**
   * Whether the terminal process environment should be exactly as provided in
   * `TerminalOptions.env`. When this is false (default), the environment will be based on the
   * window's environment and also apply configured platform settings like
   * `terminal.integrated.windows.env` on top. When this is true, the complete environment
   * must be provided as nothing will be inherited from the process or any configuration.
   */
  strictEnv?: boolean;

  /**
   * When enabled the terminal will run the process as normal but not be surfaced to the user
   * until `Terminal.show` is called. The typical usage for this is when you need to run
   * something that may need interactivity but only want to tell the user about it when
   * interaction is needed. Note that the terminals will still be exposed to all extensions
   * as normal.
   */
  hideFromUser?: boolean;

  /**
   * A message to write to the terminal on first launch, note that this is not sent to the
   * process but, rather written directly to the terminal. This supports escape sequences such
   * a setting text style.
   */
  message?: string;

  /**
   * The icon path or {@link ThemeIcon} for the terminal.
   */
  iconPath?: Uri | { light: Uri; dark: Uri } | vscode.ThemeIcon;

  /**
   * The icon {@link ThemeColor} for the terminal.
   * The `terminal.ansi*` theme keys are
   * recommended for the best contrast and consistency across themes.
   */
  color?: vscode.ThemeColor;

  /**
   * pty 进程退出后是否自动关闭 terminal 控件
   */
  closeWhenExited?: boolean;

  /**
   * 自定义的参数，由上层集成方自行控制
   */
  args?: any;

  beforeCreate?: (terminalId: string) => void;
}

export const ITerminalNodeService = Symbol('ITerminalNodeService');
export interface ITerminalNodeService {
  create(id: string, options: IShellLaunchConfig): Promise<IPty | undefined>;
  onMessage(id: string, msg: string): void;
  resize(id: string, rows: number, cols: number);
  getShellName(id: string): string;
  getProcessId(id: string): number;
  disposeById(id: string): void;
  dispose(): void;
  setClient(clientId: string, client: ITerminalServiceClient): void;
  closeClient(clientId: string): void;
  ensureClientTerminal(clientId: string, terminalIdArr: string[]): boolean;
}

export const ITerminalProcessService = Symbol('ITerminalProcessService');
export interface ITerminalProcessService {
  getEnv(): Promise<{ [key in string]: string | undefined }>;
}

export interface INodePtyInstance {
  id: string;
  name: string;
  pid: number;
  proess: string;
  shellPath?: string;
}

export const ITerminalServiceClient = Symbol('ITerminalServiceClient');
export interface ITerminalServiceClient {
  create(id: string, options: IShellLaunchConfig): Promise<INodePtyInstance | undefined>;
  onMessage(id: string, msg: string): void;
  resize(id: string, rows: number, cols: number): void;
  disposeById(id: string): void;
  getProcessId(id: string): number;
  clientMessage(id: string, data): void;
  closeClient(
    sessionId: string,
    data:
      | ITerminalError
      | {
          code?: number;
          signal?: number;
        },
  ): void;
  setConnectionClientId(clientId: string): void;
  dispose(): void;
  getShellName(id: string): string;
  ensureTerminal(terminalIdArr: string[]): boolean;
  $resolveWindowsShellPath(type: WindowsShellType): Promise<string | undefined>;
}

export interface ITerminalInfo {
  id: string;
  name: string;
  isActive: boolean;
}

// 搜了一下代码，在 OpenSumi 里已经没有地方引用了
export const IExternlTerminalService = Symbol('IExternlTerminalService');
/**
 * 使用依赖注入的方式复写这个类型，
 * 支持更多形式的 termial 实现。
 */
export interface IExternlTerminalService {
  /**
   * 创建一个新的 terminal，需要手动的将 xterm 和 pty 的通信关联起来。
   *
   * @param id
   * @param terminal
   * @param rows
   * @param cols
   * @param options
   */
  create(id: string, terminal: Terminal, rows: number, cols: number, options: TerminalOptions): Promise<boolean>;
  /**
   * 发送一段文字到后端，用于外部调用
   *
   * @param id
   * @param text
   * @param addNewLine
   */
  sendText(id: string, text: string, addNewLine?: boolean): void;
  /**
   * resize
   *
   * @param id
   * @param rows
   * @param cols
   */
  resize(id: string, rows: number, cols: number): void;
  /**
   * 销毁一个已有的 terminal 进程
   *
   * @param id
   */
  disposeById(id: string): void;
  /**
   * 获取已知 terminal 的进程号
   *
   * @param id
   */
  getProcessId(id: string): Promise<number>;
}

export interface IShellLaunchConfig {
  shellPath?: string;
  args?: string[];

  isExtensionTerminal?: boolean;
  shellType?: ShellType;
  os?: OperatingSystem;

  /**
   * Whether the terminal process environment should be exactly as provided in
   * `TerminalOptions.env`. When this is false (default), the environment will be based on the
   * window's environment and also apply configured platform settings like
   * `terminal.integrated.windows.env` on top. When this is true, the complete environment
   * must be provided as nothing will be inherited from the process or any configuration.
   */
  strictEnv?: boolean;

  /**
   * Name of the terminal to be set in environment ($TERM variable).
   */
  name?: string;

  /**
   * Number of intial cols of the pty.
   */
  cols: number;

  /**
   * Number of initial rows of the pty.
   */
  rows: number;

  /**
   * Working directory to be set for the child program.
   */
  cwd?: string;

  /**
   * Environment to be set for the child program.
   */
  env?: { [key: string]: string | null };
}
