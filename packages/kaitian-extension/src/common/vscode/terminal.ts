import { Event } from 'vscode';
import { TerminalInfo } from '@ali/ide-terminal2/lib/common';
import * as vscode from 'vscode';

export interface IMainThreadTerminal {
  $sendText(id: string, text: string, addNewLine?: boolean);

  $show(id: string, preserveFocus?: boolean);

  $hide(id: string);

  $dispose(id: string);

  $getProcessId(id: string);

  $createTerminal(options: vscode.TerminalOptions, id: string);
}

export interface IExtHostTerminal {
  activeTerminal: vscode.Terminal;
  terminals: vscode.Terminal[];

  createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): vscode.Terminal;
  createTerminal(options?: vscode.TerminalOptions, id?: string): vscode.Terminal;

  onDidChangeActiveTerminal: Event<vscode.Terminal | undefined>;

  onDidCloseTerminal: Event<vscode.Terminal>;

  onDidOpenTerminal: Event<vscode.Terminal>;

  $setTerminals(idList: TerminalInfo[]);

  $onDidChangeActiveTerminal(id: string);

  $onDidCloseTerminal(id: string);

  $onDidOpenTerminal(info: TerminalInfo);

  dispose(): void;
}
