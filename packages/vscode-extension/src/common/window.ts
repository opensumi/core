import * as vscode from 'vscode';

export enum MainMessageType {
  Error = 'Error',
  Warning = 'Warning',
  Info = 'Info',
}

export interface IMainThreadMessage {
  $showMessage(type: MainMessageType, message: string, options: vscode.MessageOptions, actions: string[]): PromiseLike<number | undefined>;
}

export interface IExtHostMessage {
  showMessage(type: MainMessageType, message: string,
              optionsOrFirstItem?: vscode.MessageOptions | string | vscode.MessageItem,
              ...rest: (string | vscode.MessageItem)[]): Promise<string | vscode.MessageItem | undefined>;
}
