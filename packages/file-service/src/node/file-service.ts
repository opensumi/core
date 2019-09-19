import { Injectable, Inject } from '@ali/common-di';
import * as drivelist from 'drivelist';
import * as paths from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as fileType from 'file-type';
import Uri from 'vscode-uri';
import { TextDocumentContentChangeEvent, TextDocument } from 'vscode-languageserver-types';
import {
  URI,
  Emitter,
  Event,
  Schemas,
  IDisposable,
  DisposableCollection,
  isFunction,
  isArray,
  isEmptyObject,
} from '@ali/ide-core-common';
import { FileUri } from '@ali/ide-core-node';
import { RPCService } from '@ali/ide-connection'
import { parse, ParsedPattern } from '@ali/ide-core-common/lib/utils/glob';
import { FileChangeEvent, WatchOptions } from '../common/file-service-watcher-protocol';
import { FileSystemManage } from './file-system-manage';
import { DiskFileSystemProvider } from './disk-file-system.provider';
import { ShadowFileSystemProvider } from './shadow-file-system.provider';
import { detectEncodingByURI, getEncodingInfo, decode, encode, UTF8 } from './encoding';
import {
  FileSystemError,
  FileStat,
  IFileService,
  FileMoveOptions,
  FileDeleteOptions,
  FileAccess,
  FileSystemProvider,
  DidFilesChangedParams,
  FileSetContentOptions,
  FileCreateOptions,
  FileCopyOptions,
} from '../common';
import { ExtensionFileSystemManage } from './extension-file-system-manage';

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
  protected watcherId: number = 0;
  protected readonly watcherDisposerMap = new Map<number, IDisposable>();
  protected readonly watcherWithSchemaMap = new Map<string, number[]>();
  protected readonly onFileChangedEmitter = new Emitter<DidFilesChangedParams>();
  protected readonly fileSystemManage = new FileSystemManage();
  protected extensionFileSystemManage: ExtensionFileSystemManage;
  readonly onFilesChanged: Event<DidFilesChangedParams> = this.onFileChangedEmitter.event;
  protected toDisposable = new DisposableCollection();
  protected watchFileExcludes: string[] = [];
  protected filesExcludes: string[] = [];
  protected filesExcludesMatcherList: ParsedPattern[] = [];

  constructor(
    @Inject('FileServiceOptions') protected readonly options: FileSystemNodeOptions,
  ) {
    super();
    this.initProvider();
  }

  registerProvider(scheme: string, provider: FileSystemProvider): IDisposable {
    this.toDisposable.push(this.fileSystemManage.add(scheme, provider));
    this.toDisposable.push(provider.onDidChangeFile((e) => this.fireFilesChange(e)));
    this.toDisposable.push({
      dispose: () => {
        (this.watcherWithSchemaMap.get(scheme) || []).forEach((id) => this.unwatchFileChanges(id));
      }
    })
    return this.toDisposable;
  }

  async watchFileChanges(uri: string): Promise<number> {
    const id = this.watcherId++;
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);
    const schemaWatchIdList = this.watcherWithSchemaMap.get(_uri.scheme) || [];

    this.watcherDisposerMap.set(id, provider.watch(_uri.codeUri, {
      recursive: true,
      excludes: this.watchFileExcludes
    }))
    schemaWatchIdList.push(id);
    this.watcherWithSchemaMap.set(
      _uri.scheme,
      schemaWatchIdList,
    )
    return id;
  }

  async unwatchFileChanges(watcherId: number) {
    const disposable = this.watcherDisposerMap.get(watcherId);
    if (!disposable || !disposable.dispose) {
      return;
    }
    disposable.dispose();
  }

  setWatchFileExcludes(excludes: string[]) {
    this.watchFileExcludes = excludes
  }

  getWatchFileExcludes(): string[] {
    return this.watchFileExcludes;
  }

  setFilesExcludes(excludes: string[]) {
    this.filesExcludes = excludes;
    this.filesExcludesMatcherList = [];
    this.filesExcludes.forEach((str) => {
      this.filesExcludesMatcherList.push(parse(str));
    })
  }

  getFilesExcludes(): string[] {
    return this.filesExcludes;
  }

  async getFileStat(uri: string): Promise<FileStat | undefined> {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);
    const stat = await provider.stat(_uri.codeUri);
    return this.filterStat(stat);
  }

  async exists(uri: string): Promise<boolean> {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);
    if (!isFunction(provider.exists)) {
      throw this.getErrorProvideNotSupport(_uri.scheme, 'exists');
    }
    return provider.exists(uri);
  }

  async resolveContent(uri: string, options?: FileSetContentOptions): Promise<{ stat: FileStat, content: string }> {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);
    const stat = await provider.stat(_uri.codeUri);
    if (!stat) {
      throw FileSystemError.FileNotFound(uri);
    }
    if (stat.isDirectory) {
      throw FileSystemError.FileIsDirectory(uri, 'Cannot resolve the content.');
    }
    const encoding = await this.doGetEncoding(options);
    const buffer = await this.getNodeBuffer(await provider.readFile(_uri.codeUri));
    const content = decode(buffer, encoding);
    return { stat, content };
  }

  async setContent(file: FileStat, content: string, options?: FileSetContentOptions): Promise<FileStat> {
    const _uri = this.getUri(file.uri);
    const provider = await this.getProvider(_uri.scheme);
    const stat = await provider.stat(_uri.codeUri);

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
    await provider.writeFile(_uri.codeUri, encode(content, encoding), { create: false, overwrite: true });
    const newStat = await provider.stat(_uri.codeUri);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(file.uri, 'Error occurred while writing file content.');
  }

  async updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: FileSetContentOptions): Promise<FileStat> {
    const _uri = this.getUri(file.uri);
    const provider = await this.getProvider(_uri.scheme);
    const stat = await provider.stat(_uri.codeUri);
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
    // const content = await fs.readFile(FileUri.fsPath(_uri), { encoding });
    const buffer = await this.getNodeBuffer(await provider.readFile(_uri.codeUri));
    const content = decode(buffer, encoding);
    const newContent = this.applyContentChanges(content, contentChanges);
    await provider.writeFile(_uri.codeUri, encode(newContent, encoding), { create: false, overwrite: true });
    const newStat = await provider.stat(_uri.codeUri);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(file.uri, 'Error occurred while writing file content.');
  }

  async move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat> {
    const _sourceUri = this.getUri(sourceUri);
    const _targetUri = this.getUri(targetUri);

    const provider = await this.getProvider(_sourceUri.scheme);
    const result:any = await provider.rename(_sourceUri.codeUri, _targetUri.codeUri, { overwrite: !!(options && options.overwrite)});

    if (result) {
      return result;
    }
    return await provider.stat(_targetUri.codeUri);
  }

  async copy(
    sourceUri: string,
    targetUri: string,
    options?: FileCopyOptions
  ): Promise<FileStat> {
    const _sourceUri = this.getUri(sourceUri);
    const _targetUri = this.getUri(targetUri);
    const provider = await this.getProvider(_sourceUri.scheme);
    const overwrite = this.doGetOverwrite(options);

    if (!isFunction(provider.copy)) {
      throw this.getErrorProvideNotSupport(_sourceUri.scheme, 'copy');
    }

    const result: any = await provider.copy(
      _sourceUri.codeUri,
      _targetUri.codeUri,
      {
        overwrite: !!overwrite,
      })

    if(result) {
      return result;
    }
    return await provider.stat(_targetUri.codeUri);
  }

  async createFile(uri: string, options: FileCreateOptions = {}): Promise<FileStat> {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);

    const content = await this.doGetContent(options);
    const encoding = await this.doGetEncoding(options);
    let newStat: any = await provider.writeFile(_uri.codeUri, encode(content, encoding), {
      create: true,
      overwrite: options.overwrite || false,
    });
    newStat = newStat || await provider.stat(_uri.codeUri);
    if (newStat) {
      return newStat;
    }
    throw FileSystemError.FileNotFound(uri, 'Error occurred while creating the file.');
  }

  async createFolder(uri: string): Promise<FileStat> {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);

    const result = await provider.createDirectory(_uri.codeUri);

    if (result) {
      return result;
    }

    return provider.stat(_uri.codeUri);
  }

  /**
   * @param {string} uri
   * @param {FileDeleteOptions} [options] Only support scheme `file`
   * @returns {Promise<void>}
   * @memberof FileService
   */
  async delete(uri: string, options?: FileDeleteOptions): Promise<void> {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);

    const stat = await provider.stat(_uri.codeUri);
    if (!stat) {
      throw FileSystemError.FileNotFound(uri);
    }

    await (provider as any).delete(_uri.codeUri, {
      recursive: true,
      moveToTrash: this.doGetMoveToTrash(options)
    });
  }

  async access(uri: string, mode: number = FileAccess.Constants.F_OK): Promise<boolean> {
    const _uri = this.getUri(uri);
    const provider = await this.getProvider(_uri.scheme);

    if (!isFunction(provider.access)) {
      throw this.getErrorProvideNotSupport(_uri.scheme, 'access');
    }
    return await provider.access(uri, mode);
  }

  /**
   * Only support scheme `file`
   * @param {string} uri
   * @returns {Promise<string>}
   * @memberof FileService
   */
  async getEncoding(uri: string): Promise<string> {
    const _uri = this.getUri(uri);
    if (_uri.scheme !== Schemas.file) {
      console.warn(`Only support scheme file!, will return UTF8!`);
      return UTF8;
    }
    const provider = await this.getProvider(_uri.scheme);
    const stat = await provider.stat(_uri.codeUri);
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
    const root = await (await this.getProvider(Schemas.file)).stat(rootUri.codeUri);
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

  /**
   *
   * Only support scheme `file`
   */
  async getFsPath(uri: string): Promise<string | undefined> {
    if (!uri.startsWith('file:/')) {
      return undefined;
    } else {
      return FileUri.fsPath(uri);
    }
  }

  async getFileType(uri: string): Promise<string|undefined>{
    try {
      if (!uri.startsWith('file:/')) {
        return this._getFileType('');
      }
      // const lstat = await fs.lstat(FileUri.fsPath(uri));
      const stat = await fs.stat(FileUri.fsPath(uri));

      let ext: string = '';
      if(!stat.isDirectory()){

        // if(lstat.isSymbolicLink){

        // }else {
          if(stat.size) {
            const type = await fileType.stream(fs.createReadStream(FileUri.fsPath(uri)));
            // 可以拿到 type.fileType 说明为二进制文件
            if(type.fileType){
              ext = type.fileType.ext;
            }
          }
          return this._getFileType(ext);
        // }
      }else {
        return 'directory';
      }
    }catch (error) {
      if (isErrnoException(error)) {
        if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EBUSY' || error.code === 'EPERM') {
          return undefined;
        }
      }
    }

  }

  getUri(uri: string | Uri): URI {
    const _uri = new URI(uri)

    if (!_uri.scheme) {
      throw new Error(`没有设置 scheme: ${uri}`)
    }

    return _uri;
  }

  /**
   * Current policy: sends * all * Provider onDidChangeFile events to * all * clients and listeners
   */
  fireFilesChange(e: FileChangeEvent) {
    this.onFileChangedEmitter.fire({
      changes: e,
    });
      if (this.rpcClient) {
      this.rpcClient.forEach((client) => {
        client.onDidFilesChanged({
          changes: e
        });
      });
    }
  }

  dispose(): void {
    this.toDisposable.dispose();
  }

  // Protected or private

  private isExclude(uriString: string) {
    return this.filesExcludesMatcherList.some((matcher) => {
      return matcher(uriString);
    });
  }

  private filterStat(stat?: FileStat) {
    if (!stat) {
      return;
    }
    if (this.isExclude(stat.uri)) {
      return;
    }

    if (stat.children) {
      stat.children = this.filterStatChildren(stat.children);
    }
    
    return stat;
  }

  private filterStatChildren(children: FileStat[]) {
    const list: FileStat[] = [];

    children.forEach((child) => {
      if (this.isExclude(child.uri)) {
        return false;
      }
      const state = this.filterStat(child);
      if (state) {
        list.push(state);
      }
    });

    return list;
  }

  private getNodeBuffer(asBuffer: any): Buffer {
    if(Buffer.isBuffer(asBuffer)) {
      return asBuffer;
    }
    if (isArray(asBuffer)) {
      return Buffer.from(asBuffer);
    }
    if (asBuffer && isArray(asBuffer.data)) {
      return Buffer.from(asBuffer.data);
    }
    if (!asBuffer ||  isEmptyObject(asBuffer)) {
      return Buffer.from([]);
    }
    return asBuffer;
  }

  private getErrorProvideNotSupport(scheme: string, funName: string): string {
    return `Scheme ${scheme} not support this function: ${funName}.`
  }

  private initProvider() {
    this.registerProvider(Schemas.file, new DiskFileSystemProvider());
    this.registerProvider('debug', new ShadowFileSystemProvider());
  }

  private async getProvider(scheme: string): Promise<FileSystemProvider> {
    let provider: FileSystemProvider | void = this.fileSystemManage.get(scheme);

    if (!provider) {
      // Try Init extensionFileSystemManage, if fail will return void!
      if (!this.extensionFileSystemManage) {
        if (this.rpcClient && this.rpcClient[0]) {
          this.extensionFileSystemManage = new ExtensionFileSystemManage(this.rpcClient![0]);
        }
      }
      if (this.extensionFileSystemManage) {
        provider = await this.extensionFileSystemManage.get(scheme);
      }
    }

    if (!provider) {
      throw new Error( `Not find ${scheme} provider.`);
    }
    return provider;
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

  private _getFileType(ext){
    let type = 'text'

    if(['png', 'gif', 'jpg', 'jpeg', 'svg'].indexOf(ext) !== -1){
      type = 'image'
    } else if(ext && ['xml'].indexOf(ext) === -1){
      type = 'binary'
    }

    return type
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

}

// tslint:disable-next-line:no-any
function isErrnoException(error: any | NodeJS.ErrnoException): error is NodeJS.ErrnoException {
  return (error as NodeJS.ErrnoException).code !== undefined && (error as NodeJS.ErrnoException).errno !== undefined;
}