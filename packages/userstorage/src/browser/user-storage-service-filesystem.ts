
import { DisposableCollection, ILogger, Emitter, Event, URI } from '@ali/ide-core-browser';
import { UserStorageChangeEvent, UserStorageService } from './user-storage-service';
import { Injectable, Autowired } from '@ali/common-di';
import { UserStorageUri } from './user-storage-uri';
import { FileServiceWatcherClient } from '@ali/ide-file-service/lib/browser/file-service-watcher-client';
import { FileChangeEvent } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';

export const THEIA_USER_STORAGE_FOLDER = '.theia';

@Injectable()
export class UserStorageServiceFilesystemImpl implements UserStorageService {

  protected readonly toDispose = new DisposableCollection();
  protected readonly onUserStorageChangedEmitter = new Emitter<UserStorageChangeEvent>();
  protected readonly userStorageFolder: Promise<URI | undefined>;

  @Autowired(FileServiceClient)
  protected readonly fileSystem: FileServiceClient;
  @Autowired(FileServiceWatcherClient)
  protected readonly watcher: FileServiceWatcherClient;
  @Autowired(ILogger)
  protected readonly logger: ILogger;

  constructor() {
    this.userStorageFolder = this.fileSystem.getCurrentUserHome().then((home) => {
      if (home) {
        const userStorageFolderUri = new URI(home.uri).resolve(THEIA_USER_STORAGE_FOLDER);
        this.fileSystem.watchFileChanges(userStorageFolderUri).then((disposable) =>
          this.toDispose.push(disposable),
        );
        this.toDispose.push(this.fileSystem.onFilesChanged((changes) => this.onDidFilesChanged(changes)));
        return new URI(home.uri).resolve(THEIA_USER_STORAGE_FOLDER);
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
          const changeUri = URI.file(change.uri);
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
   * Creates a new user storage URI from the filesystem URI.
   * @param userStorageFolderUri User storage folder URI
   * @param fsPath The filesystem URI
   */
  public static toUserStorageUri(userStorageFolderUri: URI, rawUri: URI): URI {
    const userStorageRelativePath = this.getRelativeUserStoragePath(userStorageFolderUri, rawUri);
    return new URI('').withScheme(UserStorageUri.SCHEME).withPath(userStorageRelativePath).withFragment(rawUri.fragment).withQuery(rawUri.query);
  }

  /**
   * Returns the path relative to the user storage filesystem uri i.e if the user storage root is
   * 'file://home/user/.theia' and the fileUri is 'file://home/user.theia/keymaps.json' it will return 'keymaps.json'
   * @param userStorageFolderUri User storage folder URI
   * @param fileUri User storage
   */
  private static getRelativeUserStoragePath(userStorageFolderUri: URI, fileUri: URI): string {
    /* + 1 so that it removes the beginning slash  i.e return keymaps.json and not /keymaps.json */
    return fileUri.toString().slice(userStorageFolderUri.toString().length + 1);
  }

  /**
   * Returns the associated filesystem URI relative to the user storage folder passed as argument.
   * @param userStorageFolderUri User storage folder URI
   * @param userStorageUri User storage URI to be converted in filesystem URI
   */
  public static toFilesystemURI(userStorageFolderUri: URI, userStorageUri: URI): URI {
    return userStorageFolderUri.withPath(userStorageFolderUri.path.join(userStorageUri.path.toString()));
  }
}
