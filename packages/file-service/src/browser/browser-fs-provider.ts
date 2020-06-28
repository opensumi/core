import { IDiskFileProvider, FileChangeEvent, FileStat, FileType, FileSystemError, notEmpty, isErrnoException } from '../common';
import { Event, URI, FileUri, Uri } from '@ali/ide-core-common';
import { Path } from '@ali/ide-core-common/lib/path';
import { promisify } from '@ali/ide-core-common/lib/browser-fs/util';
import { ensureDir } from '@ali/ide-core-common/lib/browser-fs/ensure-dir';

import * as fs from 'fs';
import * as paths from 'path';

interface BrowserFsProviderOptions { isReadonly?: boolean; rootFolder: string; }

export class BrowserFsProvider implements IDiskFileProvider {

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
    'mp4',
    'mp4a',
    'mp4v',
    'mpe',
    'mpeg',
    'mpg',
    'mpg4',
    'mpga',
    'oga',
    'ogg',
    'ogv',
    'psd',
    'qt',
    'spx',
    'tga',
    'tif',
    'tiff',
    'wav',
    'webm',
    'webp',
    'wma',
    'wmv',
    'woff',
  ];

  onDidChangeFile: Event<FileChangeEvent>;

  constructor(private httpFileService: HttpFileServiceBase, private options: BrowserFsProviderOptions) {

  }

  watch(uri: Uri, options: { recursive: boolean; excludes: string[]; }): number {
    // TODO: shall we implement this method?
    return 0;
  }
  unwatch(watcherId: number): void {}
  async stat(uri: Uri): Promise<FileStat> {
    const _uri = new URI(uri);
    return new Promise(async (resolve) => {
      this.doGetStat(_uri, 1)
        .then((stat) => resolve(stat))
        .catch((e) => {
          // console.log(e, 'stat error');
          resolve();
        });
    });
  }
  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    const result: [string, FileType][] = [];
    try {
      const dirList = await promisify(fs.readdir)(uri.fsPath);

      for (const name of dirList as  string[]) {
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
      throw FileSystemError.FileExists(uri, 'Error occurred while creating the directory: path is a file.');
    }
    try {
      await promisify(fs.mkdir)(FileUri.fsPath(_uri));
      return this.doGetStat(_uri, 0) as Promise<FileStat>;
    } catch (err) {
      throw err;
    }
  }
  async readFile(uri: Uri): Promise<string> {
    const _uri = new URI(uri);
    let content = await promisify(fs.readFile)(FileUri.fsPath(_uri), { encoding: 'utf8' });
    if (!content) {
      // content为空读取远程
      content = await this.httpFileService.readFile(uri);
    }
    return content;
  }
  async writeFile(uri: Uri, content: string, options: { create: boolean; overwrite: boolean; isInit?: boolean }): Promise<void | FileStat> {
    this.checkCapability();

    const _uri = new URI(uri);

    const exists = await this.access(uri);

    if (exists && !options.overwrite) {
      throw FileSystemError.FileExists(_uri.toString());
    } else if (!exists && !options.create) {
      throw FileSystemError.FileNotFound(_uri.toString());
    }

    if (options.create) {
      if (!options.isInit && this.httpFileService.createFile) {
        await this.httpFileService.createFile(uri, content, {});
      }
      return await this.createFile(uri, { content });
    }
    if (!options.isInit && this.httpFileService.updateFile) {
      await this.httpFileService.updateFile(uri, content, {});
    }
    await promisify(fs.writeFile)(FileUri.fsPath(_uri), content);
  }
  async delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean | undefined; }): Promise<void> {
    this.checkCapability();
    if (this.httpFileService.deleteFile) {
      await this.httpFileService.deleteFile(uri, {recursive: options.recursive});
    }
    return await promisify(fs.unlink)((uri.fsPath));
  }
  async rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean; }): Promise<void | FileStat> {
    this.checkCapability();
    const content = await this.readFile(oldUri);
    // FIXME: 如何保证browserFs侧写入和远端写入的原子性？
    if (this.httpFileService.updateFile) {
      await this.httpFileService.updateFile(oldUri, content, { newUri });
    }
    return await promisify(fs.rename)(oldUri.fsPath, newUri.fsPath);
  }
  async access(uri: Uri): Promise<boolean> {
    const _uri = new URI(uri);
    try {
      await promisify(fs.stat)(FileUri.fsPath(_uri));
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false;
      } else {
        throw err;
      }
    }
  }

  async copy(source: Uri, destination: Uri, options: { overwrite: boolean; }): Promise<void | FileStat> {
    this.checkCapability();
    const content = await this.readFile(source);
    if (this.httpFileService.createFile) {
      await this.httpFileService.createFile(destination, content, {});
    }
    await promisify(fs.copyFile)(source.fsPath, destination.fsPath);
  }
  async getCurrentUserHome(): Promise<FileStat | undefined> {
    return undefined;
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
      await ensureDir((FileUri.fsPath(parentUri)));
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
    throw FileSystemError.FileNotFound(uri, 'Error occurred while creating the file.');
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
      // TODO: 获取stat前拉取一遍远端的结构信息，理论上要加一个cache做优化
      await this.ensureNodeFetched(uri);

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
      if (node.type === 'tree') {
        ensureNodes.push(this.createDirectory(URI.file(new Path(this.options.rootFolder).join(`${node.path}`).toString()).codeUri));
      } else {
        ensureNodes.push(this.writeFile(URI.file(new Path(this.options.rootFolder).join(`${node.path}`).toString()).codeUri, '', {create: true, isInit: true, overwrite: false}) as Promise<FileStat>);
      }
    }
    try {
      await Promise.all(ensureNodes);
    } catch (err) {
      // logger
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
    return new Promise((resolve) => {
      fs.readdir(FileUri.fsPath(uri), async (err, files) => {
        const children = await Promise.all(files.map((fileName) => uri.resolve(fileName)).map((childUri) => this.doGetStat(childUri, depth - 1)));
        resolve(children.filter(notEmpty));
      });
    });
  }

  private _getFileType(ext: string) {
    let type = 'text';

    if (['png', 'gif', 'jpg', 'jpeg', 'svg'].indexOf(ext) > -1) {
      type = 'image';
    } else if (BrowserFsProvider.binaryExtList.indexOf(ext) > -1) {
      type = 'binary';
    }

    return type;
  }
}

export abstract class HttpFileServiceBase {
  abstract readFile(uri: Uri, encoding?: string): Promise<string>;
  abstract readDir(uri: Uri): Promise<Array<{type: 'tree' | 'leaf', path: string}>>;
  updateFile?(uri: Uri, content: string, options: { encoding?: string; newUri?: Uri; }): Promise<void> {
    throw new Error('updateFile method not implemented');
  }
  createFile?(uri: Uri, content: string, options: { encoding?: string; }): Promise<void> {
    throw new Error('createFile method not implemented');
  }
  deleteFile?(uri: Uri, options: { recursive?: boolean }): Promise<void> {
    throw new Error('deleteFile method not implemented');
  }
}
