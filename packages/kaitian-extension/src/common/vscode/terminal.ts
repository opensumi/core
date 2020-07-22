import { Event } from 'vscode';
import { ITerminalInfo } from '@ali/ide-terminal-next';
import * as vscode from 'vscode';

export interface IMainThreadTerminal {
  $sendText(id: string, text: string, addNewLine?: boolean);

  $show(id: string, preserveFocus?: boolean);

  $hide(id: string);

  $dispose(id: string);

  $getProcessId(id: string);

  $createTerminal(options: vscode.TerminalOptions);
}

export interface IExtHostTerminal {
  activeTerminal: vscode.Terminal | undefined;
  terminals: vscode.Terminal[];
  shellPath: string;

  createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): vscode.Terminal;
  createTerminal(options?: vscode.TerminalOptions, id?: string): vscode.Terminal;

  onDidChangeActiveTerminal: Event<vscode.Terminal | undefined>;

  onDidCloseTerminal: Event<vscode.Terminal>;

  onDidOpenTerminal: Event<vscode.Terminal>;

  $setTerminals(idList: ITerminalInfo[]);

  $onDidChangeActiveTerminal(id: string);

  $onDidCloseTerminal(id: string);

  $onDidOpenTerminal(info: ITerminalInfo);

  $acceptDefaultShell(shellPath: string);

  dispose(): void;

}
