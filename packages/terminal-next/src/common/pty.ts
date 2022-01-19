import type vscode from 'vscode';
import { Terminal as XTerm } from 'xterm';
import { Uri } from '@opensumi/ide-core-common';
import { WindowsShellType } from './shell';
import { IPty as INodePty } from 'node-pty';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';
import { ITerminalError } from './error';
import { IDetectProfileOptions, ITerminalProfile } from './profile';
import { ITerminalEnvironment, TerminalLocation } from './extension';

export interface IPtyProcess extends INodePty {
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
   * @deprecated Use `ICreateClientWithWidgetOptions.closeWhenExited` instead. Will removed in 2.14.0
   * pty 进程退出后是否自动关闭 terminal 控件
   */
  closeWhenExited?: boolean;

  /**
   * @deprecated Use `ICreateClientWithWidgetOptions.args` instead. Will removed in 2.14.0
   * 自定义的参数，由上层集成方自行控制
   */
  args?: any;

  /**
   * @deprecated Use `ICreateClientWithWidgetOptions.beforeCreate` instead. Will removed in 2.14.0
   * 自定义的参数，由上层集成方自行控制
   */
  beforeCreate?: (terminalId: string) => void;
}

export const ITerminalNodeService = Symbol('ITerminalNodeService');
export interface ITerminalNodeService {
  create2(id: string, cols: number, rows: number, options: IShellLaunchConfig): Promise<IPtyProcess | undefined>;
  onMessage(id: string, msg: string): void;
  resize(id: string, rows: number, cols: number): void;
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
  create2(
    id: string,
    cols: number,
    rows: number,
    launchConfig: IShellLaunchConfig,
  ): Promise<INodePtyInstance | undefined>;
  onMessage(id: string, msg: string): void;
  resize(id: string, rows: number, cols: number): void;
  disposeById(id: string): void;
  getProcessId(id: string): number;
  clientMessage(id: string, data: string): void;
  closeClient(
    sessionId: string,
    data?:
      | ITerminalError
      | {
          code?: number;
          signal?: number;
        }
      | number,
    signal?: number,
  ): void;
  setConnectionClientId(clientId: string): void;
  dispose(): void;
  getShellName(id: string): string;
  ensureTerminal(terminalIdArr: string[]): boolean;
  $resolveWindowsShellPath(type: WindowsShellType): Promise<string | undefined>;
  $resolveUnixShellPath(type: string): Promise<string | undefined>;
  $resolvePotentialUnixShellPath(): Promise<string | undefined>;
  $resolvePotentialWindowsShellPath(): Promise<{ path: string; type: WindowsShellType }>;
  $resolveShellPath(paths: string[]): Promise<string | undefined>;
  detectAvailableProfiles(options: IDetectProfileOptions): Promise<ITerminalProfile[]>;
  getDefaultSystemShell(): Promise<string>;
  getOs(): OperatingSystem;
  getCodePlatformKey(): Promise<'osx' | 'windows' | 'linux'>;
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

export type ITerminalLocationOptions = TerminalLocation | { splitActiveTerminal: boolean };

export interface IShellLaunchConfig {
  /**
   * The name of the terminal, if this is not set the name of the process will be used.
   */
  name?: string;

  /**
   * An string to follow the name of the terminal with, indicating a special kind of terminal
   */
  description?: string;

  /**
   * The shell executable (bash, cmd, etc.).
   */
  executable?: string;

  /**
   * The CLI arguments to use with executable, a string[] is in argv format and will be escaped,
   * a string is in "CommandLine" pre-escaped format and will be used as is. The string option is
   * only supported on Windows and will throw an exception if used on macOS or Linux.
   */
  args?: string[] | string;

  /**
   * The current working directory of the terminal, this overrides the `terminal.integrated.cwd`
   * settings key.
   */
  cwd?: string | Uri;

  /**
   * A custom environment for the terminal, if this is not set the environment will be inherited
   * from the VS Code process.
   */
  env?: ITerminalEnvironment;

  /**
   * Whether to ignore a custom cwd from the `terminal.integrated.cwd` settings key (e.g. if the
   * shell is being launched by an extension).
   */
  ignoreConfigurationCwd?: boolean;

  /** Whether to wait for a key press before closing the terminal. */
  waitOnExit?: boolean | string;

  /**
   * A string including ANSI escape sequences that will be written to the terminal emulator
   * _before_ the terminal process has launched, a trailing \n is added at the end of the string.
   * This allows for example the terminal instance to display a styled message as the first line
   * of the terminal. Use \x1b over \033 or \e for the escape control character.
   */
  initialText?: string;

  /**
   * Custom PTY/pseudoterminal process to use.
   */
  // customPtyImplementation?: (terminalId: number, cols: number, rows: number) => ITerminalChildProcess;

  /**
   * A UUID generated by the extension host process for terminals created on the extension host process.
   */
  extHostTerminalId?: string;

  /**
   * This is a terminal that attaches to an already running terminal.
   */
  // attachPersistentProcess?: {
  //   id: number;
  //   pid: number;
  //   title: string;
  //   titleSource: TitleEventSource;
  //   cwd: string;
  //   icon?: TerminalIcon;
  //   color?: string;
  //   hasChildProcesses?: boolean;
  //   fixedDimensions?: IFixedTerminalDimensions;
  // };

  /**
   * Whether the terminal process environment should be exactly as provided in
   * `TerminalOptions.env`. When this is false (default), the environment will be based on the
   * window's environment and also apply configured platform settings like
   * `terminal.integrated.windows.env` on top. When this is true, the complete environment must be
   * provided as nothing will be inherited from the process or any configuration.
   */
  strictEnv?: boolean;

  /**
   * Whether the terminal process environment will inherit VS Code's "shell environment" that may
   * get sourced from running a login shell depnding on how the application was launched.
   * Consumers that rely on development tools being present in the $PATH should set this to true.
   * This will overwrite the value of the inheritEnv setting.
   */
  useShellEnvironment?: boolean;

  /**
   * When enabled the terminal will run the process as normal but not be surfaced to the user
   * until `Terminal.show` is called. The typical usage for this is when you need to run
   * something that may need interactivity but only want to tell the user about it when
   * interaction is needed. Note that the terminals will still be exposed to all extensions
   * as normal.
   */
  hideFromUser?: boolean;

  /**
   * Whether this terminal is not a terminal that the user directly created and uses, but rather
   * a terminal used to drive some VS Code feature.
   */
  isFeatureTerminal?: boolean;

  /**
   * Whether this terminal was created by an extension.
   */
  isExtensionOwnedTerminal?: boolean;

  /**
   * The icon for the terminal, used primarily in the terminal tab.
   */
  // icon?: TerminalIcon;

  /**
   * The color ID to use for this terminal. If not specified it will use the default fallback
   */
  color?: string;

  /**
   * When a parent terminal is provided via API, the group needs
   * to find the index in order to place the child
   * directly to the right of its parent.
   */
  parentTerminalId?: number;

  /**
   * The dimensions for the instance as set by the user
   * or via Size to Content Width
   */
  // fixedDimensions?: IFixedTerminalDimensions;

  /**
   * Opt-out of the default terminal persistence on restart and reload
   */
  disablePersistence?: boolean;
}

export interface ICreateTerminalOptions {
  /**
   * The shell launch config or profile to launch with, when not specified the default terminal
   * profile will be used.
   */
  config?: IShellLaunchConfig | ITerminalProfile;
  /**
   * The current working directory to start with, this will override IShellLaunchConfig.cwd if
   * specified.
   */
  cwd?: string | Uri;
  /**
   * The terminal's resource, passed when the terminal has moved windows.
   */
  resource?: Uri;
  /**
   * The terminal's location (editor or panel), it's terminal parent (split to the right), or editor group
   */
  location?: ITerminalLocationOptions;
}
