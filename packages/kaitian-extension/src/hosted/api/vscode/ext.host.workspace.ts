import * as vscode from 'vscode';
import * as paths from 'path';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IMainThreadWorkspace, IExtHostWorkspace, ExtensionDocumentDataManager } from '../../../common/vscode';
import { Uri, WorkspaceEdit } from '../../../common/vscode/ext-types';
import { WorkspaceRootsChangeEvent, IExtHostMessage, relative, normalize } from '../../../common/vscode';
import { ExtHostPreference } from './ext.host.preference';
import { createFileSystemApiFactory } from './ext.host.file-system';
import { Emitter, Event, MessageType } from '@ali/ide-core-common';
import { Path } from '@ali/ide-core-common/lib/path';
import { FileStat, IExtHostFileSystem } from '@ali/ide-file-service';
import { TypeConverts } from '../../../common/vscode/converter';

export function createWorkspaceApiFactory(
  extHostWorkspace: ExtHostWorkspace,
  extHostPreference: ExtHostPreference,
  extHostDocument: ExtensionDocumentDataManager,
  extHostFileSystem: IExtHostFileSystem,
) {
  const fileSystemApi = createFileSystemApiFactory(extHostFileSystem);

  const workspace = {
    rootPath: extHostWorkspace.rootPath,
    name: extHostWorkspace.name,
    asRelativePath: (pathOrUri: string | Uri, includeWorkspaceFolder?: boolean) => {
      return extHostWorkspace.getRelativePath(pathOrUri, includeWorkspaceFolder);
    },
    updateWorkspaceFolders: (start: number, deleteCount: number | undefined | null, ...workspaceFoldersToAdd: { uri: Uri, name?: string }[]) => {
      return extHostWorkspace.updateWorkspaceFolders(start, deleteCount || 0, ...workspaceFoldersToAdd);
    },
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
    applyEdit: (edit) => {
      return extHostWorkspace.applyEdit(edit);
    },
    textDocuments: extHostDocument.getAllDocument(),
    ...fileSystemApi,
    onDidRenameFile: () => { },
    saveAll: () => {
      return extHostWorkspace.saveAll();
    },
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

  private messageService: IExtHostMessage;

  constructor(rpcProtocol: IRPCProtocol, extHostMessage: IExtHostMessage, private extHostDoc: ExtensionDocumentDataManager) {
    this.messageService = extHostMessage;
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

  get name(): string | undefined {
    const folder = this.folders && this.folders[0];
    return folder && folder.name;
  }

  getRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string | undefined {
    let path: string | undefined;
    if (typeof pathOrUri === 'string') {
      path = pathOrUri;
    } else if (typeof pathOrUri !== 'undefined') {
      path = pathOrUri.fsPath;
    }

    if (!path) {
      return path;
    }

    const folder = this.getWorkspaceFolder(
      typeof pathOrUri === 'string' ? Uri.file(pathOrUri) : pathOrUri,
      true,
    ) as vscode.WorkspaceFolder;

    if (!folder) {
      return path;
    }

    if (typeof includeWorkspaceFolder === 'undefined') {
      includeWorkspaceFolder = this.folders!.length > 1;
    }

    let result = relative(folder.uri.fsPath, path);
    if (includeWorkspaceFolder) {
      result = `${folder.name}/${result}`;
    }
    return normalize(result, true);
  }

  updateWorkspaceFolders(start: number, deleteCount: number, ...workspaceFoldersToAdd: { uri: Uri, name?: string }[]): boolean {
    const rootsToAdd = new Set<string>();
    if (Array.isArray(workspaceFoldersToAdd)) {
      workspaceFoldersToAdd.forEach((folderToAdd) => {
        const uri = Uri.isUri(folderToAdd.uri) && folderToAdd.uri.toString();
        if (uri && !rootsToAdd.has(uri)) {
          rootsToAdd.add(uri);
        }
      });
    }

    if ([start, deleteCount].some((i) => typeof i !== 'number' || i < 0)) {
      return false;
    }

    if (deleteCount === 0 && rootsToAdd.size === 0) {
      return false;
    }

    const currentWorkspaceFolders = this.workspaceFolders || [];
    if (start + deleteCount > currentWorkspaceFolders.length) {
      return false;
    }

    // 数据层模拟执行updateWorkspaceFolders操作以验证有效性
    const newWorkspaceFolders = currentWorkspaceFolders.slice(0);
    newWorkspaceFolders.splice(start, deleteCount, ...[...rootsToAdd].map((uri) => ({ uri: Uri.parse(uri), name: undefined!, index: undefined! })));

    for (let i = 0; i < newWorkspaceFolders.length; i++) {
      const folder = newWorkspaceFolders[i];
      if (newWorkspaceFolders.some((otherFolder, index) => index !== i && folder.uri.toString() === otherFolder.uri.toString())) {
        return false; // 不能重复添加相同的文件夹
      }
    }

    const { added, removed } = this.deltaFolders(currentWorkspaceFolders, newWorkspaceFolders);
    if (added.length === 0 && removed.length === 0) {
      return false; // 无需任何更改
    }

    // 通知主进程更新对应目录
    this.proxy.$updateWorkspaceFolders(start, deleteCount, ...rootsToAdd).then(undefined, (error) =>
      this.messageService.showMessage(MessageType.Error, `Failed to update workspace folders: ${error}`),
    );

    return true;
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

  applyEdit(edit: WorkspaceEdit): Promise<boolean> {
    const dto = TypeConverts.WorkspaceEdit.from(edit, this.extHostDoc);
    return this.proxy.$tryApplyWorkspaceEdit(dto);
  }

  saveAll(): Promise<boolean> {
    return this.proxy.$saveAll();
  }
}
