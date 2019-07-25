/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import { Injectable, Inject } from '@ali/common-di';
import * as mv from 'mv';
import * as touch from 'touch';
import * as trash from 'trash';
import { v4 } from 'uuid';
import * as drivelist from 'drivelist';
import * as paths from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as fileType from 'file-type';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { TextDocumentContentChangeEvent, TextDocument } from 'vscode-languageserver-types';
import { URI, Emitter, Event } from '@ali/ide-core-common';
import { FileUri } from '@ali/ide-core-node';
import { FileSystemError, FileStat, IFileService, FileMoveOptions, FileDeleteOptions, FileAccess } from '../common/files';
import { NsfwFileSystemWatcherServer } from './file-service-watcher'
import { RPCService } from '@ali/ide-connection'
import { FileChangeEvent } from '../common/file-service-watcher-protocol';
import { detectEncodingByURI, getEncodingInfo, decode, encode, UTF8 } from './encoding';

export abstract class FileSystemNodeOptions {

  public static DEFAULT: FileSystemNodeOptions = {
    encoding: 'utf8',
    overwrite: false,
    recursive: true,
    moveToTrash: true,
  };

  abstract encoding: string;
  abstract recursive: boolean;
  abstract overwrite: boolean;
  abstract moveToTrash: boolean;

}

@Injectable()
export class FileService extends RPCService implements IFileService {

  private watcherServer: NsfwFileSystemWatcherServer;
  protected readonly onFileChangedEmitter = new Emitter<FileChangeEvent>();
  readonly onFilesChanged: Event<FileChangeEvent> = this.onFileChangedEmitter.event;

  constructor(
    @Inject('FileServiceOptions') protected readonly options: FileSystemNodeOptions,
  ) {
    super()
    this.watcherServer = new NsfwFileSystemWatcherServer({
      verbose: true
    })

    this.initWatchConnection();
  }

  initWatchConnection() {
    this.watcherServer.setClient({
      onDidFilesChanged: (e: any) => {
        this.onFileChangedEmitter.fire(e);
        if (this.rpcClient) {
          this.rpcClient.forEach((client) => {
            client.onDidFilesChanged(e);
          });
        }
      }
    });
  }

  async unwatchFileChanges(watcherId: number) {
    return this.watcherServer.unwatchFileChanges(watcherId);
  }

  async watchFileChanges(uri: string) {
    const watcherId = this.watcherServer.watchFileChanges(uri);
    return watcherId;
  }

  async getFileStat(uri: string): Promise<FileStat | undefined> {
    const _uri = new URI(uri);
    const stat = await this.doGetStat(_uri, 1);
    return stat;
  }

  async exists(uri: string): Promise<boolean> {
    return fs.pathExists(FileUri.fsPath(new URI(uri)));
  }

  async resolveContent(uri: string, options?: { encoding?: string }): Promise<{ stat: FileStat, content: string }> {
    const _uri = new URI(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (!stat) {
      throw FileSystemError.FileNotFound(uri);
    }
    if (stat.isDirectory) {
      throw FileSystemError.FileIsDirectory(uri, 'Cannot resolve the content.');
    }
    const encoding = await this.doGetEncoding(options);
    const content = decode(await fs.readFile(FileUri.fsPath(_uri)), encoding);
    return { stat, content };
  }

  async setContent(file: FileStat, content: string, options?: { encoding?: string }): Promise<FileStat> {
    const _uri = new URI(file.uri);
    const stat = await this.doGetStat(_uri, 0);
    if (!stat) {
      throw FileSystemError.FileNotFound(file.uri);
    }
    if (stat.isDirectory) {
      throw FileSystemError.FileIsDirectory(file.uri, 'Cannot set the content.');
    }
    if (!(await this.isInSync(file, stat))) {
      throw this.createOutOfSyncError(file, stat);
    }
    const encoding = await this.doGetEncoding(options);
    await writeFileAtomicSync(FileUri.fsPath(_uri), encode(content, encoding));
    const newStat = await this.doGetStat(_uri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(file.uri, 'Error occurred while writing file content.');
  }

  async updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: { encoding?: string }): Promise<FileStat> {
    const _uri = new URI(file.uri);
    const stat = await this.doGetStat(_uri, 0);
    if (!stat) {
      throw FileSystemError.FileNotFound(file.uri);
    }
    if (stat.isDirectory) {
      throw FileSystemError.FileIsDirectory(file.uri, 'Cannot set the content.');
    }
    if (!this.checkInSync(file, stat)) {
      throw this.createOutOfSyncError(file, stat);
    }
    if (contentChanges.length === 0) {
      return stat;
    }
    const encoding = await this.doGetEncoding(options);
    const content = await fs.readFile(FileUri.fsPath(_uri), { encoding });
    const newContent = this.applyContentChanges(content, contentChanges);
    await writeFileAtomicSync(FileUri.fsPath(_uri), encode(newContent, encoding));
    const newStat = await this.doGetStat(_uri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(file.uri, 'Error occurred while writing file content.');
  }

  async move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat> {
    // if (this.client) {
    //   this.client.onWillMove(sourceUri, targetUri);
    // }
    const result = await this.doMove(sourceUri, targetUri, options);
    // if (this.client) {
    //   this.client.onDidMove(sourceUri, targetUri);
    // }
    return result;
  }

  async copy(sourceUri: string, targetUri: string, options?: { overwrite?: boolean, recursive?: boolean }): Promise<FileStat> {
    const _sourceUri = new URI(sourceUri);
    const _targetUri = new URI(targetUri);
    const [sourceStat, targetStat, overwrite, recursive] = await Promise.all([
      this.doGetStat(_sourceUri, 0),
      this.doGetStat(_targetUri, 0),
      this.doGetOverwrite(options),
      this.doGetRecursive(options),
    ]);
    if (!sourceStat) {
      throw FileSystemError.FileNotFound(sourceUri);
    }
    if (targetStat && !overwrite) {
      throw FileSystemError.FileExists(targetUri, "Did you set the 'overwrite' flag to true?");
    }
    if (targetStat && targetStat.uri === sourceStat.uri) {
      throw FileSystemError.FileExists(targetUri, 'Cannot perform copy, source and destination are the same.');
    }
    await fs.copy(FileUri.fsPath(_sourceUri), FileUri.fsPath(_targetUri), { overwrite, recursive });
    const newStat = await this.doGetStat(_targetUri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(targetUri, `Error occurred while copying ${sourceUri} to ${targetUri}.`);
  }

  async createFile(uri: string, options?: { content?: string, encoding?: string }): Promise<FileStat> {
    const _uri = new URI(uri);
    const parentUri = _uri.parent;
    const [stat, parentStat] = await Promise.all([this.doGetStat(_uri, 0), this.doGetStat(parentUri, 0)]);
    if (stat) {
      throw FileSystemError.FileExists(uri, 'Error occurred while creating the file.');
    }
    if (!parentStat) {
      await fs.mkdirs(FileUri.fsPath(parentUri));
    }
    const content = await this.doGetContent(options);
    const encoding = await this.doGetEncoding(options);
    await fs.writeFile(FileUri.fsPath(_uri), encode(content, encoding));
    const newStat = await this.doGetStat(_uri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(uri, 'Error occurred while creating the file.');
  }

  async createFolder(uri: string): Promise<FileStat> {
    const _uri = new URI(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (stat) {
      if (stat.isDirectory) {
        return stat;
      }
      throw FileSystemError.FileExists(uri, 'Error occurred while creating the directory: path is a file.');
    }
    await fs.mkdirs(FileUri.fsPath(_uri));
    const newStat = await this.doGetStat(_uri, 1);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(uri, 'Error occurred while creating the directory.');
  }

  async touchFile(uri: string): Promise<FileStat> {
    const _uri = new URI(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (!stat) {
      return this.createFile(uri);
    } else {
      return new Promise<FileStat>((resolve, reject) => {
        // tslint:disable-next-line:no-any
        touch(FileUri.fsPath(_uri), async (error: any) => {
          if (error) {
            return reject(error);
          }
          resolve(await this.doGetStat(_uri, 1));
        });
      });
    }
  }

  async delete(uri: string, options?: FileDeleteOptions): Promise<void> {
    const _uri = new URI(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (!stat) {
      throw FileSystemError.FileNotFound(uri);
    }
    // Windows 10.
    // Deleting an empty directory throws `EPERM error` instead of `unlinkDir`.
    // https://github.com/paulmillr/chokidar/issues/566
    const moveToTrash = await this.doGetMoveToTrash(options);
    if (moveToTrash) {
      return trash([FileUri.fsPath(_uri)]);
    } else {
      const filePath = FileUri.fsPath(_uri);
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

  async getEncoding(uri: string): Promise<string> {
    const _uri = new URI(uri);
    const stat = await this.doGetStat(_uri, 0);
    if (!stat) {
      throw FileSystemError.FileNotFound(uri);
    }
    if (stat.isDirectory) {
      throw FileSystemError.FileIsDirectory(uri, 'Cannot get the encoding.');
    }

    const encoding = detectEncodingByURI(_uri);

    return encoding || this.options.encoding || UTF8;
  }

 getEncodingInfo = getEncodingInfo

  async getRoots(): Promise<FileStat[]> {
    const cwdRoot = paths.parse(process.cwd()).root;
    const rootUri = FileUri.create(cwdRoot);
    const root = await this.doGetStat(rootUri, 1);
    if (root) {
      return [root];
    }
    return [];
  }

  async getCurrentUserHome(): Promise<FileStat | undefined> {
    return this.getFileStat(FileUri.create(os.homedir()).toString());
  }

  getDrives(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      drivelist.list((error: Error, drives: Array<{ readonly mountpoints: Array<{ readonly path: string; }> }>) => {
        if (error) {
          reject(error);
          return;
        }

        const uris = drives
          .map((drive) => drive.mountpoints)
          .reduce((prev, curr) => prev.concat(curr), [])
          .map((mountpoint) => mountpoint.path)
          .filter(this.filterMountpointPath.bind(this))
          .map((path) => FileUri.create(path))
          .map((uri) => uri.toString());

        resolve(uris);
      });
    });
  }

  dispose(): void {
    // NOOP
  }

  async access(uri: string, mode: number = FileAccess.Constants.F_OK): Promise<boolean> {
    try {
      await fs.access(FileUri.fsPath(uri), mode);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getFsPath(uri: string): Promise<string | undefined> {
    if (!uri.startsWith('file:/')) {
      return undefined;
    } else {
      return FileUri.fsPath(uri);
    }
  }

  protected applyContentChanges(content: string, contentChanges: TextDocumentContentChangeEvent[]): string {
    let document = TextDocument.create('', '', 1, content);
    for (const change of contentChanges) {
      let newContent = change.text;
      if (change.range) {
        const start = document.offsetAt(change.range.start);
        const end = document.offsetAt(change.range.end);
        newContent = document.getText().substr(0, start) + change.text + document.getText().substr(end);
      }
      document = TextDocument.create(document.uri, document.languageId, document.version, newContent);
    }
    return document.getText();
  }

  protected async isInSync(file: FileStat, stat: FileStat): Promise<boolean> {
    if (this.checkInSync(file, stat)) {
      return true;
    }
    return false;
  }

  protected checkInSync(file: FileStat, stat: FileStat): boolean {
    return stat.lastModification === file.lastModification && stat.size === file.size;
  }

  protected createOutOfSyncError(file: FileStat, stat: FileStat): Error {
    return FileSystemError.FileIsOutOfSync(file, stat);
  }
  protected async doMove(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat> {
    const _sourceUri = new URI(sourceUri);
    const _targetUri = new URI(targetUri);
    const [sourceStat, targetStat, overwrite] = await Promise.all([this.doGetStat(_sourceUri, 1), this.doGetStat(_targetUri, 1), this.doGetOverwrite(options)]);
    if (!sourceStat) {
      throw FileSystemError.FileNotFound(sourceUri);
    }
    if (targetStat && !overwrite) {
      throw FileSystemError.FileExists(targetUri, "Did you set the 'overwrite' flag to true?");
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
      await fs.utimes(FileUri.fsPath(_targetUri), now, now);
      await fs.rmdir(FileUri.fsPath(_sourceUri));
      const newStat = await this.doGetStat(_targetUri, 1);
      if (newStat) {
        return newStat;
      }
      throw FileSystemError.FileNotFound(targetUri, `Error occurred when moving resource from '${sourceUri}' to '${targetUri}'.`);
    } else if (overwrite && targetStat && targetStat.isDirectory && sourceStat.isDirectory && !targetMightHaveChildren && sourceMightHaveChildren) {
      // Copy source to target, since target is empty. Then wipe the source content.
      const newStat = await this.copy(sourceUri, targetUri, { overwrite });
      await this.delete(sourceUri);
      return newStat;
    } else {
      return new Promise<FileStat>((resolve, reject) => {
        mv(FileUri.fsPath(_sourceUri), FileUri.fsPath(_targetUri), { mkdirp: true, clobber: overwrite }, async (error: any) => {
          if (error) {
            return reject(error);
          }
          resolve(await this.doGetStat(_targetUri, 1));
        });
      });
    }
  }

  /**
   * Filters hidden and system partitions.
   */
  protected filterMountpointPath(path: string): boolean {
    // OS X: This is your sleep-image. When your Mac goes to sleep it writes the contents of its memory to the hard disk. (https://bit.ly/2R6cztl)
    if (path === '/private/var/vm') {
      return false;
    }
    // Ubuntu: This system partition is simply the boot partition created when the computers mother board runs UEFI rather than BIOS. (https://bit.ly/2N5duHr)
    if (path === '/boot/efi') {
      return false;
    }
    return true;
  }

  protected async doGetStat(uri: URI, depth: number): Promise<FileStat | undefined> {
    try {
      const filePath = FileUri.fsPath(uri)
      const lstat = await fs.lstat(filePath);

      if(lstat.isSymbolicLink()){
        let realPath
        try {
          realPath = await fs.realpath(FileUri.fsPath(uri));
        }catch(e){
          return undefined;
        }
        const stat = await fs.stat(filePath)
        const realURI = FileUri.create(realPath)
        const realStat = await fs.lstat(realPath)



        let realStatData
        if(stat.isDirectory()){
          realStatData = await this.doCreateDirectoryStat(realURI, realStat, depth)
        }else {
          realStatData = await this.doCreateFileStat(realURI, realStat);
        }

        return {
          ...realStatData,
          isSymbolicLink: true,
          uri: uri.toString()
        }

      }else {
        if (lstat.isDirectory()) {
          return await this.doCreateDirectoryStat(uri, lstat, depth);
        }
        let fileStat = await this.doCreateFileStat(uri, lstat);

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
  async getFileType(uri: string): Promise<string|undefined>{
    try {
      const lstat = await fs.lstat(FileUri.fsPath(uri));
      const stat = await fs.stat(FileUri.fsPath(uri))

      let ext: string = ''
      if(!stat.isDirectory()){

        // if(lstat.isSymbolicLink){

        // }else {
          if(stat.size) {
            const type = await fileType.stream(fs.createReadStream(FileUri.fsPath(uri)))
            if(type.fileType){
              ext = type.fileType.ext
            }
          }
          return this._getFileType(ext)
        // }
      }else {
        return 'directory'
      }
    }catch (error) {
      if (isErrnoException(error)) {
        if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'EPERM') {
          return undefined;
        }
      }
    }

  }
  private _getFileType(ext){
    let type = 'text'

    if(['png', 'gif', 'jpg', 'jpeg', 'svg'].indexOf(ext) !== -1){
      type = 'image'
    }else if(ext){
      type = 'binary'
    }

    return type
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
      isSymbolicLink: stat.isSymbolicLink(),
      isDirectory: stat.isDirectory(),
      size: stat.size
    };
  }

  protected async doCreateDirectoryStat(uri: URI, stat: fs.Stats, depth: number): Promise<FileStat> {
    const children = depth > 0 ? await this.doGetChildren(uri, depth) : [];
    return {
      uri: uri.toString(),
      lastModification: stat.mtime.getTime(),
      isDirectory: true,
      isSymbolicLink: stat.isSymbolicLink(),
      children,
    };
  }

  protected async doGetChildren(uri: URI, depth: number): Promise<FileStat[]> {
    const files = await fs.readdir(FileUri.fsPath(uri));
    const children = await Promise.all(files.map((fileName) => uri.resolve(fileName)).map((childUri) => this.doGetStat(childUri, depth - 1)));
    return children.filter(notEmpty);
  }

  /**
   * Return `true` if it's possible for this URI to have children.
   * It might not be possible to be certain because of permission problems or other filesystem errors.
   */
  protected async mayHaveChildren(uri: URI): Promise<boolean> {
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

  protected async doGetEncoding(option?: { encoding?: string }): Promise<string> {
    return option && typeof (option.encoding) !== 'undefined'
      ? option.encoding
      : this.options.encoding;
  }

  protected async doGetOverwrite(option?: { overwrite?: boolean }): Promise<boolean | undefined> {
    return option && typeof (option.overwrite) !== 'undefined'
      ? option.overwrite
      : this.options.overwrite;
  }

  protected async doGetRecursive(option?: { recursive?: boolean }): Promise<boolean> {
    return option && typeof (option.recursive) !== 'undefined'
      ? option.recursive
      : this.options.recursive;
  }

  protected async doGetMoveToTrash(option?: { moveToTrash?: boolean }): Promise<boolean> {
    return option && typeof (option.moveToTrash) !== 'undefined'
      ? option.moveToTrash
      : this.options.moveToTrash;
  }

  protected async doGetContent(option?: { content?: string }): Promise<string> {
    return (option && option.content) || '';
  }

  // #region text file.

  // async getFileEncoding(uri: URI): string {

  // }


  // #endregion


}

// tslint:disable-next-line:no-any
function isErrnoException(error: any | NodeJS.ErrnoException): error is NodeJS.ErrnoException {
  return (error as NodeJS.ErrnoException).code !== undefined && (error as NodeJS.ErrnoException).errno !== undefined;
}

function notEmpty<T>(value: T | undefined): value is T {
  return value !== undefined;
}
