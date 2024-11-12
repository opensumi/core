import os from 'os';
import paths from 'path';
import { Readable } from 'stream';

import * as fse from 'fs-extra';
import trash from 'trash';
import writeFileAtomic from 'write-file-atomic';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Optional } from '@opensumi/di';
import { RPCService } from '@opensumi/ide-connection';
import {
  Deferred,
  DisposableCollection,
  Emitter,
  Event,
  FileUri,
  IDisposable,
  IFileStatOptions,
  ILogService,
  ILogServiceManager,
  IReadFileStreamOptions,
  SupportLogNamespace,
  URI,
  Uri,
  UriComponents,
  isLinux,
  isUndefined,
  path,
  uuid,
} from '@opensumi/ide-core-node';

import {
  DidFilesChangedParams,
  FileAccess,
  FileChangeEvent,
  FileMoveOptions,
  FileStat,
  FileSystemError,
  FileSystemProviderCapabilities,
  FileType,
  IDiskFileProvider,
  handleError,
  isErrnoException,
  notEmpty,
} from '../common/';

import { FileSystemWatcherServer } from './recursive/file-service-watcher';
import { getFileType } from './shared/file-type';
import { UnRecursiveFileSystemWatcher } from './un-recursive/file-service-watcher';

const { Path } = path;
const UNSUPPORTED_NODE_MODULES_EXCLUDE = '**/node_modules/*/**';
const DEFAULT_NODE_MODULES_EXCLUDE = '**/node_modules/**';

export interface IRPCDiskFileSystemProvider {
  onDidFilesChanged(event: DidFilesChangedParams): void;
}

export interface IWatcher {
  id: number;
  options?: {
    excludes?: string[];
  };
  disposable: IDisposable;
}

@Injectable({ multiple: true })
export class DiskFileSystemProvider extends RPCService<IRPCDiskFileSystemProvider> implements IDiskFileProvider {
  private fileChangeEmitter = new Emitter<FileChangeEvent>();

  private watcherServer: UnRecursiveFileSystemWatcher | FileSystemWatcherServer;

  readonly onDidChangeFile: Event<FileChangeEvent> = this.fileChangeEmitter.event;
  protected watcherServerDisposeCollection: DisposableCollection;

  protected readonly watcherCollection = new Map<string, IWatcher>();
  protected watchFileExcludes: string[] = [];

  private _whenReadyDeferred: Deferred<void> = new Deferred();
  private isInitialized = false;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ILogServiceManager)
  private readonly loggerManager: ILogServiceManager;

  private logger: ILogService;

  private ignoreNextChangesEvent: Set<string> = new Set();

  private recursive: boolean;

  constructor(@Optional() recursive = true) {
    super();
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
    this.recursive = recursive;
    this.initWatchServer();
  }

  get whenReady() {
    return this._whenReadyDeferred.promise;
  }

  onDidChangeCapabilities: Event<void> = Event.None;

  protected _capabilities: FileSystemProviderCapabilities | undefined;
  get capabilities(): FileSystemProviderCapabilities {
    if (!this._capabilities) {
      this._capabilities =
        FileSystemProviderCapabilities.FileReadWrite |
        FileSystemProviderCapabilities.FileOpenReadWriteClose |
        FileSystemProviderCapabilities.FileReadStream |
        FileSystemProviderCapabilities.FileFolderCopy |
        FileSystemProviderCapabilities.FileWriteUnlock;

      if (isLinux) {
        this._capabilities |= FileSystemProviderCapabilities.PathCaseSensitive;
      }
    }

    return this._capabilities;
  }

  dispose(): void {
    this.watcherServerDisposeCollection?.dispose();
  }

  /**
   * @param {Uri} uri
   * @param {{ excludes: string[] }}
   * @memberof DiskFileSystemProvider
   */
  async watch(uri: UriComponents, options?: { excludes?: string[] }): Promise<number> {
    await this.whenReady;
    const _uri = Uri.revive(uri);
    const id = await this.watcherServer.watchFileChanges(_uri.toString(), {
      excludes: options?.excludes ?? [],
    });
    const disposable = {
      dispose: () => {
        this.watcherServer.unwatchFileChanges(id);
      },
    };
    this.watcherCollection.set(_uri.toString(), { id, options, disposable });
    return id;
  }

  unwatch(watcherId: number) {
    for (const [_uri, { id, disposable }] of this.watcherCollection) {
      if (watcherId === id) {
        disposable.dispose();
      }
    }
  }

  async stat(uri: UriComponents, options?: IFileStatOptions): Promise<FileStat> {
    const _uri = Uri.revive(uri);
    try {
      const stat = await this.doGetStat(_uri, 1, options);
      if (stat) {
        return stat;
      }
      throw FileSystemError.Unavailable(uri.path, 'Error occurred while getting the file stat.');
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  async readDirectory(uri: UriComponents): Promise<[string, FileType][]> {
    const _uri = Uri.revive(uri);
    const result: [string, FileType][] = [];
    try {
      const dirList = await fse.readdir(_uri.fsPath);

      dirList.forEach((name) => {
        const filePath = paths.join(_uri.fsPath, name);
        // eslint-disable-next-line import/namespace
        result.push([name, this.getFileStatType(fse.statSync(filePath))]);
      });
      return result;
    } catch (e) {
      return result;
    }
  }

  async createDirectory(uri: UriComponents): Promise<FileStat> {
    const _uri = Uri.revive(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (stat) {
      if (stat.isDirectory) {
        return stat;
      }
      throw FileSystemError.FileExists(uri.path, 'Error occurred while creating the directory: path is a file.');
    }
    await fse.ensureDir(FileUri.fsPath(new URI(_uri)));
    const newStat = await this.doGetStat(_uri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.Unavailable(uri.path, 'Error occurred while creating the directory.');
  }

  async readFile(uri: UriComponents, encoding = 'utf8'): Promise<Uint8Array> {
    const _uri = Uri.revive(uri);

    try {
      const buffer = await fse.readFile(FileUri.fsPath(new URI(_uri)));
      return buffer;
    } catch (error) {
      this.handleReadFileError(error, uri);
    }
  }

  async readFileStream(uri: UriComponents, opts: IReadFileStreamOptions): Promise<Readable> {
    const _uri = Uri.revive(uri);
    try {
      return fse.createReadStream(FileUri.fsPath(new URI(_uri)));
    } catch (error) {
      this.handleReadFileError(error, uri);
    }
  }

  protected handleReadFileError(error: Error, uri: UriComponents): never {
    if (isErrnoException(error)) {
      if (error.code === 'ENOENT') {
        throw FileSystemError.FileNotFound(uri.path, 'Error occurred while reading file');
      }

      if (error.code === 'EISDIR') {
        throw FileSystemError.FileIsADirectory(uri.path, 'Error occurred while reading file: path is a directory.');
      }

      if (error.code === 'EPERM') {
        throw FileSystemError.FileIsNoPermissions(uri.path, 'Error occurred while reading file: path is a directory.');
      }
    }

    throw error;
  }

  async writeFile(
    uri: UriComponents,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean; encoding?: string },
  ): Promise<void | FileStat> {
    const _uri = Uri.revive(uri);
    const exists = await this.access(uri);

    if (exists && !options.overwrite) {
      throw FileSystemError.FileExists(_uri.toString());
    } else if (!exists && !options.create) {
      throw FileSystemError.FileNotFound(_uri.toString());
    }
    // fileServiceNode调用不会转换，前传通信会转换
    const buffer = content instanceof Buffer ? content : Buffer.from(Uint8Array.from(content));
    if (options.create) {
      return await this.createFile(uri, { content: buffer });
    }

    try {
      this.ignoreNextChangesEvent.add(_uri.toString());
      await writeFileAtomic(FileUri.fsPath(new URI(_uri)), buffer);
    } catch (e) {
      await fse.writeFile(FileUri.fsPath(new URI(_uri)), buffer);
      this.logger.warn('Error using writeFileAtomicSync, using fs instead.', e);
    } finally {
      this.ignoreNextChangesEvent.delete(_uri.toString());
    }
  }

  async access(uri: UriComponents, mode: number = FileAccess.Constants.F_OK): Promise<boolean> {
    try {
      await fse.access(FileUri.fsPath(URI.from(uri)), mode);
      return true;
    } catch {
      return false;
    }
  }

  async delete(uri: UriComponents, options: { recursive?: boolean; moveToTrash?: boolean }): Promise<void> {
    const _uri = Uri.revive(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (!stat) {
      throw FileSystemError.FileNotFound(uri.path);
    }
    if (!isUndefined(options.recursive)) {
      this.logger.warn('DiskFileSystemProvider not support options.recursive!');
    }

    if (options.moveToTrash) {
      return trash([FileUri.fsPath(new URI(_uri))]);
    } else {
      const filePath = FileUri.fsPath(new URI(_uri));
      const outputRootPath = paths.join(os.tmpdir(), uuid());
      try {
        await fse.rename(filePath, outputRootPath);
        // There is no reason for the promise returned by this function not to resolve
        // as soon as the move is complete.  Clearing up the temporary files can be
        // done in the background.
        fse.remove(FileUri.fsPath(outputRootPath));
      } catch (error) {
        return fse.remove(filePath);
      }
    }
  }

  async rename(sourceUri: UriComponents, targetUri: UriComponents, options: { overwrite: boolean }): Promise<FileStat> {
    const result = await this.doMove(sourceUri, targetUri, options);
    return result;
  }

  async copy(sourceUri: UriComponents, targetUri: UriComponents, options: { overwrite: boolean }): Promise<FileStat> {
    const _sourceUri = Uri.revive(sourceUri);
    const _targetUri = Uri.revive(targetUri);
    const [sourceStat, targetStat] = await Promise.all([this.doGetStat(_sourceUri, 0), this.doGetStat(_targetUri, 0)]);
    const { overwrite } = options;

    if (!sourceStat) {
      throw FileSystemError.FileNotFound(sourceUri.path);
    }

    if (targetStat) {
      if (!overwrite) {
        throw FileSystemError.FileExists(targetUri.path, "Did you set the 'overwrite' flag to true?");
      }

      await this.validateMoveCopy(_sourceUri, _targetUri);
    }

    await fse.copy(FileUri.fsPath(_sourceUri.toString()), FileUri.fsPath(_targetUri.toString()), {
      overwrite,
    });
    const newStat = await this.doGetStat(_targetUri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(targetUri.path, `Error occurred while copying ${sourceUri} to ${targetUri}.`);
  }

  private async validateMoveCopy(sourceUri: Uri, targetUri: Uri) {
    if (sourceUri.toString() === targetUri.toString()) {
      throw FileSystemError.FileExists(targetUri.path, 'Cannot perform copy, source and destination are the same.');
    }

    if (await this.access(targetUri)) {
      // Special case: if the target is a parent of the source, we cannot delete
      // it as it would delete the source as well. In this case we have to throw
      if (FileUri.isEqualOrParent(targetUri, sourceUri)) {
        throw FileSystemError.FileExists(targetUri.path, 'Cannot perform copy, source is a parent of the destination.');
      }
    }
  }

  async getCurrentUserHome(): Promise<FileStat | undefined> {
    return this.stat(FileUri.create(os.homedir()).codeUri);
  }

  // 出于通信成本的考虑，排除文件的逻辑必须放在node层（fs provider层，不同的fs实现的exclude应该不一样）
  setWatchFileExcludes(excludes: string[]) {
    let watchExcludes = excludes;
    if (excludes.includes(UNSUPPORTED_NODE_MODULES_EXCLUDE)) {
      const idx = watchExcludes.findIndex((v) => v === UNSUPPORTED_NODE_MODULES_EXCLUDE);
      watchExcludes = watchExcludes.splice(idx, 1, DEFAULT_NODE_MODULES_EXCLUDE);
    }
    // 每次调用之后都需要重新初始化 WatcherServer，保证最新的规则生效
    this.logger.log('Set watcher exclude:', watchExcludes);
    this.watchFileExcludes = watchExcludes;
    this.initWatchServer(this.watchFileExcludes);
  }

  getWatchFileExcludes() {
    return this.watchFileExcludes;
  }

  getWatchExcludes(excludes?: string[]): string[] {
    return Array.from(new Set(this.watchFileExcludes.concat(excludes || [])));
  }

  protected initWatchServer(excludes?: string[]) {
    if (!this.injector) {
      return;
    }
    if (this.watcherServerDisposeCollection) {
      this.watcherServerDisposeCollection.dispose();
    }
    this.watcherServerDisposeCollection = new DisposableCollection();
    if (this.recursive) {
      this.watcherServer = this.injector.get(FileSystemWatcherServer, [excludes]);
    } else {
      this.watcherServer = this.injector.get(UnRecursiveFileSystemWatcher, [excludes]);
    }
    this.watcherServer.setClient({
      onDidFilesChanged: (events: DidFilesChangedParams) => {
        if (events.changes.length > 0) {
          const changes = events.changes.filter((c) => !this.ignoreNextChangesEvent.has(c.uri));
          this.fileChangeEmitter.fire(changes);
          if (Array.isArray(this.rpcClient)) {
            this.rpcClient.forEach((client) => {
              client.onDidFilesChanged({
                changes,
              });
            });
          }
        }
      },
    });
    this.watcherServerDisposeCollection.push({
      dispose: () => {
        this.watcherServer.dispose();
      },
    });
    if (this.isInitialized) {
      // 当服务已经初始化一次后，重新初始化时需要重新绑定原有的监听服务
      this.rewatch();
    } else {
      this._whenReadyDeferred.resolve();
    }
    this.isInitialized = true;
  }

  private async rewatch() {
    let tasks: {
      id: number;
      uri: string;
      options?: { excludes?: string[] };
    }[] = [];
    for (const [uri, { id, options }] of this.watcherCollection) {
      tasks.push({
        id,
        uri,
        options,
      });
    }
    // 需要针对缓存根据路径深度排序，防止过度监听
    tasks = tasks.sort((a, b) => Path.pathDepth(a.uri) - Path.pathDepth(b.uri));
    for (const { uri, options } of tasks) {
      await this.watch(Uri.parse(uri), { excludes: this.getWatchExcludes(options?.excludes) });
    }
  }

  protected async createFile(uri: UriComponents, options: { content: Buffer }): Promise<FileStat> {
    const _uri = Uri.revive(uri);
    const parentUri = new URI(_uri).parent;
    const parentStat = await this.doGetStat(parentUri.codeUri, 0);
    if (!parentStat) {
      await fse.ensureDir(FileUri.fsPath(parentUri));
    }
    await fse.writeFile(FileUri.fsPath(_uri.toString()), options.content);
    const newStat = await this.doGetStat(_uri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(uri.path, 'Error occurred while creating the file.');
  }

  /**
   * Return `true` if it's possible for this URI to have children.
   * It might not be possible to be certain because of permission problems or other filesystem errors.
   */
  protected async mayHaveChildren(uri: Uri): Promise<boolean> {
    /* If there's a problem reading the root directory. Assume it's not empty to avoid overwriting anything.  */
    try {
      const rootStat = await this.doGetStat(uri, 0);
      if (rootStat === undefined) {
        return true;
      }
      /* Not a directory.  */
      if (rootStat !== undefined && rootStat.isDirectory === false) {
        return false;
      }
    } catch (error) {
      return true;
    }

    /* If there's a problem with it's children then the directory must not be empty.  */
    try {
      const stat = await this.doGetStat(uri, 1);
      if (stat !== undefined && stat.children !== undefined) {
        return stat.children.length > 0;
      } else {
        return true;
      }
    } catch (error) {
      return true;
    }
  }

  protected async doMove(
    sourceUri: UriComponents,
    targetUri: UriComponents,
    options: FileMoveOptions,
  ): Promise<FileStat> {
    const _sourceUri = Uri.revive(sourceUri);
    const _targetUri = Uri.revive(targetUri);
    const [sourceStat, targetStat] = await Promise.all([this.doGetStat(_sourceUri, 1), this.doGetStat(_targetUri, 1)]);
    const isCapitalizedEqual = _sourceUri.toString().toLocaleUpperCase() === _targetUri.toString().toLocaleUpperCase();
    const { overwrite } = options;
    if (!sourceStat) {
      throw FileSystemError.FileNotFound(sourceUri.path);
    }
    if (targetStat && !overwrite) {
      throw FileSystemError.FileExists(targetUri.path, "Did you set the 'overwrite' flag to true?");
    }

    // Different types. Files <-> Directory.
    if (targetStat && sourceStat.isDirectory !== targetStat.isDirectory) {
      if (targetStat.isDirectory) {
        throw FileSystemError.FileIsADirectory(
          targetStat.uri,
          `Cannot move '${sourceStat.uri}' file to an existing location.`,
        );
      }
      throw FileSystemError.FileNotADirectory(
        targetStat.uri,
        `Cannot move '${sourceStat.uri}' directory to an existing location.`,
      );
    }
    const [sourceMightHaveChildren, targetMightHaveChildren] = await Promise.all([
      this.mayHaveChildren(_sourceUri),
      this.mayHaveChildren(_targetUri),
    ]);
    // Handling special Windows case when source and target resources are empty folders.
    // Source should be deleted and target should be touched.
    if (
      !isCapitalizedEqual &&
      overwrite &&
      targetStat &&
      targetStat.isDirectory &&
      sourceStat.isDirectory &&
      !sourceMightHaveChildren &&
      !targetMightHaveChildren
    ) {
      // 当移动路径跟目标路径均存在文件，同时排除大写路径不等时才进入该逻辑
      // 核心解决在 Mac 等默认大小写不敏感系统中的文件移动问题
      // The value should be a Unix timestamp in seconds.
      // For example, `Date.now()` returns milliseconds, so it should be divided by `1000` before passing it in.
      const now = Date.now() / 1000;
      await fse.utimes(FileUri.fsPath(_targetUri.toString()), now, now);
      await fse.rmdir(FileUri.fsPath(_sourceUri.toString()));
      const newStat = await this.doGetStat(_targetUri, 1);
      if (newStat) {
        return newStat;
      }
      throw FileSystemError.FileNotFound(
        targetUri.path,
        `Error occurred when moving resource from '${sourceUri.toString()}' to '${targetUri.toString()}'.`,
      );
    } else if (
      overwrite &&
      targetStat &&
      targetStat.isDirectory &&
      sourceStat.isDirectory &&
      !targetMightHaveChildren &&
      sourceMightHaveChildren
    ) {
      // Copy source to target, since target is empty. Then wipe the source content.
      const newStat = await this.copy(sourceUri, targetUri, { overwrite });
      await this.delete(sourceUri, { moveToTrash: false });
      return newStat;
    } else {
      await this.validateMoveCopy(_sourceUri, _targetUri);

      await fse.move(FileUri.fsPath(_sourceUri.toString()), FileUri.fsPath(_targetUri.toString()), { overwrite });
      const stat = await this.doGetStat(_targetUri, 1, {
        throwError: true,
      });

      if (stat) {
        return stat;
      } else {
        // never reached
        throw FileSystemError.FileNotFound(
          targetUri.path,
          `Error occurred when moving resource from '${sourceUri.toString()}' to '${targetUri.toString()}'.`,
        );
      }
    }
  }

  protected async doGetStat(uri: Uri, depth: number, options?: IFileStatOptions): Promise<FileStat | undefined> {
    try {
      const filePath = uri.fsPath;
      const lstat = await fse.lstat(filePath);

      if (lstat.isSymbolicLink()) {
        let realPath: string;
        try {
          realPath = await fse.realpath(FileUri.fsPath(new URI(uri)));
        } catch (e) {
          this.logger.warn('Cannot resolve symbolic link', uri.toString(), e);
          return undefined;
        }
        const stat = await fse.stat(filePath);
        const realURI = FileUri.create(realPath);
        const realStat = await fse.lstat(realPath);

        let realStatData: FileStat;
        if (stat.isDirectory()) {
          realStatData = await this.doCreateDirectoryStat(realURI.codeUri, realStat, depth);
        } else {
          realStatData = await this.doCreateFileStat(realURI.codeUri, realStat);
        }

        return {
          ...realStatData,
          realUri: realStatData.uri,
          type: FileType.SymbolicLink,
          isSymbolicLink: true,
          uri: uri.toString(),
        };
      } else {
        if (lstat.isDirectory()) {
          return await this.doCreateDirectoryStat(uri, lstat, depth);
        }
        const fileStat = await this.doCreateFileStat(uri, lstat);

        return fileStat;
      }
    } catch (error) {
      this.logger.error('Error occurred when getting file stat', uri, error);
      if (options?.throwError) {
        handleError(error);
      }

      if (isErrnoException(error)) {
        if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'EPERM') {
          return undefined;
        }
      }
      throw error;
    }
  }

  protected async doCreateFileStat(uri: Uri, stat: fse.Stats): Promise<FileStat> {
    return {
      uri: uri.toString(),
      lastModification: stat.mtime.getTime(),
      createTime: stat.ctime.getTime(),
      isSymbolicLink: stat.isSymbolicLink(),
      isDirectory: stat.isDirectory(),
      size: stat.size,
      type: this.getFileStatType(stat),
    };
  }

  protected getFileStatType(stat: fse.Stats) {
    if (stat.isDirectory()) {
      return FileType.Directory;
    }
    if (stat.isFile()) {
      return FileType.File;
    }
    if (stat.isSymbolicLink()) {
      return FileType.SymbolicLink;
    }
    return FileType.Unknown;
  }

  protected async doCreateDirectoryStat(uri: Uri, stat: fse.Stats, depth: number): Promise<FileStat> {
    const children = depth > 0 ? await this.doGetChildren(uri, depth) : [];
    return {
      uri: uri.toString(),
      lastModification: stat.mtime.getTime(),
      createTime: stat.ctime.getTime(),
      isDirectory: true,
      isSymbolicLink: stat.isSymbolicLink(),
      children,
      type: FileType.Directory,
    };
  }

  protected async doGetChildren(uri: Uri, depth: number): Promise<FileStat[]> {
    const _uri = new URI(uri);
    const files = await fse.readdir(FileUri.fsPath(_uri));
    const children = await Promise.all(
      files.map((fileName) => _uri.resolve(fileName)).map((childUri) => this.doGetStat(childUri.codeUri, depth - 1)),
    );
    return children.filter(notEmpty);
  }

  async getFileType(uri: string): Promise<string | undefined> {
    return await getFileType(uri);
  }
}
