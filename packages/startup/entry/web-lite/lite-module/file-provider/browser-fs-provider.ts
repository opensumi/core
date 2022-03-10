import * as fs from 'fs';
import * as paths from 'path';

import {
  Event,
  URI,
  FileUri,
  Uri,
  Emitter,
  FileChangeType,
  FileSystemProviderCapabilities,
} from '@opensumi/ide-core-common';
import { ensureDir } from '@opensumi/ide-core-common/lib/browser-fs/ensure-dir';
import { promisify } from '@opensumi/ide-core-common/lib/browser-fs/util';
import { Path } from '@opensumi/ide-core-common/lib/path';
import { BinaryBuffer } from '@opensumi/ide-core-common/lib/utils/buffer';
import {
  IDiskFileProvider,
  FileChangeEvent,
  FileStat,
  FileType,
  FileSystemError,
  notEmpty,
  isErrnoException,
} from '@opensumi/ide-file-service/lib/common';

import { HttpTreeList } from './http-file.service';

interface BrowserFsProviderOptions {
  isReadonly?: boolean;
  rootFolder: string;
}

export const BROWSER_HOME_DIR = FileUri.create('/home');

// 预览模式下，文件改动仅同步到本地；常规场景直接同步远端，本地不做文件存储
// 利用storage来记录文件已加载的信息，dispose时记得清楚
export class BrowserFsProvider implements IDiskFileProvider {
  static H5VideoExtList = ['mp4', 'ogg', 'webm'];

  static binaryExtList = [
    'aac',
    'avi',
    'bmp',
    'flv',
    'm1v',
    'm2a',
    'm2v',
    'm3a',
    'mid',
    'midi',
    'mk3d',
    'mks',
    'mkv',
    'mov',
    'movie',
    'mp2',
    'mp2a',
    'mp3',
    'mp4a',
    'mp4v',
    'mpe',
    'mpeg',
    'mpg',
    'mpg4',
    'mpga',
    'oga',
    'ogv',
    'psd',
    'qt',
    'spx',
    'tga',
    'tif',
    'tiff',
    'wav',
    'webp',
    'wma',
    'wmv',
    'woff',
  ];

  protected readonly onDidChangeFileEmitter = new Emitter<FileChangeEvent>();
  onDidChangeFile: Event<FileChangeEvent> = this.onDidChangeFileEmitter.event;

  constructor(private httpFileService: AbstractHttpFileService, private options: BrowserFsProviderOptions) {}

  capabilities: FileSystemProviderCapabilities = 2048;
  onDidChangeCapabilities: Event<void> = new Emitter<void>().event;

  readonly?: boolean | undefined;

  watch(uri: Uri, options: { recursive: boolean; excludes: string[] }): number {
    // TODO: shall we implement this method?
    return 0;
  }
  unwatch(watcherId: number): void {}
  setWatchFileExcludes(excludes: string[]) {}
  getWatchFileExcludes(): string[] {
    return [];
  }

  async stat(uri: Uri): Promise<FileStat> {
    const _uri = new URI(uri);
    return new Promise(async (resolve) => {
      this.doGetStat(_uri, 1)
        .then((stat) => resolve(stat!))
        .catch((e) => {
          // @ts-ignore
          resolve();
        });
    });
  }
  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    const result: [string, FileType][] = [];
    try {
      const dirList = await promisify(fs.readdir)(uri.fsPath);

      for (const name of dirList as string[]) {
        const filePath = paths.join(uri.fsPath, name);
        result.push([name, this.getFileStatType(await promisify(fs.stat)(filePath))]);
      }
      return result;
    } catch (e) {
      return result;
    }
  }
  async createDirectory(uri: Uri): Promise<FileStat> {
    const _uri = new URI(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (stat) {
      if (stat.isDirectory) {
        return stat;
      }
      throw FileSystemError.FileExists(uri.path, 'Error occurred while creating the directory: path is a file.');
    }
    try {
      await promisify(fs.mkdir)(FileUri.fsPath(_uri));
      return this.doGetStat(_uri, 0) as Promise<FileStat>;
    } catch (err) {
      throw err;
    }
  }
  async readFile(uri: Uri): Promise<Uint8Array> {
    const _uri = new URI(uri);
    let content: string | undefined;
    try {
      content = await promisify(fs.readFile)(FileUri.fsPath(_uri), { encoding: 'utf8' });
    } catch (err) {
      // 默认读不到时读取远端
    }
    if (!content && uri.fsPath.startsWith(this.options.rootFolder)) {
      content = await this.ensureFile(_uri);
    }
    return BinaryBuffer.fromString(content!).buffer;
  }
  async writeFile(
    uri: Uri,
    buffer: Uint8Array,
    options: { create: boolean; overwrite: boolean; isInit?: boolean },
  ): Promise<void | FileStat> {
    const content = BinaryBuffer.wrap(buffer).toString();
    this.checkCapability();

    const _uri = new URI(uri);

    const exists = fs.existsSync(FileUri.fsPath(_uri));

    if (exists && !options.overwrite) {
      throw FileSystemError.FileExists(_uri.toString());
    } else if (!exists && !options.create) {
      throw FileSystemError.FileNotFound(_uri.toString());
    }

    if (options.create) {
      // isInit代表是懒加载时从上层创建空文件，与用户主动创建或更新文件区分开
      if (!options.isInit && uri.fsPath.startsWith(this.options.rootFolder)) {
        await this.httpFileService.createFile(uri, content, {});
      }
      const stat = await this.createFile(uri, { content });
      this.onDidChangeFileEmitter.fire([
        {
          uri: uri.toString(),
          type: FileChangeType.ADDED,
        },
      ]);
      return stat;
    }
    if (!options.isInit && uri.fsPath.startsWith(this.options.rootFolder)) {
      await this.httpFileService.updateFile(uri, content, {});
    }
    await promisify(fs.writeFile)(FileUri.fsPath(_uri), content);
    this.onDidChangeFileEmitter.fire([
      {
        uri: uri.toString(),
        type: FileChangeType.UPDATED,
      },
    ]);
  }
  // FIXME: 支持删除目录
  async delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean | undefined }): Promise<void> {
    this.checkCapability();
    if (uri.fsPath.startsWith(this.options.rootFolder)) {
      await this.httpFileService.deleteFile(uri, { recursive: options.recursive });
    }
    await promisify(fs.unlink)(uri.fsPath);
    this.onDidChangeFileEmitter.fire([
      {
        uri: uri.toString(),
        type: FileChangeType.DELETED,
      },
    ]);
  }
  async rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): Promise<void | FileStat> {
    this.checkCapability();
    const content = await this.readFile(oldUri);
    // FIXME: 如何保证browserFs侧写入和远端写入的原子性？
    if (oldUri.fsPath.startsWith(this.options.rootFolder)) {
      await this.httpFileService.updateFile(oldUri, content.toString(), { newUri });
    }
    await promisify(fs.rename)(oldUri.fsPath, newUri.fsPath);
    this.onDidChangeFileEmitter.fire([
      {
        uri: oldUri.toString(),
        type: FileChangeType.DELETED,
      },
      {
        uri: newUri.toString(),
        type: FileChangeType.ADDED,
      },
    ]);
  }
  async access(uri: Uri): Promise<boolean> {
    const _uri = new URI(uri);
    try {
      await promisify(fs.stat)(FileUri.fsPath(_uri));
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        if (uri.fsPath.startsWith(this.options.rootFolder)) {
          const content = await this.ensureFile(_uri);
          return !!content;
        }
        return false;
      } else {
        throw err;
      }
    }
  }

  async copy(source: Uri, destination: Uri, options: { overwrite: boolean }): Promise<void | FileStat> {
    this.checkCapability();
    const content = await this.readFile(source);
    if (source.fsPath.startsWith(this.options.rootFolder)) {
      await this.httpFileService.createFile(destination, content.toString(), {});
    }
    await promisify(fs.writeFile)(destination.fsPath, content);
    this.onDidChangeFileEmitter.fire([
      {
        uri: destination.toString(),
        type: FileChangeType.ADDED,
      },
    ]);
  }

  private homeStat: FileStat | undefined;
  async getCurrentUserHome(): Promise<FileStat | undefined> {
    if (!this.homeStat) {
      await ensureDir(BROWSER_HOME_DIR.codeUri.fsPath);
      this.homeStat = await this.stat(BROWSER_HOME_DIR.codeUri);
    }
    return this.homeStat;
  }

  async getFileType(uri: string): Promise<string | undefined> {
    if (!uri.startsWith('file:/')) {
      return this._getFileType('');
    }

    try {
      const stat = await promisify(fs.stat)(FileUri.fsPath(uri));

      if (!stat.isDirectory()) {
        let ext = new URI(uri).path.ext;
        if (ext.startsWith('.')) {
          ext = ext.slice(1);
        }
        return this._getFileType(ext);
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

  // 确保目录已经获取过了
  protected async ensureDir(path: string) {
    const PATH_SEPARATOR = '/';
    const pathList = (path.startsWith(PATH_SEPARATOR) ? path.slice(0) : path).split(PATH_SEPARATOR);
    let i = 0;
    while (i < pathList.length) {
      const targetPath = PATH_SEPARATOR + pathList.slice(0, i + 1).join(PATH_SEPARATOR);
      if (!fs.existsSync(targetPath)) {
        await this.ensureNodeFetched(URI.file(PATH_SEPARATOR + targetPath));
      }
      i = i + 1;
    }
  }

  // 确保文件已经获取过了
  protected async ensureFile(uri: URI) {
    // content为空读取远程
    const content = await this.httpFileService.readFile(uri.codeUri);
    if (content || !uri.path.dir.toString().endsWith('.sumi')) {
      await this.ensureDir(uri.path.dir.toString());
      // workspaceDir 要带版本号信息(ref)，保证本地存储和版本号是对应的
      content && (await promisify(fs.writeFile)(FileUri.fsPath(uri), content));
    }
    return content;
  }

  protected checkCapability() {
    if (this.options && this.options.isReadonly) {
      throw new Error('FileSystem is readonly!');
    }
  }

  protected async createFile(uri: Uri, options: { content: string }): Promise<FileStat> {
    const _uri = new URI(uri);
    const parentUri = _uri.parent;
    const parentStat = await this.doGetStat(parentUri, 0);
    if (!parentStat) {
      await ensureDir(FileUri.fsPath(parentUri));
    }
    try {
      await promisify(fs.writeFile)(FileUri.fsPath(_uri), options.content);
    } catch (err) {
      // 文件已存在
    }
    // TODO: 感觉没必要再取一次
    const newStat = await this.doGetStat(_uri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(uri.path, 'Error occurred while creating the file.');
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

  protected async doGetStat(uri: URI, depth: number): Promise<FileStat | undefined> {
    try {
      const filePath = FileUri.fsPath(uri);
      const lstat = await promisify(fs.lstat)(filePath);

      if (lstat.isDirectory()) {
        return await this.doCreateDirectoryStat(uri, lstat, depth);
      }
      const fileStat = await this.doCreateFileStat(uri, lstat);

      return fileStat;
    } catch (error) {
      if (isErrnoException(error)) {
        if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'EPERM') {
          return undefined;
        }
      }
      throw error;
    }
  }

  protected async ensureNodeFetched(uri: URI) {
    const childNodes = await this.httpFileService.readDir(uri.codeUri);
    const ensureNodes: Promise<FileStat>[] = [];
    for (const node of childNodes) {
      if (node.children.length) {
        ensureNodes.push(
          this.createDirectory(URI.file(new Path(this.options.rootFolder).join(`${node.path}`).toString()).codeUri),
        );
      } else {
        ensureNodes.push(
          this.writeFile(
            URI.file(new Path(this.options.rootFolder).join(`${node.path}`).toString()).codeUri,
            BinaryBuffer.fromString('').buffer,
            { create: true, isInit: true, overwrite: false },
          ) as Promise<FileStat>,
        );
      }
    }
    try {
      await Promise.all(ensureNodes);
    } catch (err) {
      // console.error('node fetch failed ', err);
    }
  }

  protected async doCreateFileStat(uri: URI, stat: fs.Stats): Promise<FileStat> {
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

  protected async doCreateDirectoryStat(uri: URI, stat: fs.Stats, depth: number): Promise<FileStat> {
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

  protected async doGetChildren(uri: URI, depth: number): Promise<FileStat[]> {
    // TODO: 获取stat前拉取一遍远端的结构信息，理论上要加一个cache做优化
    if (uri.codeUri.fsPath.startsWith(this.options.rootFolder)) {
      await this.ensureNodeFetched(uri);
    }
    return new Promise((resolve) => {
      fs.readdir(FileUri.fsPath(uri), async (err, files) => {
        const children = await Promise.all(
          files.map((fileName) => uri.resolve(fileName)).map((childUri) => this.doGetStat(childUri, depth - 1)),
        );
        resolve(children.filter(notEmpty));
      });
    });
  }

  private _getFileType(ext: string) {
    let type = 'text';

    if (['png', 'gif', 'jpg', 'jpeg', 'svg'].indexOf(ext) > -1) {
      type = 'image';
    } else if (BrowserFsProvider.H5VideoExtList.indexOf(ext) > -1) {
      type = 'video';
    } else if (BrowserFsProvider.binaryExtList.indexOf(ext) > -1) {
      type = 'binary';
    }

    return type;
  }
}

export abstract class AbstractHttpFileService {
  abstract readFile(uri: Uri, encoding?: string): Promise<string>;
  abstract readDir(uri: Uri): Promise<HttpTreeList>;
  updateFile(uri: Uri, content: string, options: { encoding?: string; newUri?: Uri }): Promise<void> {
    throw new Error('updateFile method not implemented');
  }
  createFile(uri: Uri, content: string, options: { encoding?: string }): Promise<void> {
    throw new Error('createFile method not implemented');
  }
  deleteFile(uri: Uri, options: { recursive?: boolean }): Promise<void> {
    throw new Error('deleteFile method not implemented');
  }
}
