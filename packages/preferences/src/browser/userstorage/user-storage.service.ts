
import { DisposableCollection, ILogger, Emitter, Event, URI, AppConfig } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { USER_STORAGE_SCHEME, UserStorageChangeEvent, IUserStorageService } from '../../common';
import { FileChangeEvent } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';

export const DEFAULT_USER_STORAGE_FOLDER = '.kaitian';

@Injectable()
export class UserStorageServiceImpl implements IUserStorageService {

  protected readonly toDispose = new DisposableCollection();
  protected readonly onUserStorageChangedEmitter = new Emitter<UserStorageChangeEvent>();
  protected readonly userStorageFolder: Promise<URI | undefined>;

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;
  @Autowired(ILogger)
  protected readonly logger: ILogger;
  @Autowired(AppConfig)
  protected readonly appConfig: AppConfig;

  constructor() {
    // 请求用户路径并存储
    this.userStorageFolder = this.fileServiceClient.getCurrentUserHome().then((home) => {
      if (home) {
        const userStorageFolderUri = new URI(home.uri).resolve(this.appConfig.preferenceDirName || DEFAULT_USER_STORAGE_FOLDER);
        this.fileServiceClient.watchFileChanges(userStorageFolderUri, ['**/logs/**']).then((disposable) =>
          this.toDispose.push(disposable),
        );
        this.toDispose.push(this.fileServiceClient.onFilesChanged((changes) => this.onDidFilesChanged(changes)));
        return new URI(home.uri).resolve(this.appConfig.preferenceDirName || DEFAULT_USER_STORAGE_FOLDER);
      }
    });

    this.toDispose.push(this.onUserStorageChangedEmitter);

  }

  dispose(): void {
    this.toDispose.dispose();
  }

  protected onDidFilesChanged(event: FileChangeEvent): void {
    const uris: URI[] = [];
    this.userStorageFolder.then((folder) => {
      if (folder) {
        for (const change of event) {
          const changeUri = new URI(change.uri);
          if (folder.isEqualOrParent(changeUri)) {
            const userStorageUri = UserStorageServiceImpl.toUserStorageUri(folder, changeUri);
            uris.push(userStorageUri);
          }
        }
        if (uris.length > 0) {
          this.onUserStorageChangedEmitter.fire({ uris });
        }
      }
    });
  }

  async readContents(uri: URI): Promise<string> {
    const folderUri = await this.userStorageFolder;
    if (folderUri) {
      const filesystemUri = UserStorageServiceImpl.toFilesystemURI(folderUri, uri);
      const exists = await this.fileServiceClient.access(filesystemUri.toString());

      if (exists) {
        return this.fileServiceClient.resolveContent(filesystemUri.toString()).then(({ content }) => content);
      }
    }
    return '';
  }

  async saveContents(uri: URI, content: string): Promise<void> {
    const folderUri = await this.userStorageFolder;
    if (!folderUri) {
      return;
    }
    const filesystemUri = UserStorageServiceImpl.toFilesystemURI(folderUri, uri);

    const fileStat = await this.fileServiceClient.getFileStat(filesystemUri.toString());
    if (fileStat) {
      this.fileServiceClient.setContent(fileStat, content).then(() => Promise.resolve());
    } else {
      this.fileServiceClient.createFile(filesystemUri.toString(), { content });
    }
  }

  async getFsPath(uri: URI) {
    const folderUri = await this.userStorageFolder;
    if (folderUri) {
      const filesystemUri = UserStorageServiceImpl.toFilesystemURI(folderUri, uri);
      return filesystemUri.toString();
    }
    return undefined;
  }

  get onUserStorageChanged(): Event<UserStorageChangeEvent> {
    return this.onUserStorageChangedEmitter.event;
  }

  /**
   * 基于用户存储路径创建文件路径
   * @param userStorageFolderUri 存储目录路径，如 file://home/user/
   * @param fsPath 文件系统路径
   */
  public static toUserStorageUri(userStorageFolderUri: URI, rawUri: URI): URI {
    const userStorageRelativePath = this.getRelativeUserStoragePath(userStorageFolderUri, rawUri);
    return new URI('').withScheme(USER_STORAGE_SCHEME).withPath(userStorageRelativePath).withFragment(rawUri.fragment).withQuery(rawUri.query);
  }

  /**
   * 返回相对存储路径
   * 如传入 'file://home/user/.kaitian', 'file://home/user.kaitian/settings.json',
   * 则返回 'settings.json'
   * @param userStorageFolderUri 存储目录路径，如 file://home/user/
   * @param fileUri 文件路径
   */
  private static getRelativeUserStoragePath(userStorageFolderUri: URI, fileUri: URI): string {
    // 返回虚拟用户协议下的路径，去掉头部的/，如返回settings.json而不是/settings.json
    return fileUri.toString().slice(userStorageFolderUri.toString().length + 1);
  }

  /**
   * 返回用户路径下的文件绝对路径
   * @param userStorageFolderUri 存储目录路径，如 file://home/user/.kaitian
   * @param userStorageUri 存储文件路径，如 file://home/user/.kaitian/settings.json
   */
  public static toFilesystemURI(userStorageFolderUri: URI, userStorageUri: URI): URI {
    return userStorageFolderUri.withPath(userStorageFolderUri.path.join(userStorageUri.path.toString()));
  }
}
