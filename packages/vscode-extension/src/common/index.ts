import * as vscode from 'vscode';
import { Emitter } from '@ali/ide-core-common';
import { createMainContextProxyIdentifier, createExtHostContextProxyIdentifier } from '@ali/ide-connection';
import { VSCodeExtensionService } from '../browser/types';
import { IMainThreadDocumentsShape, ExtensionDocumentDataManager } from './doc';
import { IMainThreadCommands, IExtHostCommands } from './command';
import { IMainThreadMessage, IExtHostMessage, IExtHostQuickOpen, IMainThreadQuickOpen, IMainThreadStatusBar, IExtHostStatusBar, IMainThreadOutput, IExtHostOutput } from './window';
import { IMainThreadWorkspace, IExtHostWorkspace } from './workspace';
import { IMainThreadEditorsService, IExtensionHostEditorService } from './editor';
import { ExtHostLanguages } from '../node/api/ext.host.language';
import { IFeatureExtension } from '@ali/ide-feature-extension/src/browser/types';
import { IMainThreadPreference, IExtHostPreference } from './preference';
import { IMainThreadEnv, IExtHostEnv } from './env';
import { IExtHostFileSystem, IMainThreadFileSystem } from '@ali/ide-file-service/lib/common/';
import { IMainThreadStorage, IExtHostStorage } from './storage';
import { ExtHostStorage } from '../node/api/ext.host.storage';
import { IMainThreadLanguages } from './languages';

export const MainThreadAPIIdentifier = {
  MainThreadCommands: createMainContextProxyIdentifier<IMainThreadCommands>('MainThreadCommands'),
  MainThreadStatusBar: createMainContextProxyIdentifier<IMainThreadStatusBar>('MainThreadStatusBar'),
  MainThreadOutput: createMainContextProxyIdentifier<IMainThreadOutput>('MainThreadOutput'),
  MainThreadLanguages: createMainContextProxyIdentifier<IMainThreadLanguages>('MainThreadLanguages'),
  MainThreadExtensionServie: createMainContextProxyIdentifier<VSCodeExtensionService>('MainThreadExtensionServie'),
  MainThreadDocuments: createExtHostContextProxyIdentifier<IMainThreadDocumentsShape>('MainThreadDocuments'),
  MainThreadEditors: createExtHostContextProxyIdentifier<IMainThreadEditorsService>('MainThreadEditors'),
  MainThreadMessages: createExtHostContextProxyIdentifier<IMainThreadMessage>('MainThreadMessage'),
  MainThreadWorkspace: createExtHostContextProxyIdentifier<IMainThreadWorkspace>('MainThreadWorkspace'),
  MainThreadPreference: createExtHostContextProxyIdentifier<IMainThreadPreference>('MainThreadPreference'),
  MainThreadEnv: createExtHostContextProxyIdentifier<IMainThreadEnv>('MainThreadEnv'),
  MainThreadQuickOpen: createExtHostContextProxyIdentifier<IMainThreadQuickOpen>('MainThreadQuickPick'),
  MainThreadStorage: createExtHostContextProxyIdentifier<IMainThreadStorage>('MainThreadStorage'),
  MainThreadFileSystem: createExtHostContextProxyIdentifier<IMainThreadFileSystem>('MainThreadFileSystem'),
};

export const ExtHostAPIIdentifier = {
  // 使用impl作为类型
  ExtHostLanguages: createExtHostContextProxyIdentifier<ExtHostLanguages>('ExtHostLanguages'),
  ExtHostStatusBar: createExtHostContextProxyIdentifier<IExtHostStatusBar>('ExtHostStatusBar'),
  ExtHostCommands: createExtHostContextProxyIdentifier<IExtHostCommands>('ExtHostCommandsRegistry'),
  ExtHostExtensionService: createExtHostContextProxyIdentifier<IExtensionProcessService>('ExtHostExtensionService'),
  ExtHostDocuments: createExtHostContextProxyIdentifier<ExtensionDocumentDataManager>('ExtHostDocuments'),
  ExtHostEditors: createExtHostContextProxyIdentifier<IExtensionHostEditorService>('ExtHostEditors'),
  ExtHostMessage: createExtHostContextProxyIdentifier<IExtHostMessage>('ExtHostMessage'),
  ExtHostWorkspace: createExtHostContextProxyIdentifier<IExtHostWorkspace>('ExtHostWorkspace'),
  ExtHostPreference: createExtHostContextProxyIdentifier<IExtHostPreference>('ExtHostPreference'),
  ExtHostEnv: createExtHostContextProxyIdentifier<IExtHostEnv>('ExtHostEnv'),
  ExtHostQuickOpen: createExtHostContextProxyIdentifier<IExtHostQuickOpen>('ExtHostQuickOpen'),
  ExtHostStorage: createExtHostContextProxyIdentifier<IExtHostStorage>('ExtHostStorage'),
  ExtHostOutput: createExtHostContextProxyIdentifier<IExtHostOutput>('ExtHostOutput'),
  ExtHostFileSystem: createExtHostContextProxyIdentifier<IExtHostFileSystem>('ExtHostFileSystem'),
};

export abstract class VSCodeExtensionNodeService {
  abstract async getExtHostPath(): Promise<string>;
}

export const VSCodeExtensionNodeServiceServerPath = 'VSCodeExtensionNodeServiceServerPath';

export interface IExtensionProcessService {
  $activateExtension(id: string): Promise<void>;
  activateExtension(id: string): Promise<void>;
  getExtensions(): IFeatureExtension[];
  $getExtensions(): IFeatureExtension[];
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
