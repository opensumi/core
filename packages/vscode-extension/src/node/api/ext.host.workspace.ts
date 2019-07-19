import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IMainThreadWorkspace, IExtHostWorkspace, Handler, ArgumentProcessor, ExtensionDocumentDataManager } from '../../common';
import { Uri } from '../../common/ext-types';
import { WorkspaceConfiguration } from '../../common';
import { ExtHostPreference } from './ext.host.preference';

export function createWorkspaceApiFactory(
  extHostWorkspace: ExtHostWorkspace,
  extHostPreference: ExtHostPreference,
  extHostDocument: ExtensionDocumentDataManager,
) {
  const workspace = {
    rootPath: extHostWorkspace.rootPath,
    getWorkspaceFolder: (uri, resolveParent) => {
      return extHostWorkspace.getWorkspaceFolder(uri, resolveParent);
    },
    workspaceFolders: () => {
      return extHostWorkspace.workspaceFolders;
    },
    getConfiguration: (section, resouce, extensionId) => {
      return extHostPreference.getConfiguration(section, resouce, extensionId);
    },
    onDidChangeConfiguration: (listener) => {
      return extHostPreference.onDidChangeConfiguration(listener);
    },
    openTextDocument: extHostDocument.openTextDocument.bind(extHostDocument),
    onDidOpenTextDocument: extHostDocument.onDidOpenTextDocument.bind(extHostDocument),
    onDidCloseTextDocument: extHostDocument.onDidCloseTextDocument.bind(extHostDocument),
    onDidChangeTextDocument: extHostDocument.onDidChangeTextDocument.bind(extHostDocument),
    onWillSaveTextDocument: extHostDocument.onWillSaveTextDocument.bind(extHostDocument),
    onDidSaveTextDocument: extHostDocument.onDidSaveTextDocument.bind(extHostDocument),
  };

  return workspace;
}

export class ExtHostWorkspace implements IExtHostWorkspace {
  protected readonly proxy: IMainThreadWorkspace;
  protected readonly rpcProtocol: IRPCProtocol;
  protected _workspaceFolders: vscode.WorkspaceFolder[] = [];

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadWorkspace);
    this.updateWorkspace();
  }

  async updateWorkspace() {
    this._workspaceFolders = await this.proxy.$getWorkspaceFolders();
  }

  get workspaceFolders(): vscode.WorkspaceFolder[] {
    return this._workspaceFolders.slice(0);
  }

  get rootPath(): string | undefined {
    // mutiWorkspace下需存放当前激活的工作区
    // 默认使用下标为0的rootPath
    if (this._workspaceFolders.length !== 0) {
      return this._workspaceFolders[0].uri.toString();
    }
    return undefined;
  }

  getWorkspaceFolder(uri: Uri, resolveParent?: boolean): vscode.WorkspaceFolder | undefined {
    return undefined;
  }

  getConfiguration(section?: string, resource?: Uri | null): WorkspaceConfiguration | void {
    // TODO: suppoer to read launch.json
    // this.proxy.$getConfiguration(section, resource);
  }

  $onWorkspaceFoldersChanged(event: any) {

  }
}
