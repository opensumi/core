import * as vscode from 'vscode';
import * as types from './ext-types';
import { CancellationToken, MessageType, MaybePromise } from '@ali/ide-core-common';
import { QuickPickItem, QuickPickOptions, QuickInputOptions } from '@ali/ide-quick-open';
import { Event } from '@ali/ide-core-common';

export interface IMainThreadMessage {
  $showMessage(type: MessageType, message: string, options: vscode.MessageOptions, actions: string[]): Promise<number | undefined>;
}

export interface IExtHostMessage {
  showMessage(type: MessageType, message: string,
              optionsOrFirstItem?: vscode.MessageOptions | string | vscode.MessageItem,
              ...rest: (string | vscode.MessageItem)[]): Promise<string | vscode.MessageItem | undefined>;
}

export interface IMainThreadQuickOpen {
  $showQuickPick(items: QuickPickItem<number>[], options?: QuickPickOptions): Promise<number | undefined>;
  $hideQuickPick(): void;
  $showQuickInput(options: QuickInputOptions, validateInput: boolean): Promise<string | undefined>;
  $hideQuickinput(): void;
}

export interface IExtHostQuickOpen {
  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions, token?: CancellationToken): Promise<vscode.QuickPickItem | undefined>;
  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions & { canSelectMany: true; }, token?: CancellationToken): Promise<vscode.QuickPickItem[] | undefined>;
  showQuickPick(promiseOrItems: string[] | Promise<string[]>, options?: vscode.QuickPickOptions, token?: CancellationToken): Promise<string | undefined>;
  createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T>;
  createInputBox(): vscode.InputBox;
  hideQuickPick(): void;
  $validateInput(input: string): MaybePromise<string | null | undefined>;
  showInputBox(options?: vscode.InputBoxOptions, token?: CancellationToken): PromiseLike<string | undefined>;
  hideInputBox(): void;
}

export interface IMainThreadStatusBar {
  $setStatusBarMessage(text: string): void;

  $dispose(id?: string): void;

  $createStatusBarItem(id: string, alignment: number, priority: number): void;

  $setMessage(id: string,
              text: string | undefined,
              priority: number,
              alignment: number,
              color: string | undefined,
              tooltip: string | undefined,
              command: string | undefined): Promise<void>;

}

export interface IExtHostStatusBar {

  setStatusBarMessage(text: string, arg?: number | Thenable<any>): types.Disposable;

  createStatusBarItem(alignment?: types.StatusBarAlignment, priority?: number): types.StatusBarItem;

}

export interface IMainThreadOutput {
  $append(channelName: string, value: string): PromiseLike<void>;
  $clear(channelName: string): PromiseLike<void>;
  $dispose(channelName: string): PromiseLike<void>;
  $reveal(channelName: string, preserveFocus: boolean): PromiseLike<void>;
  $close(channelName: string): PromiseLike<void>;

}

export interface IExtHostOutput {

  createOutputChannel(name: string): types.OutputChannel;
}

export interface IExtHostWindowState {

  $setWindowState(focused: boolean);

  readonly state: types.WindowState;

  onDidChangeWindowState: Event<types.WindowState>;

}
