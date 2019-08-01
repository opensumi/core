import * as vscode from 'vscode';
import * as paths from 'path';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IMainThreadWorkspace, IExtHostWorkspace, Handler, ArgumentProcessor, ExtensionDocumentDataManager } from '../../common';
import { Uri } from '../../common/ext-types';
import { WorkspaceConfiguration, WorkspaceRootsChangeEvent } from '../../common';
import { ExtHostPreference } from './ext.host.preference';
import { createFileSystemApiFactory } from './ext.host.file-system';
import { Emitter, Event } from '@ali/ide-core-common';
import { Path } from '@ali/ide-core-common/lib/path';
import { FileStat, IExtHostFileSystem } from '@ali/ide-file-service';

export function createWorkspaceApiFactory(
  extHostWorkspace: ExtHostWorkspace,
  extHostPreference: ExtHostPreference,
  extHostDocument: ExtensionDocumentDataManager,
  extHostFileSystem: IExtHostFileSystem,
) {
  const fileSystemApi = createFileSystemApiFactory(extHostFileSystem);

  const workspace = {
    rootPath: extHostWorkspace.rootPath,
    onDidChangeWorkspaceFolders: extHostWorkspace.onDidChangeWorkspaceFolders,
    getWorkspaceFolder: (uri, resolveParent) => {
      return extHostWorkspace.getWorkspaceFolder(uri, resolveParent);
    },
    workspaceFolders: extHostWorkspace.workspaceFolders,
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
    registerTextDocumentContentProvider: extHostDocument.registerTextDocumentContentProvider.bind(extHostDocument),
    registerTaskProvider: () => {
      return null;
    },
    textDocuments: extHostDocument.getAllDocument(),
    ...fileSystemApi,
    onDidRenameFile: () => {},
  };

  return workspace;
}

export interface UriComponents {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
  external?: string;
}

export interface WorkspaceFolder {
  uri: UriComponents;
  name: string;
  index: number;
}

export function toWorkspaceFolder(folder: WorkspaceFolder): vscode.WorkspaceFolder {
  return {
      uri: Uri.revive(folder.uri),
      name: folder.name,
      index: folder.index,
  };
}

export class ExtHostWorkspace implements IExtHostWorkspace {
  private workspaceFoldersChangedEmitter = new Emitter<vscode.WorkspaceFoldersChangeEvent>();
  public readonly onDidChangeWorkspaceFolders: Event<vscode.WorkspaceFoldersChangeEvent> = this.workspaceFoldersChangedEmitter.event;

  protected readonly proxy: IMainThreadWorkspace;
  protected readonly rpcProtocol: IRPCProtocol;

  private folders: vscode.WorkspaceFolder[] | undefined;
  protected _workspaceFolder: vscode.WorkspaceFolder[] = [];

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadWorkspace);
  }

  /**
   * FileStat 转 vscode.WorkspaceFolder
   * @private
   * @param {FileStat} root
   * @param {number} index
   * @returns {vscode.WorkspaceFolder}
   * @memberof ExtHostWorkspace
   */
  private toWorkspaceFolder(root: FileStat, index: number): vscode.WorkspaceFolder {
    const uri = Uri.parse(root.uri);
    const path = new Path(uri.path);
    return {
      uri,
      name: path.base,
      index,
    };
  }

  private deltaFolders(currentFolders: vscode.WorkspaceFolder[] = [], newFolders: vscode.WorkspaceFolder[] = []): {
    added: vscode.WorkspaceFolder[]
    removed: vscode.WorkspaceFolder[],
  } {
    const added = this.foldersDiff(newFolders, currentFolders);
    const removed = this.foldersDiff(currentFolders, newFolders);
    return { added, removed };
  }

  private foldersDiff(folder1: vscode.WorkspaceFolder[] = [], folder2: vscode.WorkspaceFolder[] = []): vscode.WorkspaceFolder[] {
    const map = new Map();
    folder1.forEach((folder) => map.set(folder.uri.toString(), folder));
    folder2.forEach((folder) => map.delete(folder.uri.toString()));

    return folder1.filter((folder) => map.has(folder.uri.toString()));
  }

  get workspaceFolders(): vscode.WorkspaceFolder[] | undefined {
    return this.folders;
  }

  get rootPath(): string | undefined {
    const folder = this.folders && this.folders[0];
    return folder && folder.uri.fsPath;
  }

  $onWorkspaceFoldersChanged(event: WorkspaceRootsChangeEvent): void {
    const newRoots = event.roots || [];
    const newFolders = newRoots.map((root, index) => this.toWorkspaceFolder(root, index));
    const delta = this.deltaFolders(this.folders, newFolders);

    this.folders = newFolders;

    this.workspaceFoldersChangedEmitter.fire(delta);
  }

  getWorkspaceFolder(uri: Uri, resolveParent?: boolean): vscode.WorkspaceFolder | undefined {
    if (!this.folders || !this.folders.length) {
      return undefined;
    }

    function dirname(resource: Uri): Uri {
      if (resource.scheme === 'file') {
        return Uri.file(paths.dirname(resource.fsPath));
      }
      return resource.with({
        path: paths.dirname(resource.path),
      });
    }

    if (resolveParent && this.hasFolder(uri)) {
      uri = dirname(uri);
    }

    const resourcePath = uri.toString();

    let workspaceFolder: vscode.WorkspaceFolder | undefined;
    for (const folder of this.folders) {
      const folderPath = folder.uri.toString();

      if (resourcePath === folderPath) {
        return toWorkspaceFolder(folder);
      }

      if (resourcePath.startsWith(folderPath)
        && resourcePath[folderPath.length] === '/'
        && (!workspaceFolder || folderPath.length > workspaceFolder.uri.toString().length)) {
        workspaceFolder = folder;
      }
    }
    return workspaceFolder;
  }

  private hasFolder(uri: Uri): boolean {
    if (!this.folders) {
        return false;
    }
    return this.folders.some((folder) => folder.uri.toString() === uri.toString());
  }

}
