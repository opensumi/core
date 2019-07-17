import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { Disposable, Position, Range, Location } from '../../common/ext-types';
import * as extHostTypeConverter from '../../common/coverter';
import { MainThreadAPIIdentifier, IMainThreadWorkspace, IExtHostWorkspace, Handler, ArgumentProcessor } from '../../common';
import { Uri, WorkspaceRootsChangeEvent } from '../../common/ext-types';

export function createWorkspaceApiFactory(
  extHostWorkspace: ExtHostWorkspace,
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

  $onWorkspaceFoldersChanged(event: WorkspaceRootsChangeEvent) {

  }
}
