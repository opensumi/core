import { IDiskFileProvider, FileChangeEvent, FileStat, FileType, FileSystemError, notEmpty, isErrnoException } from '../common';
import { Event, URI, FileUri, Uri } from '@ali/ide-core-common';
import { promisify } from '@ali/ide-core-common/lib/browser-fs/util';
import { ensureDir } from '@ali/ide-core-common/lib/browser-fs/ensure-dir';

import * as fs from 'fs';
import * as paths from 'path';

export class BrowserFsProvider implements IDiskFileProvider {
  static base64ToUnicode(str: string) {
    return decodeURIComponent(
      atob(str)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
    );
  }

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

  constructor(private getResolveService: (uri: URI) => string) {

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
      content = await fetch(
        this.getResolveService(_uri),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
        .then((res) => res.json())
        .then((ret) => {
          if (ret.encoding === 'base64') {
            ret.content = BrowserFsProvider.base64ToUnicode(ret.content);
          }
          return ret.content;
        });
    }
    return content;
  }
  async writeFile(uri: Uri, content: string, options: { create: boolean; overwrite: boolean; }): Promise<void | FileStat> {
    const _uri = new URI(uri);

    if (options.create) {
      return await this.createFile(uri, { content });
    }
    try {
      await promisify(fs.stat)(FileUri.fsPath(_uri));
      if (!options.overwrite) {
        throw FileSystemError.FileExists(_uri.toString());
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        if (!options.create) {
          throw FileSystemError.FileNotFound(_uri.toString());
        }
        await promisify(fs.writeFile)(FileUri.fsPath(_uri), content);
      } else {
        throw err;
      }
    }
  }
  delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean | undefined; }): void | Thenable<void> {
    throw new Error('Method not implemented.');
  }
  rename(oldstring: Uri, newstring: Uri, options: { overwrite: boolean; }): void | Thenable<void | FileStat> {
    throw new Error('Method not implemented.');
  }
  async exists(uri: Uri): Promise<boolean> {
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

  copy(source: Uri, destination: Uri, options: { overwrite: boolean; }): void | Thenable<void | FileStat> {
    throw new Error('Method not implemented.');
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

  async access(uri: Uri, mode): Promise<boolean> {
    try {
      await promisify(fs.access)(uri.fsPath, mode);
      return true;
    } catch (err) {
      return false;
    }
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
