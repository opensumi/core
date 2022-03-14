import type vscode from 'vscode';

import { IJSONSchema, IJSONSchemaSnippet, Event } from '@opensumi/ide-core-common';
import { DebuggerDescription, DebugConfiguration, IDebuggerContribution, IDebugSessionDTO } from '@opensumi/ide-debug';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { Breakpoint } from './models';
import { WorkspaceFolder } from './models';

export type DebugSessionUUID = string;

export interface IStartDebuggingOptions {
  parentSessionID?: DebugSessionUUID;
  lifecycleManagedByParent?: boolean;
  repl?: 'separate' | 'mergeWithParent';
  noDebug?: boolean;
  compact?: boolean;
}

export interface IMainThreadDebug {
  $appendToDebugConsole(value: string): Promise<void>;
  $appendLineToDebugConsole(value: string): Promise<void>;
  $registerDebuggerContribution(description: DebuggerDescription): Promise<void>;
  $addBreakpoints(breakpoints: Breakpoint[]): Promise<void>;
  $removeBreakpoints(breakpoints: Breakpoint[]): Promise<void>;
  $startDebugging(
    folder: WorkspaceFolder | undefined,
    nameOrConfiguration: string | DebugConfiguration,
    options: IStartDebuggingOptions,
  ): Promise<boolean>;
  $stopDebugging(sessionId: DebugSessionUUID | undefined): Promise<void>;
  $customRequest(sessionId: string, command: string, args?: any): Promise<DebugProtocol.Response>;
  $getDebugProtocolBreakpoint(id: DebugSessionUUID, breakpoinId: string): Promise<DebugProtocol.Breakpoint | undefined>;
}

export interface IExtHostDebug {
  $onSessionCustomEvent(sessionId: string, event: string, body?: any): void;
  $breakpointsDidChange(all: Breakpoint[], added: Breakpoint[], removed: Breakpoint[], changed: Breakpoint[]): void;
  $sessionDidStart(sessionId: string): void;
  $sessionDidDestroy(sessionId: string): void;
  $sessionDidChange(sessionId: string | undefined): void;
  $provideDebugConfigurations(
    debugType: string,
    workspaceFolder: string | undefined,
    token?: vscode.CancellationToken,
  ): Promise<vscode.DebugConfiguration[]>;
  $resolveDebugConfigurations(
    debugConfiguration: vscode.DebugConfiguration,
    workspaceFolder: string | undefined,
    token?: vscode.CancellationToken,
  ): Promise<vscode.DebugConfiguration | undefined | null>;
  $resolveDebugConfigurationWithSubstitutedVariables(
    debugConfiguration: vscode.DebugConfiguration,
    workspaceFolder: string | undefined,
    token?: vscode.CancellationToken,
  ): Promise<vscode.DebugConfiguration | undefined | null>;
  $getSupportedLanguages(debugType: string): Promise<string[]>;
  $getSchemaAttributes(debugType: string): Promise<IJSONSchema[]>;
  $getConfigurationSnippets(debugType: string): Promise<IJSONSchemaSnippet[]>;
  $createDebugSession(debugSessionDTO: Exclude<IDebugSessionDTO, 'parentSession'>): Promise<string>;
  $terminateDebugSession(sessionId: string): Promise<void>;
  $getTerminalCreationOptions(debugType: string): Promise<any>;
  $registerDebuggerContributions(extensionFolder: string, contributions: IDebuggerContribution[]);
  $unregisterDebuggerContributions(contributions: IDebuggerContribution[]);
}

export interface IExtHostDebugService extends IExtHostDebug {
  onDidStartDebugSession: Event<vscode.DebugSession>;
  onDidTerminateDebugSession: Event<vscode.DebugSession>;
  onDidChangeActiveDebugSession: Event<vscode.DebugSession | undefined>;
  activeDebugSession: vscode.DebugSession | undefined;
  activeDebugConsole: vscode.DebugConsole;
  onDidReceiveDebugSessionCustomEvent: Event<vscode.DebugSessionCustomEvent>;
  onDidChangeBreakpoints: Event<vscode.BreakpointsChangeEvent>;
  breakpoints: vscode.Breakpoint[];

  addBreakpoints(breakpoints0: vscode.Breakpoint[]): Promise<void>;
  removeBreakpoints(breakpoints0: vscode.Breakpoint[]): Promise<void>;
  asDebugSourceUri(source: vscode.DebugProtocolSource, session?: vscode.DebugSession): vscode.Uri;
  startDebugging(
    folder: vscode.WorkspaceFolder | undefined,
    nameOrConfig: string | vscode.DebugConfiguration,
    parentSessionOrOptions?: vscode.DebugSession | vscode.DebugSessionOptions,
  ): Promise<boolean>;
  stopDebugging(session?: vscode.DebugSession): Promise<void>;
  registerDebugConfigurationProvider(
    type: string,
    provider: vscode.DebugConfigurationProvider,
    trigger: vscode.DebugConfigurationProviderTriggerKind,
  ): vscode.Disposable;
  registerDebugAdapterDescriptorFactory(type: string, factory: vscode.DebugAdapterDescriptorFactory): vscode.Disposable;
  registerDebugAdapterTrackerFactory(type: string, factory: vscode.DebugAdapterTrackerFactory): vscode.Disposable;
}

export type DebugActivationEvent = 'onDebugResolve' | 'onDebugInitialConfigurations' | 'onDebugAdapterProtocolTracker';
