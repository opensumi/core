import { Injectable, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { URI, IDisposable, Emitter, Event, Uri, dispose, Disposable } from '@opensumi/ide-core-common';
import { ensureDir } from '@opensumi/ide-core-common/lib/browser-fs/ensure-dir';
import { BinaryBuffer } from '@opensumi/ide-core-common/lib/utils/buffer';
import { FileChange, FileSystemProviderCapabilities, FileStat as IFileStat } from '@opensumi/ide-file-service';
import {
  IFileServiceClient,
  FileType,
  FileOperationError,
  FileOperationResult,
  FileSystemProvider,
  IBrowserFileSystemRegistry,
} from '@opensumi/ide-file-service/lib/common';

import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { toFileStat, fromFileStat } from '../../../common/vscode/converter';
import { UriComponents } from '../../../common/vscode/ext-types';
import {
  IExtHostFileSystemShape,
  FileDeleteOptions,
  IMainThreadFileSystemShape,
  FileStat,
  FileSystemProviderErrorCode,
  FileOverwriteOptions,
  IExtHostFileSystemInfoShape,
  FilePermission,
} from '../../../common/vscode/file-system';

@Injectable({ multiple: true })
export class MainThreadFileSystem implements IMainThreadFileSystemShape {
  private readonly disposable = new Disposable();
  private readonly _proxy: IExtHostFileSystemShape;
  private readonly _fileProvider = new Map<number, RemoteFileSystemProvider>();

  @Autowired(IFileServiceClient)
  private readonly _fileService: IFileServiceClient;

  @Autowired(IBrowserFileSystemRegistry)
  private schemeRegistry: IBrowserFileSystemRegistry;

  constructor(private readonly rpcProtocol: IRPCProtocol) {
    this._proxy = this.rpcProtocol.getProxy<IExtHostFileSystemShape>(ExtHostAPIIdentifier.ExtHostFileSystem);

    const infoProxy = this.rpcProtocol.getProxy<IExtHostFileSystemInfoShape>(
      ExtHostAPIIdentifier.ExtHostFileSystemInfo,
    );

    for (const entry of this._fileService.listCapabilities()) {
      infoProxy.$acceptProviderInfos(entry.scheme, entry.capabilities);
    }
    this.disposable.addDispose(
      this._fileService.onDidChangeFileSystemProviderRegistrations((e) =>
        infoProxy.$acceptProviderInfos(e.scheme, e.provider?.capabilities ?? null),
      ),
    );
    this.disposable.addDispose(
      this._fileService.onDidChangeFileSystemProviderCapabilities((e) =>
        infoProxy.$acceptProviderInfos(e.scheme, e.provider.capabilities),
      ),
    );
  }

  dispose(): void {
    this.disposable.dispose();
    this._fileProvider.forEach((value) => value.dispose());
    this._fileProvider.clear();
  }

  $registerFileSystemProvider(handle: number, scheme: string, capabilities: FileSystemProviderCapabilities): void {
    this.disposable.addDispose(this.schemeRegistry.registerFileSystemProvider({ scheme }));

    this._fileProvider.set(
      handle,
      new RemoteFileSystemProvider(this._fileService, scheme, capabilities, handle, this._proxy),
    );
  }

  $unregisterProvider(handle: number): void {
    dispose(this._fileProvider.get(handle));
    this._fileProvider.delete(handle);
  }

  $onFileSystemChange(handle: number, changes: FileChange[]): void {
    const fileProvider = this._fileProvider.get(handle);
    if (!fileProvider) {
      throw new Error('Unknown file provider');
    }
    fileProvider.$onFileSystemChange(changes);
  }

  // --- consumer fs, vscode.workspace.fs

  $stat(uri: UriComponents): Promise<FileStat> {
    return this._fileService
      .getFileStat(URI.revive(uri).toString())
      .then((stat) => toFileStat(stat!))
      .catch(MainThreadFileSystem._handleError);
  }

  $readdir(uri: UriComponents): Promise<[string, FileType][]> {
    return this._fileService
      .getFileStat(URI.revive(uri).toString())
      .then((stat) => {
        if (!stat) {
          throw new Error('file stat undefined');
        }
        if (!stat.isDirectory) {
          const err = new Error(stat.uri);
          err.name = FileSystemProviderErrorCode.FileNotADirectory;
          throw err;
        }
        return !stat.children
          ? []
          : stat.children.map(
              (child) =>
                [new URI(child.uri).displayName, MainThreadFileSystem._asFileType(child)] as [string, FileType],
            );
      })
      .catch(MainThreadFileSystem._handleError);
  }

  private static _asFileType(stat: IFileStat): FileType {
    let res = 0;
    if (stat.type && stat.type === FileType.File) {
      res += FileType.File;
    } else if (stat.isDirectory) {
      res += FileType.Directory;
    }
    if (stat.isSymbolicLink) {
      res += FileType.SymbolicLink;
    }
    return res;
  }

  $readFile(uri: UriComponents): Promise<Uint8Array> {
    return this._fileService
      .readFile(URI.revive(uri).toString())
      .then((file) => file.content.buffer)
      .catch(MainThreadFileSystem._handleError);
  }

  async $writeFile(uri: UriComponents, content: Uint8Array): Promise<void> {
    const _uri = URI.revive(uri);
    const stat = await this._fileService.getFileStat(_uri.toString(), false);
    if (!stat) {
      // 文件不存在
      await ensureDir(new URI(_uri).path.dir.toString(), {
        mkdir: (path: string) => this.$mkdir(URI.file(path).codeUri),
        access: (path: string) =>
          this._fileService.getFileStat(URI.file(path).codeUri.toString(), false).then((stat) => !!stat),
      });
      return this._fileService
        .createFile(_uri.toString(), { content: BinaryBuffer.wrap(content).toString() })
        .then(() => undefined)
        .catch(MainThreadFileSystem._handleError);
    } else {
      return this._fileService
        .setContent(stat!, content)
        .then(() => undefined)
        .catch(MainThreadFileSystem._handleError);
    }
  }

  $rename(source: UriComponents, target: UriComponents, opts: FileOverwriteOptions): Promise<void> {
    return this._fileService
      .move(URI.revive(source).toString(), URI.revive(target).toString(), opts)
      .then(() => undefined)
      .catch(MainThreadFileSystem._handleError);
  }

  $copy(source: UriComponents, target: UriComponents, opts: FileOverwriteOptions): Promise<void> {
    return this._fileService
      .copy(URI.revive(source).toString(), URI.revive(target).toString(), opts)
      .then(() => undefined)
      .catch(MainThreadFileSystem._handleError);
  }

  $mkdir(uri: UriComponents): Promise<void> {
    return this._fileService
      .createFolder(URI.revive(uri).toString())
      .then(() => undefined)
      .catch(MainThreadFileSystem._handleError);
  }

  $delete(uri: UriComponents, opts: FileDeleteOptions): Promise<void> {
    return this._fileService
      .delete(URI.revive(uri).toString(), { moveToTrash: opts.useTrash })
      .catch(MainThreadFileSystem._handleError);
  }

  private static _handleError(err: any): never {
    if (err instanceof FileOperationError) {
      switch (err.fileOperationResult) {
        case FileOperationResult.FILE_NOT_FOUND:
          err.name = FileSystemProviderErrorCode.FileNotFound;
          break;
        case FileOperationResult.FILE_IS_DIRECTORY:
          err.name = FileSystemProviderErrorCode.FileIsADirectory;
          break;
        case FileOperationResult.FILE_PERMISSION_DENIED:
          err.name = FileSystemProviderErrorCode.NoPermissions;
          break;
        case FileOperationResult.FILE_MOVE_CONFLICT:
          err.name = FileSystemProviderErrorCode.FileExists;
          break;
      }
    }

    throw err;
  }
}

class RemoteFileSystemProvider implements FileSystemProvider {
  private readonly _onDidChange = new Emitter<FileChange[]>();
  private readonly _registration: IDisposable;

  readonly onDidChangeFile: Event<FileChange[]> = this._onDidChange.event;

  readonly capabilities: FileSystemProviderCapabilities;
  readonly onDidChangeCapabilities: Event<void> = Event.None;

  get readonly() {
    return !!(this.capabilities & FileSystemProviderCapabilities.Readonly);
  }

  constructor(
    fileService: IFileServiceClient,
    scheme: string,
    capabilities: FileSystemProviderCapabilities,
    private readonly _handle: number,
    private readonly _proxy: IExtHostFileSystemShape,
  ) {
    this.capabilities = capabilities;
    this._registration = fileService.registerProvider(scheme, this);
  }

  dispose(): void {
    this._registration.dispose();
    this._onDidChange.dispose();
  }

  watch(resource: Uri, opts: { recursive: boolean; excludes: string[] }) {
    const session = Math.random();
    this._proxy.$watch(this._handle, session, resource, opts);
    return session;
  }
  unwatch(session: number) {
    this._proxy.$unwatch(this._handle, session);
  }

  $onFileSystemChange(changes: FileChange[]): void {
    this._onDidChange.fire(changes.map(RemoteFileSystemProvider._createFileChange));
  }

  private static _createFileChange(dto: FileChange): FileChange {
    return { uri: dto.uri, type: dto.type };
  }

  // --- forwarding calls

  async stat(resource: Uri): Promise<IFileStat> {
    const stat = await this.doGetStat(resource);
    return stat;
  }

  async readFile(resource: Uri): Promise<Uint8Array> {
    const buffer = await this._proxy.$readFile(this._handle, resource);
    return buffer;
  }

  writeFile(resource: Uri, content: Uint8Array, opts: { create: boolean; overwrite: boolean }): Promise<void> {
    return this._proxy.$writeFile(this._handle, resource, content, opts);
  }

  delete(resource: Uri, opts: FileDeleteOptions): Promise<void> {
    return this._proxy.$delete(this._handle, resource, opts);
  }

  createDirectory(resource: Uri): Promise<void> {
    return this._proxy.$mkdir(this._handle, resource);
  }

  readDirectory(resource: Uri): Promise<[string, FileType][]> {
    return this._proxy.$readdir(this._handle, resource);
  }

  rename(resource: Uri, target: Uri, opts: { overwrite: boolean }): Promise<void> {
    return this._proxy.$rename(this._handle, resource, target, opts);
  }

  copy(resource: Uri, target: Uri, opts: { overwrite: boolean }): Promise<void> {
    return this._proxy.$copy(this._handle, resource, target, opts);
  }

  protected async doGetStat(resource: Uri, depth = 1) {
    const stat = await this._proxy.$stat(this._handle, resource);
    const mainStat = fromFileStat(stat, resource);
    if (mainStat.isDirectory) {
      mainStat.children = await this.doGetChildren(resource, depth);
    }
    mainStat.readonly =
      Boolean((stat.permissions ?? 0) & FilePermission.Readonly) ||
      Boolean(this.capabilities & FileSystemProviderCapabilities.Readonly);
    return mainStat;
  }

  protected async doGetChildren(resource: Uri, depth: number) {
    if (depth <= 0) {
      return [];
    }
    const nameTypeTuples = await this.readDirectory(resource);
    // 在我们的设计中stat支持递归获取多层children，默认获取第一层
    const children: IFileStat[] = await Promise.all(
      nameTypeTuples
        .map((item) => new URI(resource).resolve(item[0]))
        .map((childUri) => this.doGetStat(childUri.codeUri, depth - 1)),
    );
    return children;
  }
}
