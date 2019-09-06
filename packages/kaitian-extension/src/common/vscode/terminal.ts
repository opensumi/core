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

  $setTerminals(idList: TerminalInfo[]);

  $onDidChangeActiveTerminal(id: string);

  $onDidCloseTerminal(id: string);

  $onDidOpenTerminal(info: TerminalInfo);
}
