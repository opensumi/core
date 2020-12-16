import { Event } from '@ali/ide-core-common';
import { ITerminalInfo, ITerminalDimensionsDto, ITerminalLaunchError, ITerminalDimensions } from '@ali/ide-terminal-next';
import type * as vscode from 'vscode';

export interface IMainThreadTerminal {
  $sendText(id: string, text: string, addNewLine?: boolean);

  $show(id: string, preserveFocus?: boolean);

  $hide(id: string);

  $dispose(id: string);

  $getProcessId(id: string);

  $createTerminal(options: vscode.TerminalOptions);

  // Process
  $sendProcessTitle(terminalId: string, title: string): void;
  $sendProcessData(terminalId: string, data: string): void;
  $sendProcessReady(terminalId: string, pid: number, cwd: string): void;
  $sendProcessExit(terminalId: string, exitCode: number | undefined): void;
  $sendProcessInitialCwd(terminalId: string, cwd: string): void;
  $sendProcessCwd(terminalId: string, initialCwd: string): void;
  $sendOverrideDimensions(terminalId: string, dimensions: ITerminalDimensions | undefined): void;
}

export interface IExtHostTerminal {
  activeTerminal: vscode.Terminal | undefined;
  terminals: vscode.Terminal[];
  shellPath: string;

  createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): vscode.Terminal;
  createTerminalFromOptions(options: vscode.TerminalOptions): vscode.Terminal;
  createExtensionTerminal(options: vscode.ExtensionTerminalOptions): vscode.Terminal;

  onDidChangeActiveTerminal: Event<vscode.Terminal | undefined>;

  onDidCloseTerminal: Event<vscode.Terminal>;

  onDidOpenTerminal: Event<vscode.Terminal>;

  $setTerminals(idList: ITerminalInfo[]);

  $onDidChangeActiveTerminal(id: string);

  $onDidCloseTerminal(id: string);

  $onDidOpenTerminal(info: ITerminalInfo);

  $acceptDefaultShell(shellPath: string);

  dispose(): void;

  $startExtensionTerminal(id: string, initialDimensions: ITerminalDimensionsDto | undefined): Promise<ITerminalLaunchError | undefined>;
  $acceptProcessInput(id: string, data: string): void;
  $acceptProcessShutdown(id: string, immediate: boolean): void;
  $acceptProcessRequestInitialCwd(id: string): void;
  $acceptProcessRequestCwd(id: string): void;
}
