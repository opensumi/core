import { Terminal as XTerm } from 'xterm';
import Uri from 'vscode-uri';
import * as React from 'react';
import { Event } from '@ali/ide-core-common';

export const ITerminalServicePath = 'ITerminalServicePath';
export const ITerminalService = Symbol('ITerminalService');

export interface Terminal {

  /**
   * The name of the terminal.
   */
  readonly name: string;

  /**
   * The process ID of the shell process.
   */
  readonly processId: Thenable<number>;

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

  /**
   * Dispose and free associated resources.
   */
  dispose(): void;

  isActive: boolean;

  id: string;

  serviceInitPromise: Promise<void> | null;

  finishServiceInitPromise();
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
}

export interface ITerminalService {
  create(id: string, rows: number, cols: number, options: TerminalOptions);

  onMessage(id: string, msg: string): void;

  resize(id: string, rows: number, cols: number);

  getShellName(id: string): string | undefined;

  getProcessId(id: string): number;

  disposeById(id: string);

  dispose();
}

export interface TerminalCreateOptions extends TerminalOptions {
  terminalClient: ITerminalClient;
  terminalService: ITerminalService;
  id: string;
  xterm: XTerm;
  el: HTMLElement;
}

export const ITerminalClient = Symbol('ITerminalClient');
export interface ITerminalClient {
  activeId: string;

  onDidChangeActiveTerminal: Event<string>;

  onDidCloseTerminal: Event<string>;

  onDidOpenTerminal: Event<TerminalInfo>;

  termMap: Map<string, Terminal>;

  onSelectChange(e: React.ChangeEvent);

  wrapElSize: {
    height: string,
    width: string,
  };

  setWrapEl(el: HTMLElement);

  sendText(id, text: string, addNewLine?: boolean);

  createTerminal(options?: TerminalOptions, id?: string): Terminal;

  showTerm(id: string, preserveFocus?: boolean);

  hideTerm(id: string);

  removeTerm(id?: string);

  getProcessId(id: string): Promise<number>;
}

export interface TerminalInfo {
 id: string;
 name: string;
 isActive: boolean;
}
