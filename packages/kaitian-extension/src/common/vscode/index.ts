import type * as vscode from 'vscode';
import { Emitter, IExtensionProps } from '@ali/ide-core-common';

import { createMainContextProxyIdentifier, createExtHostContextProxyIdentifier } from '@ali/ide-connection';
import { IMainThreadDocumentsShape, ExtensionDocumentDataManager } from './doc';
import { IMainThreadCommands, IExtHostCommands } from './command';
import { IMainThreadMessage, IExtHostMessage, IExtHostQuickOpen, IMainThreadQuickOpen, IMainThreadStatusBar, IExtHostStatusBar, IMainThreadOutput, IExtHostOutput, IExtHostWindowState, IExtHostWindow, IMainThreadWindow } from './window';
import { IMainThreadWorkspace, IExtHostWorkspace } from './workspace';
import { IMainThreadEditorsService, IExtensionHostEditorService, IMainThreadCustomEditor, IExtHostCustomEditor } from './editor';
import { ExtHostLanguages } from '../../hosted/api/vscode/ext.host.language';
import { IExtension, IExtensionHostService } from '../../common';
import { IMainThreadPreference, IExtHostPreference } from './preference';
import { IMainThreadEnv, IExtHostEnv } from './env';
import { IMainThreadStorage, IExtHostStorage } from './storage';
import { ExtHostStorage } from '../../hosted/api/vscode/ext.host.storage';
import { IMainThreadLanguages } from './languages';
import { IMainThreadWebview, IExtHostWebview, IMainThreadWebviewView, IExtHostWebviewView } from './webview';
import { IExtHostTreeView, IMainThreadTreeView } from './treeview';
import { IMainThreadSCMShape, IExtHostSCMShape } from './scm';
import { IExtHostDecorationsShape, IMainThreadDecorationsShape } from './decoration';
import { MainThreadWindowState } from '../../browser/vscode/api/main.thread.window-state';
import { IExtHostDebug, IMainThreadDebug } from './debug';
import { IExtHostConnection, IMainThreadConnection } from './connection';
import { IExtHostTerminal, IMainThreadTerminal } from './terminal';
import { IMainThreadFileSystemShape } from './file-system';
import { IKaitianExtHostWebviews } from '../kaitian/webview';
import { IExtHostProgress, IMainThreadProgress } from './progress';
import { IExtHostTheming, IMainThreadTheming } from './theming';
import { IExtHostTasks, IMainThreadTasks } from './tasks';
import { IExtHostComments, IMainThreadComments } from './comments';
import { ExtHostFileSystem } from '../../hosted/api/vscode/ext.host.file-system';
import { ExtHostFileSystemEvent } from '../../hosted/api/vscode/ext.host.file-system-event';
import { IMainThreadUrls, IExtHostUrls } from './urls';
import { IExtHostAuthentication, IMainThreadAuthentication } from './authentication';

export const VSCodeExtensionService = Symbol('VSCodeExtensionService');
export interface VSCodeExtensionService {

  $getExtensions(): Promise<IExtensionProps[]>;

  $activateExtension(extensionPath: string): Promise<void>;
}

export interface KaitianWorkerExtensionService extends VSCodeExtensionService {
  $getStaticServicePath(): Promise<string>;
}

export const MainThreadAPIIdentifier = {
  MainThreadCommands: createMainContextProxyIdentifier<IMainThreadCommands>('MainThreadCommands'),
  MainThreadStatusBar: createMainContextProxyIdentifier<IMainThreadStatusBar>('MainThreadStatusBar'),
  MainThreadOutput: createMainContextProxyIdentifier<IMainThreadOutput>('MainThreadOutput'),
  MainThreadLanguages: createMainContextProxyIdentifier<IMainThreadLanguages>('MainThreadLanguages'),
  MainThreadExtensionService: createMainContextProxyIdentifier<VSCodeExtensionService>('MainThreadExtensionService'),
  MainThreadDocuments: createExtHostContextProxyIdentifier<IMainThreadDocumentsShape>('MainThreadDocuments'),
  MainThreadEditors: createExtHostContextProxyIdentifier<IMainThreadEditorsService>('MainThreadEditors'),
  MainThreadMessages: createExtHostContextProxyIdentifier<IMainThreadMessage>('MainThreadMessage'),
  MainThreadWorkspace: createExtHostContextProxyIdentifier<IMainThreadWorkspace>('MainThreadWorkspace'),
  MainThreadPreference: createExtHostContextProxyIdentifier<IMainThreadPreference>('MainThreadPreference'),
  MainThreadEnv: createExtHostContextProxyIdentifier<IMainThreadEnv>('MainThreadEnv'),
  MainThreadQuickOpen: createExtHostContextProxyIdentifier<IMainThreadQuickOpen>('MainThreadQuickPick'),
  MainThreadStorage: createExtHostContextProxyIdentifier<IMainThreadStorage>('MainThreadStorage'),
  MainThreadFileSystem: createExtHostContextProxyIdentifier<IMainThreadFileSystemShape>('MainThreadFileSystem'),
  MainThreadWebview: createExtHostContextProxyIdentifier<IMainThreadWebview>('MainThreadWebview'),
  MainThreadWebviewView: createExtHostContextProxyIdentifier<IMainThreadWebviewView>('MainThreadWebviewView'),
  MainThreadTreeView: createExtHostContextProxyIdentifier<IMainThreadTreeView>('MainThreadTreeView'),
  MainThreadSCM: createExtHostContextProxyIdentifier<IMainThreadSCMShape>('MainThreadSCM'),
  MainThreadWindowState: createExtHostContextProxyIdentifier<MainThreadWindowState>('MainThreadWindowState'),
  MainThreadDecorations: createExtHostContextProxyIdentifier<IMainThreadDecorationsShape>('MainThreadDecorations'),
  MainThreadDebug: createExtHostContextProxyIdentifier<IMainThreadDebug>('MainThreadDebug'),
  MainThreadConnection: createExtHostContextProxyIdentifier<IMainThreadConnection>('MainThreadConnection'),
  MainThreadTerminal: createExtHostContextProxyIdentifier<IMainThreadTerminal>('MainThreadTerminal'),
  MainThreadWindow: createExtHostContextProxyIdentifier<IMainThreadWindow>('MainThreadWindow'),
  MainThreadProgress: createExtHostContextProxyIdentifier<IMainThreadProgress>('MainThreadProgress'),
  MainThreadTasks: createExtHostContextProxyIdentifier<IMainThreadTasks>('MainThreadTasks'),
  MainThreadComments: createExtHostContextProxyIdentifier<IMainThreadComments>('MainThreadComments'),
  MainThreadUrls: createExtHostContextProxyIdentifier<IMainThreadUrls>('MainThreadUrls'),
  MainThreadTheming: createExtHostContextProxyIdentifier<IMainThreadTheming>('MainThreadTheming'),
  MainThreadCustomEditor: createExtHostContextProxyIdentifier<IMainThreadCustomEditor>('MainThreadCustomEditor'),
  MainThreadAuthentication: createExtHostContextProxyIdentifier<IMainThreadAuthentication>('MainThreadAuthentication'),
};

export const ExtHostAPIIdentifier = {
  // 使用impl作为类型
  ExtHostLanguages: createExtHostContextProxyIdentifier<ExtHostLanguages>('ExtHostLanguages'),
  ExtHostStatusBar: createExtHostContextProxyIdentifier<IExtHostStatusBar>('ExtHostStatusBar'),
  ExtHostCommands: createExtHostContextProxyIdentifier<IExtHostCommands>('ExtHostCommandsRegistry'),
  ExtHostExtensionService: createExtHostContextProxyIdentifier<IExtensionHostService>('ExtHostExtensionService'),
  ExtHostDocuments: createExtHostContextProxyIdentifier<ExtensionDocumentDataManager>('ExtHostDocuments'),
  ExtHostEditors: createExtHostContextProxyIdentifier<IExtensionHostEditorService>('ExtHostEditors'),
  ExtHostMessage: createExtHostContextProxyIdentifier<IExtHostMessage>('ExtHostMessage'),
  ExtHostWorkspace: createExtHostContextProxyIdentifier<IExtHostWorkspace>('ExtHostWorkspace'),
  ExtHostPreference: createExtHostContextProxyIdentifier<IExtHostPreference>('ExtHostPreference'),
  ExtHostEnv: createExtHostContextProxyIdentifier<IExtHostEnv>('ExtHostEnv'),
  ExtHostQuickOpen: createExtHostContextProxyIdentifier<IExtHostQuickOpen>('ExtHostQuickOpen'),
  ExtHostStorage: createExtHostContextProxyIdentifier<IExtHostStorage>('ExtHostStorage'),
  ExtHostOutput: createExtHostContextProxyIdentifier<IExtHostOutput>('ExtHostOutput'),
  ExtHostFileSystem: createExtHostContextProxyIdentifier<ExtHostFileSystem>('ExtHostFileSystem'),
  ExtHostFileSystemEvent: createExtHostContextProxyIdentifier<ExtHostFileSystemEvent>('ExtHostFileSystemEvent'),
  ExtHostWebview: createExtHostContextProxyIdentifier<IExtHostWebview>('ExtHostWebview'),
  ExtHostWebviewView: createExtHostContextProxyIdentifier<IExtHostWebviewView>('ExtHostWebviewView'),
  ExtHostTreeView: createExtHostContextProxyIdentifier<IExtHostTreeView>('ExtHostTreeView'),
  ExtHostSCM: createExtHostContextProxyIdentifier<IExtHostSCMShape>('ExtHostSCM'),
  ExtHostWindowState: createExtHostContextProxyIdentifier<IExtHostWindowState>('ExtHostWindowState'),
  ExtHostDecorations: createExtHostContextProxyIdentifier<IExtHostDecorationsShape>('ExtHostDecorations'),
  ExtHostDebug: createExtHostContextProxyIdentifier<IExtHostDebug>('ExtHostDebug'),
  ExtHostConnection: createExtHostContextProxyIdentifier<IExtHostConnection>('ExtHostConnection'),
  ExtHostTerminal: createExtHostContextProxyIdentifier<IExtHostTerminal>('ExtHostTerminal'),
  ExtHostWindow: createExtHostContextProxyIdentifier<IExtHostWindow>('ExtHostWindow'),
  ExtHostProgress: createExtHostContextProxyIdentifier<IExtHostProgress>('ExtHostProgress'),
  ExtHostTheming: createExtHostContextProxyIdentifier<IExtHostTheming>('ExtHostTheming'),
  ExtHostTasks: createExtHostContextProxyIdentifier<IExtHostTasks>('ExtHostTasks'),
  KaitianExtHostWebview: createExtHostContextProxyIdentifier<IKaitianExtHostWebviews>('KaitianExtHostWebview'),
  ExtHostComments: createExtHostContextProxyIdentifier<IExtHostComments>('ExtHostComments'),
  ExtHostUrls: createExtHostContextProxyIdentifier<IExtHostUrls>('ExtHostUrls'),
  ExtHostCustomEditor: createExtHostContextProxyIdentifier<IExtHostCustomEditor>('ExtHostCustomEditor'),
  ExtHostAuthentication: createExtHostContextProxyIdentifier<IExtHostAuthentication>('ExtHostAuthentication'),
};

export abstract class VSCodeExtensionNodeService {
  abstract getExtHostPath(): Promise<string>;
}

export const VSCodeExtensionNodeServiceServerPath = 'VSCodeExtensionNodeServiceServerPath';

export interface IExtensionProcessService {
  $activateExtension(id: string): Promise<void>;
  activateExtension(id: string): Promise<void>;
  getExtensions(): IExtension[];
  $getExtensions(): IExtension[];
  getExtension(extensionId: string): vscode.Extension<any> | undefined;

  extensionsChangeEmitter: Emitter<string>;

  storage: ExtHostStorage;
}

export * from './doc';
export * from './command';
export * from './window';
export * from './workspace';
export * from './editor';
export * from './preference';
export * from './strings';
export * from './storage';
export * from './env';
export * from './languages';
export * from './paths';
export * from './webview';
export * from './treeview';
export * from './debug';
export * from './extension';
export * from './connection';
export * from './extension-message-reader';
export * from './extension-message-writer';
export * from './terminal';
export * from './progress';
export * from './tasks';
export * from './comments';
export * from './urls';
export * from './theming';
export * from './authentication';
