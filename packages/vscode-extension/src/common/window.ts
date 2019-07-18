import * as vscode from 'vscode';

export enum MainMessageType {
  Error,
  Warning,
  Info,
}

export interface IMainThreadMessage {
  $showMessage(type: MainMessageType, message: string, options: vscode.MessageOptions, actions: string[]): Promise<string | undefined>;
}

export interface IExtHostMessage {
  showMessage(type: MainMessageType, message: string,
              optionsOrFirstItem?: vscode.MessageOptions | string | vscode.MessageItem,
              ...rest: (string | vscode.MessageItem)[]): Promise<string | vscode.MessageItem | undefined>;
}
