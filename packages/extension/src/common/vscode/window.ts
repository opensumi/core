import type vscode from 'vscode';

import {
  CancellationToken,
  MessageType,
  MaybePromise,
  IMarkdownString,
  IThemeColor,
  Event,
} from '@opensumi/ide-core-common';
import { QuickPickItem, QuickPickOptions, QuickInputOptions, QuickTitleButton } from '@opensumi/ide-quick-open';

import * as types from './ext-types';
import { UriComponents, QuickInputButton } from './ext-types';
import { IExtensionDescription } from './extension';

export interface IMainThreadMessage {
  $showMessage(
    type: MessageType,
    message: string,
    options: vscode.MessageOptions,
    actions: string[],
    from?: string,
  ): Promise<number | undefined>;
}

export interface IExtHostMessage {
  showMessage(
    type: MessageType,
    message: string,
    optionsOrFirstItem?: vscode.MessageOptions | string | vscode.MessageItem,
    from?: string,
    ...rest: (string | vscode.MessageItem)[]
  ): Promise<string | vscode.MessageItem | undefined>;
}

export interface IMainThreadQuickOpen {
  $showQuickPick(
    session: number,
    items: QuickPickItem<number>[],
    options?: QuickPickOptions,
  ): Promise<number | undefined>;
  $hideQuickPick(): void;
  $showQuickInput(options: QuickInputOptions, validateInput: boolean): Promise<string | undefined>;
  $hideQuickInput(): void;
  $createOrUpdateInputBox(id: number, options: QuickInputOptions): void;
  $hideInputBox(id: number): void;
  $disposeInputBox(id: number): void;
}

type VSCodeQuickPickItem = string | vscode.QuickPickItem;

export interface IExtHostQuickOpen {
  $onDidTriggerButton(handler: number): void;
  $onItemSelected(handler: number): void;
  showQuickPick(
    promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>,
    options?: vscode.QuickPickOptions,
    token?: CancellationToken,
  ): Promise<vscode.QuickPickItem | undefined>;
  showQuickPick(
    promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>,
    options?: vscode.QuickPickOptions & { canSelectMany: true },
    token?: CancellationToken,
  ): Promise<vscode.QuickPickItem[] | undefined>;
  showQuickPick(
    promiseOrItems: string[] | Promise<string[]>,
    options?: QuickPickOptions,
    token?: CancellationToken,
  ): Promise<string | undefined>;
  showQuickPick(
    itemsOrItemsPromise: VSCodeQuickPickItem[] | Promise<VSCodeQuickPickItem[]>,
    options?: vscode.QuickPickOptions,
    token?: vscode.CancellationToken,
  ): Promise<VSCodeQuickPickItem | VSCodeQuickPickItem[] | undefined>;
  showWorkspaceFolderPick(
    options: vscode.WorkspaceFolderPickOptions,
    token?: CancellationToken,
  ): Promise<vscode.WorkspaceFolder | undefined>;
  createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T>;
  createInputBox(): vscode.InputBox;
  hideQuickPick(): void;
  showInputBox(options?: QuickInputOptions, token?: CancellationToken): PromiseLike<string | undefined>;
  hideInputBox(): void;
  $validateInput(input: string): MaybePromise<string | null | undefined>;
  $onDidChangeValue(sessionId: number, value: string): void;
  $onCreatedInputBoxDidChangeValue(sessionId: number, value: string): void;
  $onCreatedInputBoxDidAccept(sessionId: number): void;
  $onCreatedInputBoxDidHide(sessionId: number): void;
  $onCreatedInputBoxDidTriggerButton(sessionId: number, btnHandler: number): void;
}

export interface QuickInputTitleButtonHandle extends QuickTitleButton {
  index: number; // index of where they are in buttons array if QuickInputButton or -1 if QuickInputButtons.Back
}

export interface ITransferQuickInput {
  quickInputIndex: number;
  title: string | undefined;
  step: number | undefined;
  totalSteps: number | undefined;
  enabled: boolean;
  busy: boolean;
  ignoreFocusOut: boolean;
}

export interface ITransferInputBox extends ITransferQuickInput {
  value: string;
  placeholder: string | undefined;
  password: boolean;
  buttons: ReadonlyArray<QuickInputButton>;
  prompt: string | undefined;
  validationMessage: string | undefined;
  validateInput(value: string): MaybePromise<string | undefined>;
}

export interface ITransferQuickPick<T extends vscode.QuickPickItem> extends ITransferQuickInput {
  value: string;
  placeholder: string | undefined;
  buttons: ReadonlyArray<QuickInputButton>;
  items: PickOpenItem[];
  canSelectMany: boolean;
  matchOnDescription: boolean;
  matchOnDetail: boolean;
  activeItems: ReadonlyArray<T>;
  selectedItems: ReadonlyArray<T>;
}

export interface QuickPickValue<T> {
  label: string;
  value: T;
  description?: string;
  detail?: string;
  iconClass?: string;
}

export interface PickOpenItem {
  handle: number;
  id?: string;
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
}

export interface IMainThreadStatusBar {
  $setStatusBarMessage(text: string): void;

  $dispose(entryId?: string): void;

  $createStatusBarItem(entryId: string, id: string, alignment: number, priority: number): void;

  $setMessage(
    entryId: string,
    id: string,
    name: string,
    text: string | undefined,
    priority: number,
    alignment: number,
    color: IThemeColor | string | undefined,
    backgroundColor: IThemeColor | undefined,
    tooltip: string | IMarkdownString | undefined,
    accessibilityInformation: vscode.AccessibilityInformation | undefined,
    command: string | undefined,
    commandArgs: any[] | undefined,
  ): Promise<void>;
}

export interface IExtHostStatusBar {
  setStatusBarMessage(text: string, arg?: number | Thenable<any>): vscode.Disposable;

  createStatusBarItem(
    extension: IExtensionDescription,
    id?: string,
    alignment?: types.StatusBarAlignment,
    priority?: number,
  ): vscode.StatusBarItem;
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

export interface IExtHostWindow {
  $onOpenDialogResult(id: string, result: UriComponents[] | undefined): void;
  $onSaveDialogResult(id: string, result: UriComponents | undefined): void;
}

export interface IMainThreadWindow {
  $showOpenDialog(id: string, options: IExtOpenDialogOptions): void;
  $showSaveDialog(id: string, options: IExtSaveDialogOptions): void;
}

export interface IExtDialogOptions {
  defaultUri?: UriComponents;
  // TODO: 待实现 filters 能力
  filters?: {
    [name: string]: string[];
  };
}

export interface IExtSaveDialogOptions extends IExtDialogOptions {
  saveLabel?: string;
}

export interface IExtOpenDialogOptions extends IExtDialogOptions {
  canSelectFiles?: boolean;
  canSelectFolders?: boolean;
  canSelectMany?: boolean;
  openLabel?: string;
  title?: string;
}
