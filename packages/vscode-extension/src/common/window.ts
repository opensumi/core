import * as vscode from 'vscode';
import { CancellationToken } from '@ali/ide-core-common';
import { QuickPickItem, QuickPickOptions } from '@ali/ide-quick-open';

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

export interface IMainThreadQuickPick {
  $showQuickPick(items: (string | QuickPickItem<vscode.QuickPickItem>)[], options?: QuickPickOptions): Promise<string | vscode.QuickPickItem | undefined>;
}

export interface IExtHostQuickPick {
  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions, token?: CancellationToken): Promise<vscode.QuickPickItem | undefined>;
  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions & { canSelectMany: true; }, token?: CancellationToken): Promise<vscode.QuickPickItem[] | undefined>;
  showQuickPick(promiseOrItems: string[] | Promise<string[]>, options?: vscode.QuickPickOptions, token?: CancellationToken): Promise<string | undefined>;
}
