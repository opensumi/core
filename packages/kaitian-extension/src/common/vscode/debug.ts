import * as vscode from 'vscode';

export interface IMainThreadDebug {
  $registerDebugTypes(debugTypes: string[]): void;
}

export interface IExtHostDebug {
  addBreakpoints(breakpoints0: vscode.Breakpoint[]): Promise<void>;
}
