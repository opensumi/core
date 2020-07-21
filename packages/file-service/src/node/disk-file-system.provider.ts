import * as fs from 'fs-extra';
import * as trash from 'trash';
import * as paths from 'path';
import * as os from 'os';
import * as mv from 'mv';
import { v4 } from 'uuid';
import Uri, { UriComponents } from 'vscode-uri';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import {
  Event,
  IDisposable,
  URI,
  Emitter,
  isUndefined,
  DebugLog,
  DisposableCollection,
} from '@ali/ide-core-common';
import { FileUri, AppConfig } from '@ali/ide-core-node';
import { NsfwFileSystemWatcherServer } from './file-service-watcher';
import {
  FileChangeEvent,
  FileStat,
  FileType,
  DidFilesChangedParams,
  FileSystemError,
  FileMoveOptions,
  isErrnoException,
  notEmpty,
  IDiskFileProvider,
  FileAccess,
} from '../common/';
import { Injectable, Autowired } from '@ali/common-di';
import { RPCService } from '@ali/ide-connection';
import * as fileType from 'file-type';
import { decode, encode } from './encoding';
import { ParsedPattern, parse } from '@ali/ide-core-common/lib/utils/glob';

const debugLog = new DebugLog();

@Injectable({ multiple: true })
export class DiskFileSystemProvider extends RPCService implements IDiskFileProvider {
  private fileChangeEmitter = new Emitter<FileChangeEvent>();
  private watcherServer: NsfwFileSystemWatcherServer;
  readonly onDidChangeFile: Event<FileChangeEvent> = this.fileChangeEmitter.event;
  protected toDispose = new DisposableCollection();

  protected readonly watcherDisposerMap = new Map<number, IDisposable>();
  protected watchFileExcludes: string[] = [];
  protected watchFileExcludesMatcherList: ParsedPattern[] = [];

  @Autowired(AppConfig)
  appConfig: AppConfig;

  constructor() {
    super();
    this.initWatcher();
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  /**
   * @param {Uri} uri
   * @param {{ recursive: boolean; excludes: string[] }} [options]  // 还不支持 recursive 参数
   * @returns {number}
   * @memberof DiskFileSystemProvider
   */
  watch(uri: UriComponents, options?: { recursive: boolean; excludes: string[] }) {
    let watcherId;
    const _uri = Uri.revive(uri);
    const watchPromise = this.watcherServer.watchFileChanges(
      _uri.toString(),
      {
        excludes: options && options.excludes ? options.excludes : [],
      },
    ).then((id) => watcherId = id);
    const disposable = {
      dispose: () => {
        if (!watcherId) {
          return watchPromise.then((id) => {
            this.watcherServer.unwatchFileChanges(id);
          });
        }
        this.watcherServer.unwatchFileChanges(watcherId);
      },
    };
    this.watcherDisposerMap.set(watcherId, disposable);
    return watcherId;
  }

  unwatch(watcherId: number) {
    const disposable = this.watcherDisposerMap.get(watcherId);
    if (!disposable || !disposable.dispose) {
      return;
    }
    disposable.dispose();
  }

  stat(uri: UriComponents): Thenable<FileStat> {
    const _uri = Uri.revive(uri);
    return new Promise(async (resolve) => {
       this.doGetStat(_uri, 1)
        .then((stat) => {
          // console.log(stat, 'provider stat bkend');
          resolve(stat);
        })
        .catch((e) => resolve());
    });
  }

  async readDirectory(uri: UriComponents): Promise<[string, FileType][]> {
    const _uri = Uri.revive(uri);
    const result: [string, FileType][] = [];
    try {
      const dirList = fs.readdirSync(_uri.fsPath);

      dirList.forEach((name) => {
        const filePath = paths.join(_uri.fsPath, name);
        result.push([name, this.getFileStatType(fs.statSync(filePath))]);
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
    await fs.mkdirs(FileUri.fsPath(new URI(_uri)));
    const newStat = await this.doGetStat(_uri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(uri.path, 'Error occurred while creating the directory.');
  }

  async readFile(uri: UriComponents, encoding = 'utf8'): Promise<string> {
    const _uri = Uri.revive(uri);
    if (typeof encoding !== 'string') {
      // cancellation token兼容
      encoding = 'utf8';
    }

    try {
      const buffer = await fs.readFile(FileUri.fsPath(new URI(_uri)));
      return decode(buffer, encoding);
    } catch (error) {
      if (isErrnoException(error)) {
        if (error.code === 'ENOENT') {
          throw FileSystemError.FileNotFound(uri.path, 'Error occurred while reading file');
        }

        if (error.code === 'EISDIR') {
          throw FileSystemError.FileIsDirectory(uri.path, 'Error occurred while reading file: path is a directory.');
        }

        if (error.code === 'EPERM') {
          throw FileSystemError.FileIsNoPermissions(uri.path, 'Error occurred while reading file: path is a directory.');
        }
      }

      throw error;
    }
  }

  async writeFile(
    uri: UriComponents,
    content: string,
    options: { create: boolean, overwrite: boolean, encoding?: string },
  ): Promise<void | FileStat> {
    const _uri = Uri.revive(uri);
    const exists = await this.access(uri);

    if (exists && !options.overwrite) {
      throw FileSystemError.FileExists(_uri.toString());
    } else if (!exists && !options.create) {
      throw FileSystemError.FileNotFound(_uri.toString());
    }
    const buffer = encode(content, options.encoding || 'utf8');

    if (options.create) {
      return await this.createFile(uri, { content: buffer });
    }

    try {
      await writeFileAtomicSync(FileUri.fsPath(new URI(_uri)), buffer);
    } catch (e) {
      debugLog.warn('writeFileAtomicSync 出错，使用 fs', e);
      fs.writeFileSync(FileUri.fsPath(new URI(_uri)), buffer);
    }
  }

  access(uri: UriComponents, mode: number = FileAccess.Constants.F_OK): Promise<boolean> {
    return fs.access(FileUri.fsPath(URI.from(uri)), mode).then(() => true).catch(() => false);
  }

  async delete(uri: UriComponents, options: { recursive?: boolean, moveToTrash?: boolean }): Promise<void> {
    const _uri = Uri.revive(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (!stat) {
      throw FileSystemError.FileNotFound(uri.path);
    }
    if (!isUndefined(options.recursive)) {
      debugLog.warn(`DiskFileSystemProvider not support options.recursive!`);
    }
    // Windows 10.
    // Deleting an empty directory throws `EPERM error` instead of `unlinkDir`.
    // https://github.com/paulmillr/chokidar/issues/566
    // Force moveToTrash
    const moveToTrash = !!options.moveToTrash;
    if (moveToTrash) {
      return trash([FileUri.fsPath(new URI(_uri))]);
    } else {
      const filePath = FileUri.fsPath(new URI(_uri));
      const outputRootPath = paths.join(os.tmpdir(), v4());
      try {
        await new Promise<void>((resolve, reject) => {
          fs.rename(filePath, outputRootPath, async (error) => {
            if (error) {
              return reject(error);
            }
            resolve();
          });
        });
        // There is no reason for the promise returned by this function not to resolve
        // as soon as the move is complete.  Clearing up the temporary files can be
        // done in the background.
        fs.remove(FileUri.fsPath(outputRootPath));
      } catch (error) {
        return fs.remove(filePath);
      }
    }
  }

  async rename(
    sourceUri: UriComponents,
    targetUri: UriComponents,
    options: { overwrite: boolean },
  ): Promise<FileStat> {
    // const _sourceUri = new URI(sourceUri);
    // const _targetUri = new URI(targetUri);
    // if (this.client) {
    //   this.client.onWillMove(sourceUri, targetUri);
    // }
    const result = await this.doMove(sourceUri, targetUri, options);
    // if (this.client) {
    //   this.client.onDidMove(sourceUri, targetUri);
    // }
    return result;
  }

  async copy(
    sourceUri: UriComponents,
    targetUri: UriComponents,
    options: { overwrite: boolean, recursive?: boolean },
  ): Promise<FileStat> {
    const _sourceUri = Uri.revive(sourceUri);
    const _targetUri = Uri.revive(targetUri);
    const [sourceStat, targetStat] = await Promise.all([
      this.doGetStat(_sourceUri, 0),
      this.doGetStat(_targetUri, 0),
    ]);
    const { overwrite, recursive } = options;

    if (!sourceStat) {
      throw FileSystemError.FileNotFound(sourceUri.path);
    }
    if (targetStat && !overwrite) {
      throw FileSystemError.FileExists(targetUri.path, "Did you set the 'overwrite' flag to true?");
    }
    if (targetStat && targetStat.uri === sourceStat.uri) {
      throw FileSystemError.FileExists(targetUri.path, 'Cannot perform copy, source and destination are the same.');
    }
    await fs.copy(FileUri.fsPath(_sourceUri.toString()), FileUri.fsPath(_targetUri.toString()), { overwrite, recursive });
    const newStat = await this.doGetStat(_targetUri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(targetUri.path, `Error occurred while copying ${sourceUri} to ${targetUri}.`);
  }

  async getCurrentUserHome(): Promise<FileStat | undefined> {
    return this.stat(FileUri.create(os.homedir()).codeUri);
  }

  // 出于通信成本的考虑，排除文件的逻辑必须放在node层（fs provider层，不同的fs实现的exclude应该不一样）
  setWatchFileExcludes(excludes: string[]) {
    debugLog.info('set watch file exclude:', excludes);
    this.watchFileExcludes = excludes;
    this.watchFileExcludesMatcherList = excludes.map((pattern) => parse(pattern));
  }

  getWatchFileExcludes() {
    return this.watchFileExcludes;
  }

  protected initWatcher() {
    this.watcherServer = new NsfwFileSystemWatcherServer({
      verbose: true,
      useExperimentalEfsw: this.appConfig.useExperimentalEfsw,
    });
    this.watcherServer.setClient({
      onDidFilesChanged: (events: DidFilesChangedParams) => {
        const filteredChange = events.changes.filter((file) => {
          const uri = new URI(file.uri);
          const uriString = uri.withoutScheme().toString();
          return !this.watchFileExcludesMatcherList.some((match) => match(uriString));
        });
        this.fileChangeEmitter.fire(filteredChange);
        if (this.rpcClient) {
          // 一个后端实例不是应该只对应一个client吗
          this.rpcClient.forEach((client) => {
            client.onDidFilesChanged({
              changes: filteredChange,
            });
          });
        }
      },
    });
    this.toDispose.push({
      dispose: () => {
        this.watcherServer.dispose();
      },
    });
  }

  // Protected or private

  protected async createFile(uri: UriComponents, options: { content: Buffer }): Promise<FileStat> {
    const _uri = Uri.revive(uri);
    const parentUri = new URI(_uri).parent;
    const parentStat = await this.doGetStat(parentUri.codeUri, 0);
    if (!parentStat) {
      await fs.mkdirs(FileUri.fsPath(parentUri));
    }
    await fs.writeFile(FileUri.fsPath(_uri.toString()), options.content);
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

  protected async doMove(sourceUri: UriComponents, targetUri: UriComponents, options: FileMoveOptions): Promise<FileStat> {
    const _sourceUri = Uri.revive(sourceUri);
    const _targetUri = Uri.revive(targetUri);
    const [sourceStat, targetStat] = await Promise.all([
      this.doGetStat(_sourceUri, 1),
      this.doGetStat(_targetUri, 1),
    ]);
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
        throw FileSystemError.FileIsDirectory(targetStat.uri, `Cannot move '${sourceStat.uri}' file to an existing location.`);
      }
      throw FileSystemError.FileNotDirectory(targetStat.uri, `Cannot move '${sourceStat.uri}' directory to an existing location.`);
    }
    const [sourceMightHaveChildren, targetMightHaveChildren] = await Promise.all([this.mayHaveChildren(_sourceUri), this.mayHaveChildren(_targetUri)]);
    // Handling special Windows case when source and target resources are empty folders.
    // Source should be deleted and target should be touched.
    if (overwrite && targetStat && targetStat.isDirectory && sourceStat.isDirectory && !sourceMightHaveChildren && !targetMightHaveChildren) {
      // The value should be a Unix timestamp in seconds.
      // For example, `Date.now()` returns milliseconds, so it should be divided by `1000` before passing it in.
      const now = Date.now() / 1000;
      await fs.utimes(FileUri.fsPath(_targetUri.toString()), now, now);
      await fs.rmdir(FileUri.fsPath(_sourceUri.toString()));
      const newStat = await this.doGetStat(_targetUri, 1);
      if (newStat) {
        return newStat;
      }
      throw FileSystemError.FileNotFound(targetUri.path, `Error occurred when moving resource from '${sourceUri}' to '${targetUri}'.`);
    } else if (overwrite && targetStat && targetStat.isDirectory && sourceStat.isDirectory && !targetMightHaveChildren && sourceMightHaveChildren) {
      // Copy source to target, since target is empty. Then wipe the source content.
      const newStat = await this.copy(sourceUri, targetUri, { overwrite });
      await this.delete(sourceUri, { moveToTrash: false });
      return newStat;
    } else {
      return new Promise<FileStat>((resolve, reject) => {
        mv(FileUri.fsPath(_sourceUri.toString()), FileUri.fsPath(_targetUri.toString()), { mkdirp: true, clobber: overwrite }, async (error: any) => {
          if (error) {
            return reject(error);
          }
          resolve(await this.doGetStat(_targetUri, 1));
        });
      });
    }
  }

  protected async doGetStat(uri: Uri, depth: number): Promise<FileStat | undefined> {
    try {
      const filePath = uri.fsPath;
      const lstat = await fs.lstat(filePath);

      if (lstat.isSymbolicLink()) {
        let realPath;
        try {
          realPath = await fs.realpath(FileUri.fsPath(new URI(uri)));
        } catch (e) {
          return undefined;
        }
        const stat = await fs.stat(filePath);
        const realURI = FileUri.create(realPath);
        const realStat = await fs.lstat(realPath);

        let realStatData;
        if (stat.isDirectory()) {
          realStatData = await this.doCreateDirectoryStat(realURI.codeUri, realStat, depth);
        } else {
          realStatData = await this.doCreateFileStat(realURI.codeUri, realStat);
        }

        return {
          ...realStatData,
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
      if (isErrnoException(error)) {
        if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'EPERM') {
          return undefined;
        }
      }
      throw error;
    }
  }

  protected async doCreateFileStat(uri: Uri, stat: fs.Stats): Promise<FileStat> {
    // Then stat the target and return that
    // const isLink = !!(stat && stat.isSymbolicLink());
    // if (isLink) {
    //   stat = await fs.stat(FileUri.fsPath(uri));
    // }

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

  protected getFileStatType(stat: fs.Stats) {
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

  protected async doCreateDirectoryStat(uri: Uri, stat: fs.Stats, depth: number): Promise<FileStat> {
    const children = depth > 0 ? await this.doGetChildren(uri, depth) : [];
    return {
      uri: uri.toString(),
      lastModification: stat.mtime.getTime(),
      createTime: stat.ctime.getTime(),
      isDirectory: true,
      isSymbolicLink: stat.isSymbolicLink(),
      children,
    };
  }

  protected async doGetChildren(uri: Uri, depth: number): Promise<FileStat[]> {
    const _uri = new URI(uri);
    const files = await fs.readdir(FileUri.fsPath(_uri));
    const children = await Promise.all(files.map((fileName) => _uri.resolve(fileName)).map((childUri) => this.doGetStat(childUri.codeUri, depth - 1)));
    return children.filter(notEmpty);
  }

  async getFileType(uri: string): Promise<string | undefined> {
    try {
      // 兼容性处理，本质 disk-file 不支持非 file 协议的文件头嗅探
      if (!uri.startsWith('file:/')) {
        return this._getFileType('');
      }
      // const lstat = await fs.lstat(FileUri.fsPath(uri));
      const stat = await fs.stat(FileUri.fsPath(uri));

      let ext: string = '';
      if (!stat.isDirectory()) {

        // if(lstat.isSymbolicLink){

        // }else {
        if (stat.size) {
          const type = await fileType.stream(fs.createReadStream(FileUri.fsPath(uri)));
          // 可以拿到 type.fileType 说明为二进制文件
          if (type.fileType) {
            ext = type.fileType.ext;
          }
        }
        return this._getFileType(ext);
        // }
      } else {
        return 'directory';
      }
    } catch (error) {
      if (isErrnoException(error)) {
        if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'EPERM') {
          return undefined;
        }
      }
    }
  }

  private _getFileType(ext) {
    let type = 'text';

    if (['png', 'gif', 'jpg', 'jpeg', 'svg'].indexOf(ext) !== -1) {
      type = 'image';
    } else if (ext && ['xml'].indexOf(ext) === -1) {
      type = 'binary';
    }

    return type;
  }
}

export class DiskFileSystemProviderWithoutWatcher extends DiskFileSystemProvider {
  initWatcher() {
    // Do nothing
  }
}
