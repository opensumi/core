import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IMainThreadWorkspace, IExtHostWorkspace, Handler, ArgumentProcessor } from '../../common';
import { Uri } from '../../common/ext-types';
import { WorkspaceConfiguration } from '../../common';
import { ExtHostPreference } from './ext.host.preference';

export function createWorkspaceApiFactory(
  extHostWorkspace: ExtHostWorkspace,
  extHostPreference: ExtHostPreference,
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

  getConfiguration(section?: string, resource?: Uri | null): WorkspaceConfiguration | void {
    // TODO: suppoer to read launch.json
    // this.proxy.$getConfiguration(section, resource);
  }

  $onWorkspaceFoldersChanged(event: any) {

  }
}
