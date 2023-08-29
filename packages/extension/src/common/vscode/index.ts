import type vscode from 'vscode';

import { createMainContextProxyIdentifier, createExtHostContextProxyIdentifier } from '@opensumi/ide-connection';
import { Emitter, IExtensionProps } from '@opensumi/ide-core-common';

import { IExtension, IExtensionHostService } from '..';
// eslint-disable-next-line import/no-restricted-paths
import type { MainThreadWindowState } from '../../browser/vscode/api/main.thread.window-state';
import { ExtHostFileSystem } from '../../hosted/api/vscode/ext.host.file-system';
import { ExtHostFileSystemEvent } from '../../hosted/api/vscode/ext.host.file-system-event';
import { ExtHostFileSystemInfo } from '../../hosted/api/vscode/ext.host.file-system-info';
import { ExtHostLanguages } from '../../hosted/api/vscode/ext.host.language';
import { ExtHostStorage } from '../../hosted/api/vscode/ext.host.storage';
import { ISumiExtHostWebviews } from '../sumi/webview';

import { IExtHostAuthentication, IMainThreadAuthentication } from './authentication';
import { IMainThreadCommands, IExtHostCommands } from './command';
import { IExtHostComments, IMainThreadComments } from './comments';
import { IExtHostConnection, IMainThreadConnection } from './connection';
import { IExtHostDebug, IMainThreadDebug } from './debug';
import { IExtHostDecorationsShape, IMainThreadDecorationsShape } from './decoration';
import { IMainThreadDocumentsShape, ExtensionDocumentDataManager } from './doc';
import {
  IMainThreadEditorsService,
  IExtensionHostEditorService,
  IMainThreadCustomEditor,
  IExtHostCustomEditor,
} from './editor';
import { IExtHostEditorTabs, IMainThreadEditorTabsShape } from './editor-tabs';
import { IMainThreadEnv, IExtHostEnv } from './env';
import { IMainThreadFileSystemShape } from './file-system';
import { IMainThreadLanguages } from './languages';
import { IExtHostLocalization, IMainThreadLocalization } from './localization';
import { IMainThreadPreference, IExtHostPreference } from './preference';
import { IExtHostProgress, IMainThreadProgress } from './progress';
import { IMainThreadSCMShape, IExtHostSCMShape } from './scm';
import { IExtHostSecret, IMainThreadSecret } from './secret';
import { IMainThreadStorage, IExtHostStorage } from './storage';
import { IExtHostTasks, IMainThreadTasks } from './tasks';
import { IExtHostTerminal, IMainThreadTerminal } from './terminal';
import { IExtHostTests } from './tests';
import { IExtHostTheming, IMainThreadTheming } from './theming';
import { IExtHostTreeView, IMainThreadTreeView } from './treeview';
import { IMainThreadUrls, IExtHostUrls } from './urls';
import { IMainThreadWebview, IExtHostWebview, IMainThreadWebviewView, IExtHostWebviewView } from './webview';
import {
  IMainThreadMessage,
  IExtHostMessage,
  IExtHostQuickOpen,
  IMainThreadQuickOpen,
  IMainThreadStatusBar,
  IExtHostStatusBar,
  IMainThreadOutput,
  IExtHostOutput,
  IExtHostWindowState,
  IExtHostWindow,
  IMainThreadWindow,
} from './window';
import { IMainThreadWorkspace, IExtHostWorkspace } from './workspace';

export const VSCodeExtensionService = Symbol('VSCodeExtensionService');
export interface VSCodeExtensionService {
  $getExtensions(): Promise<IExtensionProps[]>;

  $activateExtension(extensionPath: string): Promise<void>;
}

export interface SumiWorkerExtensionService extends VSCodeExtensionService {
  $getStaticServicePath(): Promise<string>;
}

export const MainThreadAPIIdentifier = {
  MainThreadCommands: createMainContextProxyIdentifier<IMainThreadCommands>('MainThreadCommands'),
  MainThreadStatusBar: createMainContextProxyIdentifier<IMainThreadStatusBar>('MainThreadStatusBar'),
  MainThreadOutput: createMainContextProxyIdentifier<IMainThreadOutput>('MainThreadOutput'),
  MainThreadLanguages: createMainContextProxyIdentifier<IMainThreadLanguages>('MainThreadLanguages'),
  MainThreadExtensionService: createMainContextProxyIdentifier<VSCodeExtensionService>('MainThreadExtensionService'),
  MainThreadDocuments: createMainContextProxyIdentifier<IMainThreadDocumentsShape>('MainThreadDocuments'),
  MainThreadEditors: createMainContextProxyIdentifier<IMainThreadEditorsService>('MainThreadEditors'),
  MainThreadMessages: createMainContextProxyIdentifier<IMainThreadMessage>('MainThreadMessage'),
  MainThreadWorkspace: createMainContextProxyIdentifier<IMainThreadWorkspace>('MainThreadWorkspace'),
  MainThreadPreference: createMainContextProxyIdentifier<IMainThreadPreference>('MainThreadPreference'),
  MainThreadEnv: createMainContextProxyIdentifier<IMainThreadEnv>('MainThreadEnv'),
  MainThreadQuickOpen: createMainContextProxyIdentifier<IMainThreadQuickOpen>('MainThreadQuickPick'),
  MainThreadStorage: createMainContextProxyIdentifier<IMainThreadStorage>('MainThreadStorage'),
  MainThreadFileSystem: createMainContextProxyIdentifier<IMainThreadFileSystemShape>('MainThreadFileSystem'),
  MainThreadWebview: createMainContextProxyIdentifier<IMainThreadWebview>('MainThreadWebview'),
  MainThreadWebviewView: createMainContextProxyIdentifier<IMainThreadWebviewView>('MainThreadWebviewView'),
  MainThreadTreeView: createMainContextProxyIdentifier<IMainThreadTreeView>('MainThreadTreeView'),
  MainThreadSCM: createMainContextProxyIdentifier<IMainThreadSCMShape>('MainThreadSCM'),
  MainThreadWindowState: createMainContextProxyIdentifier<MainThreadWindowState>('MainThreadWindowState'),
  MainThreadDecorations: createMainContextProxyIdentifier<IMainThreadDecorationsShape>('MainThreadDecorations'),
  MainThreadDebug: createMainContextProxyIdentifier<IMainThreadDebug>('MainThreadDebug'),
  MainThreadConnection: createMainContextProxyIdentifier<IMainThreadConnection>('MainThreadConnection'),
  MainThreadTerminal: createMainContextProxyIdentifier<IMainThreadTerminal>('MainThreadTerminal'),
  MainThreadWindow: createMainContextProxyIdentifier<IMainThreadWindow>('MainThreadWindow'),
  MainThreadProgress: createMainContextProxyIdentifier<IMainThreadProgress>('MainThreadProgress'),
  MainThreadTasks: createMainContextProxyIdentifier<IMainThreadTasks>('MainThreadTasks'),
  MainThreadComments: createMainContextProxyIdentifier<IMainThreadComments>('MainThreadComments'),
  MainThreadUrls: createMainContextProxyIdentifier<IMainThreadUrls>('MainThreadUrls'),
  MainThreadTheming: createMainContextProxyIdentifier<IMainThreadTheming>('MainThreadTheming'),
  MainThreadCustomEditor: createMainContextProxyIdentifier<IMainThreadCustomEditor>('MainThreadCustomEditor'),
  MainThreadAuthentication: createMainContextProxyIdentifier<IMainThreadAuthentication>('MainThreadAuthentication'),
  MainThreadSecret: createMainContextProxyIdentifier<IMainThreadSecret>('MainThreadSecret'),
  MainThreadReporter: createMainContextProxyIdentifier<IMainThreadSecret>('MainThreadReporter'),
  MainThreadTests: createMainContextProxyIdentifier<IMainThreadSecret>('MainThreadTests'),
  MainThreadEditorTabs: createMainContextProxyIdentifier<IMainThreadEditorTabsShape>('MainThreadEditorTabs'),
  MainThreadLocalization: createMainContextProxyIdentifier<IMainThreadLocalization>('MainThreadLocalization'),
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
  ExtHostFileSystemInfo: createExtHostContextProxyIdentifier<ExtHostFileSystemInfo>('ExtHostFileSystemInfo'),
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
  SumiExtHostWebview: createExtHostContextProxyIdentifier<ISumiExtHostWebviews>('SumiExtHostWebview'),
  ExtHostComments: createExtHostContextProxyIdentifier<IExtHostComments>('ExtHostComments'),
  ExtHostUrls: createExtHostContextProxyIdentifier<IExtHostUrls>('ExtHostUrls'),
  ExtHostCustomEditor: createExtHostContextProxyIdentifier<IExtHostCustomEditor>('ExtHostCustomEditor'),
  ExtHostAuthentication: createExtHostContextProxyIdentifier<IExtHostAuthentication>('ExtHostAuthentication'),
  ExtHostSecret: createExtHostContextProxyIdentifier<IExtHostSecret>('ExtHostSecret'),
  ExtHostTests: createExtHostContextProxyIdentifier<IExtHostTests>('ExtHostTests'),
  ExtHostEditorTabs: createExtHostContextProxyIdentifier<IExtHostEditorTabs>('ExtHostEditorTabs'),
  ExtHostLocalization: createExtHostContextProxyIdentifier<IExtHostLocalization>('ExtHostLocalization'),
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
export * from './secret';
export * from './tests';
export * from './editor-tabs';
export * from './scm';
export * from './decoration';
export * from './walkthrough';
export * from './localization';
