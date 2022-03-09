import type vscode from 'vscode';

import { Event, IDisposable, IExtensionProps } from '@opensumi/ide-core-common';
import {
  ITerminalInfo,
  ITerminalDimensionsDto,
  ITerminalLaunchError,
  ITerminalDimensions,
  ITerminalExitEvent,
  ITerminalLinkDto,
  ITerminalProfile,
  ICreateContributedTerminalProfileOptions,
} from '@opensumi/ide-terminal-next';
import { SerializableEnvironmentVariableCollection } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';

import { IExtensionDescription } from './extension';

export interface IMainThreadTerminal {
  $sendText(id: string, text: string, addNewLine?: boolean): void;
  $show(id: string, preserveFocus?: boolean): void;
  $hide(id: string): void;
  $dispose(id: string): void;
  $getProcessId(id: string): Promise<number | undefined>;
  $createTerminal(options: vscode.TerminalOptions): Promise<string | void>;
  $startLinkProvider(): void;
  $stopLinkProvider(): void;

  $registerProfileProvider(id: string, extensionIdentifier: string): void;
  $unregisterProfileProvider(id: string): void;

  // Process
  $sendProcessTitle(terminalId: string, title: string): void;
  $sendProcessData(terminalId: string, data: string): void;
  $sendProcessReady(terminalId: string, pid: number, cwd: string): void;
  $sendProcessExit(terminalId: string, exitCode: number | undefined): void;
  $sendProcessInitialCwd(terminalId: string, cwd: string): void;
  $sendProcessCwd(terminalId: string, initialCwd: string): void;
  $sendOverrideDimensions(terminalId: string, dimensions: ITerminalDimensions | undefined): void;

  $setEnvironmentVariableCollection(
    extensionIdentifier: string,
    persistent: boolean,
    collection: SerializableEnvironmentVariableCollection | undefined,
  ): void;
}

export interface IExtHostTerminal {
  activeTerminal: vscode.Terminal | undefined;
  terminals: vscode.Terminal[];
  shellPath: string;

  createTerminal(name?: string, shellPath?: string, shellArgs?: string[] | string): vscode.Terminal;
  createTerminalFromOptions(options: vscode.TerminalOptions): vscode.Terminal;
  createExtensionTerminal(options: vscode.ExtensionTerminalOptions): vscode.Terminal;
  // 用于连接已经创建好的 extensionTerminal
  attachPtyToTerminal(id: string, pty: vscode.Pseudoterminal): void;

  onDidChangeActiveTerminal: Event<vscode.Terminal | undefined>;

  onDidCloseTerminal: Event<vscode.Terminal>;

  onDidOpenTerminal: Event<vscode.Terminal>;

  $setTerminals(idList: ITerminalInfo[]);

  $onDidChangeActiveTerminal(id: string);

  $onDidCloseTerminal(e: ITerminalExitEvent);

  $onDidOpenTerminal(info: ITerminalInfo);

  dispose(): void;

  $startExtensionTerminal(
    id: string,
    initialDimensions: ITerminalDimensionsDto | undefined,
  ): Promise<ITerminalLaunchError | undefined>;
  $acceptProcessInput(id: string, data: string): void;
  $acceptProcessShutdown(id: string, immediate: boolean): void;
  $acceptProcessRequestInitialCwd(id: string): void;
  $acceptProcessRequestCwd(id: string): void;
  $acceptTerminalTitleChange(id: string, name: string): void;

  registerLinkProvider(provider: vscode.TerminalLinkProvider): IDisposable;
  $provideLinks(terminalId: string, line: string): Promise<ITerminalLinkDto[]>;
  $activateLink(terminalId: string, linkId: number): void;

  registerTerminalProfileProvider(
    extension: IExtensionDescription,
    id: string,
    provider: vscode.TerminalProfileProvider,
  ): IDisposable;
  $acceptDefaultProfile(profile: ITerminalProfile, automationProfile?: ITerminalProfile): void;
  $createContributedProfileTerminal(id: string, options: ICreateContributedTerminalProfileOptions): Promise<void>;

  // #region
  getEnviromentVariableCollection(extension: IExtensionProps): vscode.EnvironmentVariableCollection;
  // #endregion
}
