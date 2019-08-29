
import { DisposableCollection, ILogger, Emitter, Event, URI } from '@ali/ide-core-browser';
import { UserStorageChangeEvent, UserStorageService } from './user-storage-service';
import { Injectable, Autowired } from '@ali/common-di';
import { UserStorageUri } from './user-storage-uri';
import { FileChangeEvent } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';

export const KAITIAN_USER_STORAGE_FOLDER = '.kaitian';

@Injectable()
export class UserStorageServiceFilesystemImpl implements UserStorageService {

  protected readonly toDispose = new DisposableCollection();
  protected readonly onUserStorageChangedEmitter = new Emitter<UserStorageChangeEvent>();
  protected readonly userStorageFolder: Promise<URI | undefined>;

  @Autowired(IFileServiceClient)
  protected readonly fileSystem: IFileServiceClient;
  @Autowired(ILogger)
  protected readonly logger: ILogger;

  constructor() {
    // 请求用户路径并存储
    this.userStorageFolder = this.fileSystem.getCurrentUserHome().then((home) => {
      if (home) {
        const userStorageFolderUri = new URI(home.uri).resolve(KAITIAN_USER_STORAGE_FOLDER);
        this.fileSystem.watchFileChanges(userStorageFolderUri).then((disposable) =>
          this.toDispose.push(disposable),
        );
        this.toDispose.push(this.fileSystem.onFilesChanged((changes) => this.onDidFilesChanged(changes)));
        return new URI(home.uri).resolve(KAITIAN_USER_STORAGE_FOLDER);
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
            const userStorageUri = UserStorageServiceFilesystemImpl.toUserStorageUri(folder, changeUri);
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
      const filesystemUri = UserStorageServiceFilesystemImpl.toFilesystemURI(folderUri, uri);
      const exists = await this.fileSystem.exists(filesystemUri.toString());

      if (exists) {
        return this.fileSystem.resolveContent(filesystemUri.toString()).then(({ stat, content }) => content);
      }
    }
    return '';
  }

  async saveContents(uri: URI, content: string): Promise<void> {
    const folderUri = await this.userStorageFolder;
    if (!folderUri) {
      return;
    }
    const filesystemUri = UserStorageServiceFilesystemImpl.toFilesystemURI(folderUri, uri);

    const fileStat = await this.fileSystem.getFileStat(filesystemUri.toString());
    if (fileStat) {
      this.fileSystem.setContent(fileStat, content).then(() => Promise.resolve());
    } else {
      this.fileSystem.createFile(filesystemUri.toString(), { content });
    }
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
    return new URI('').withScheme(UserStorageUri.SCHEME).withPath(userStorageRelativePath).withFragment(rawUri.fragment).withQuery(rawUri.query);
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
