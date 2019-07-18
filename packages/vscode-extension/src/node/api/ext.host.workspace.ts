import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { Disposable, Position, Range, Location } from '../../common/ext-types';
import * as extHostTypeConverter from '../../common/coverter';
import { MainThreadAPIIdentifier, IMainThreadWorkspace, IExtHostWorkspace, Handler, ArgumentProcessor, ExtensionDocumentDataManager } from '../../common';
import { Uri } from '../../common/ext-types';

export function createWorkspaceApiFactory(
  extHostWorkspace: ExtHostWorkspace,
  extHostDocument: ExtensionDocumentDataManager,
) {
  const workspace = {
    getWorkspaceFolder(uri: Uri, resolveParent?: boolean): vscode.WorkspaceFolder | undefined {
      if (!extHostWorkspace) {
        return undefined;
      }
      return extHostWorkspace.getWorkspaceFolder(uri, resolveParent);
    },
    workspaceFolders: extHostWorkspace.workspaceFolders,
    getConfiguration(section?: string, resource?: Uri | null): any {
      return {};
    },
    onDidChangeConfiguration: () => {},
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

  getWorkspaceFolder(uri: Uri, resolveParent?: boolean): vscode.WorkspaceFolder | undefined {
    return undefined;
  }

  resolveWorkspaceFolder(uri: Uri): vscode.WorkspaceFolder | undefined {
    return undefined;
  }

  $onWorkspaceFoldersChanged(event: any) {

  }
}
