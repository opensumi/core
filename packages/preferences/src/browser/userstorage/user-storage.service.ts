
import { Injectable, Autowired } from '@opensumi/di';
import {
  DisposableCollection,
  ILogger,
  Emitter,
  URI,
  AppConfig,
  Uri,
  FileType,
  FileChangeEvent,
} from '@opensumi/ide-core-browser';
import { Event, FileSystemProviderCapabilities } from '@opensumi/ide-core-common';
import { FileSetContentOptions } from '@opensumi/ide-file-service/lib/common';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';

import { USER_STORAGE_SCHEME, IUserStorageService } from '../../common';

export const DEFAULT_USER_STORAGE_FOLDER = '.sumi';

@Injectable()
export class UserStorageServiceImpl implements IUserStorageService {
  capabilities: FileSystemProviderCapabilities = FileSystemProviderCapabilities.FileReadWrite;
  onDidChangeCapabilities = Event.None;
  /**
   * 基于用户存储路径创建文件路径
   * @param userStorageFolderUri 存储目录路径，如 file://{home}/
   * @param fsPath 文件系统路径
   */
  public static toUserStorageUri(userStorageFolderUri: URI, rawUri: URI): URI {
    const userStorageRelativePath = this.getRelativeUserStoragePath(userStorageFolderUri, rawUri);
    return new URI('')
      .withScheme(USER_STORAGE_SCHEME)
      .withPath(userStorageRelativePath)
      .withFragment(rawUri.fragment)
      .withQuery(rawUri.query);
  }

  /**
   * 返回相对存储路径
   * 如传入 'file://{path_to_userhome}/.sumi', 'file://{path_to_userhome}/.sumi/settings.json',
   * 则返回 'settings.json'
   * @param userStorageFolderUri 存储目录路径，如 file://{path_to_userhome}/
   * @param fileUri 文件路径
   */
  private static getRelativeUserStoragePath(userStorageFolderUri: URI, fileUri: URI): string {
    // 返回虚拟用户协议下的路径，去掉头部的/，如返回settings.json而不是/settings.json
    return fileUri.toString().slice(userStorageFolderUri.toString().length + 1);
  }

  /**
   * 返回用户路径下的文件绝对路径
   * @param userStorageFolderUri 存储目录路径，如 file://{home}/.sumi
   * @param userStorageUri 存储文件路径，如 file://{home}/.sumi/settings.json
   */
  public static toFilesystemURI(userStorageFolderUri: URI, userStorageUri: URI): URI {
    return userStorageFolderUri.withPath(userStorageFolderUri.path.join(userStorageUri.path.toString()));
  }

  protected readonly toDispose = new DisposableCollection();
  protected readonly onDidChangeFileEmitter = new Emitter<FileChangeEvent>();
  private _whenReady: Promise<void>;
  private userStorageFolder: URI;

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;
  @Autowired(ILogger)
  protected readonly logger: ILogger;
  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  constructor() {
    this._whenReady = this.init();
  }

  get whenReady() {
    return this._whenReady;
  }

  get onDidChangeFile() {
    return this.onDidChangeFileEmitter.event;
  }

  async init() {
    // 请求用户路径并存储
    const home = await this.fileServiceClient.getCurrentUserHome();
    if (home) {
      const userStorageFolderUri = new URI(home.uri).resolve(
        this.appConfig.userPreferenceDirName || this.appConfig.preferenceDirName || DEFAULT_USER_STORAGE_FOLDER,
      );
      if (!(await this.fileServiceClient.access(userStorageFolderUri.toString()))) {
        await this.fileServiceClient.createFolder(userStorageFolderUri.toString());
      }
      this.userStorageFolder = userStorageFolderUri;
    }
    this.toDispose.push(this.onDidChangeFileEmitter);
  }

  readDirectory(uri: Uri): [string, FileType][] | Promise<[string, FileType][]> {
    throw new Error('Method not implemented.');
  }

  createDirectory(uri: Uri) {
    throw new Error('Method not implemented.');
  }

  async watch(
    uri: Uri,
    options: { recursive: boolean; excludes: string[] } = { recursive: false, excludes: ['**/logs/**'] },
  ) {
    await this.whenReady;
    const target = UserStorageServiceImpl.toFilesystemURI(this.userStorageFolder, URI.from(uri));
    const watcher = await this.fileServiceClient.watchFileChanges(target.parent, options.excludes);
    this.toDispose.push(watcher);
    this.toDispose.push(
      watcher.onFilesChanged((changes) => {
        const effectedChanges: FileChangeEvent = [];
        for (const change of changes) {
          // 在UserStorage的监听模式下，只会存在一个独立的 Change 事件
          // 故在获取到变更事件时直接推出遍历
          if (change.uri === target.toString()) {
            effectedChanges.push(change);
          }
        }
        if (effectedChanges.length > 0) {
          this.onDidChangeFileEmitter.fire(
            effectedChanges.map((change) => ({
              uri: UserStorageServiceImpl.toUserStorageUri(this.userStorageFolder, new URI(change.uri)).toString(),
              type: change.type,
            })),
          );
        }
      }),
    );
    return watcher.watchId;
  }

  async readFile(uri: Uri) {
    await this.whenReady;
    const target = UserStorageServiceImpl.toFilesystemURI(this.userStorageFolder, URI.from(uri));
    try {
      const { content } = await this.fileServiceClient.readFile(target.toString());
      return content.buffer;
    } catch (e) {
      throw new Error(e);
    }
  }

  async writeFile(uri: Uri, content: Uint8Array, options?: FileSetContentOptions) {
    await this.whenReady;
    const target = UserStorageServiceImpl.toFilesystemURI(this.userStorageFolder, URI.from(uri));
    try {
      let fileStat = await this.fileServiceClient.getFileStat(target.toString());
      if (fileStat) {
        await this.fileServiceClient.setContent(fileStat, content, options);
      } else {
        fileStat = await this.fileServiceClient.createFile(target.toString());
        await this.fileServiceClient.setContent(fileStat, content, options);
      }
    } catch (e) {
      throw new Error(e);
    }
  }

  delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean }) {
    throw new Error('Method not implemented.');
  }

  rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }) {
    throw new Error('Method not implemented.');
  }

  copy(source: Uri, destination: Uri, options: { overwrite: boolean }) {
    throw new Error('Method not implemented.');
  }

  async stat(uri: Uri) {
    await this.whenReady;
    const target = UserStorageServiceImpl.toFilesystemURI(this.userStorageFolder, URI.from(uri));
    const stat = await this.fileServiceClient.getFileStat(target.toString());
    if (stat) {
      return stat;
    }
  }

  async access(uri: Uri, mode: number) {
    await this.whenReady;
    const target = UserStorageServiceImpl.toFilesystemURI(this.userStorageFolder, URI.from(uri));
    return this.fileServiceClient.access(target.toString(), mode);
  }
}
