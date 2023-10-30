import fs, { watch } from 'fs-extra';
import debounce from 'lodash/debounce';

import { Injectable, Optional, Autowired } from '@opensumi/di';
import {
  FileUri,
  ILogService,
  ILogServiceManager,
  SupportLogNamespace,
  IDisposable,
  Disposable,
  DisposableCollection,
  isMacintosh,
} from '@opensumi/ide-core-node';
import { path } from '@opensumi/ide-core-node';

import { FileChangeType, FileSystemWatcherClient, IFileSystemWatcherServer } from '../../common/index';
import { FileChangeCollection } from '../file-change-collection';
const { join, basename, normalize } = path;
@Injectable({ multiple: true })
export class UnRecursiveFileSystemWatcher implements IFileSystemWatcherServer {
  private WATCHER_HANDLERS = new Map<
    number,
    {
      path: string;
      handlers: any;
      disposable: IDisposable;
    }
  >();

  private static WATCHER_SEQUENCE = 1;

  private static readonly FILE_DELETE_HANDLER_DELAY = 500;

  @Autowired(ILogServiceManager)
  // 一个 symbol 关键字，内容是 ILogServiceManager
  private readonly loggerManager: ILogServiceManager;

  // 收集发生改变的文件
  protected changes = new FileChangeCollection();

  protected readonly toDispose = new DisposableCollection(Disposable.create(() => this.setClient(undefined)));

  protected client: FileSystemWatcherClient | undefined;

  private logger: ILogService;

  constructor(@Optional() private readonly excludes: string[] = []) {
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  dispose(): void {
    this.toDispose.dispose();
    this.WATCHER_HANDLERS.clear();
  }

  /**
   * 查找某个路径是否已被监听
   * @param watcherPath
   */
  checkIsAlreadyWatched(watcherPath: string): number | undefined {
    for (const [watcherId, watcher] of this.WATCHER_HANDLERS) {
      if (watcherPath.indexOf(watcher.path) === 0) {
        return watcherId;
      }
    }
  }

  private async doWatch(basePath: string) {
    try {
      const watcher = watch(basePath);
      this.logger.log('start watching', basePath);
      const isDirectory = fs.lstatSync(basePath).isDirectory();

      const docChildren = new Set<string>();
      let signalDoc = '';
      if (isDirectory) {
        try {
          for (const child of fs.readdirSync(basePath)) {
            const base = join(basePath, String(child));
            if (!fs.lstatSync(base).isDirectory()) {
              docChildren.add(child);
            }
          }
        } catch (error) {
          this.logger.error(error);
        }
      } else {
        signalDoc = basename(basePath);
      }

      // 开始走监听流程
      watcher.on('error', (code: number, signal: string) => {
        this.logger.error(`Failed to watch ${basePath} for changes using fs.watch() (${code}, ${signal})`);
        watcher.close();
      });

      watcher.on('change', (type: string, filename: string | Buffer) => {
        if (this.isTemporaryFile(filename as string)) {
          return;
        }

        // 对传入的raw做一个统一处理
        let changeFileName = '';
        if (filename) {
          changeFileName = filename as string;
          if (isMacintosh) {
            changeFileName = normalize(changeFileName);
          }
        }
        if (!filename || (type !== 'change' && type !== 'rename')) {
          return;
        }

        const changePath = join(basePath, changeFileName);
        if (isDirectory) {
          setTimeout(async () => {
            // 监听的目录如果是文件夹，那么只对其下面的文件改动做出响应
            if (docChildren.has(changeFileName)) {
              if ((type === 'rename' || type === 'change') && changeFileName === filename) {
                const fileExists = fs.existsSync(changePath);
                if (fileExists) {
                  this.pushUpdated(changePath);
                } else {
                  docChildren.delete(changeFileName);
                  this.pushDeleted(changePath);
                }
              }
            } else if (fs.pathExistsSync(changePath)) {
              if (!fs.lstatSync(changePath).isDirectory()) {
                this.pushAdded(changePath);
                docChildren.add(changeFileName);
              }
            }
          }, UnRecursiveFileSystemWatcher.FILE_DELETE_HANDLER_DELAY);
        } else {
          setTimeout(async () => {
            if (changeFileName === signalDoc) {
              if (fs.pathExistsSync(basePath)) {
                this.pushUpdated(basePath);
              } else {
                this.pushDeleted(basePath);
                signalDoc = '';
              }
            }
          }, UnRecursiveFileSystemWatcher.FILE_DELETE_HANDLER_DELAY);
        }
      });
    } catch (error) {
      this.logger.error(`Failed to watch ${basePath} for change using fs.watch() (${error.toString()})`);
    }
  }

  async watchFileChanges(uri: string) {
    const basePath = FileUri.fsPath(uri);
    const exist = await fs.pathExists(basePath);

    let watcherId = this.checkIsAlreadyWatched(basePath);

    if (watcherId) {
      return watcherId;
    }

    watcherId = UnRecursiveFileSystemWatcher.WATCHER_SEQUENCE++;

    const disposables = new DisposableCollection(); // 管理可释放的资源

    let watchPath = '';

    if (exist) {
      const stat = await fs.lstatSync(basePath);
      if (stat) {
        watchPath = basePath;
      }
    } else {
      this.logger.warn('This path does not exist. Please try again');
    }
    disposables.push(await this.start(watchPath));
    this.toDispose.push(disposables);
    return watcherId;
  }

  protected async start(basePath: string): Promise<DisposableCollection> {
    const disposables = new DisposableCollection();
    if (!(await fs.pathExists(basePath))) {
      return disposables;
    }

    const realPath = await fs.realpath(basePath);
    const tryWatchDir = async (retryDelay = 1000) => {
      try {
        this.doWatch(realPath);
      } catch (error) {
        await new Promise((resolve) => {
          setTimeout(resolve, retryDelay);
        });
      }
      return undefined;
    };
    await tryWatchDir();
    return disposables;
  }
  unwatchFileChanges(watcherId: number): Promise<void> {
    const watcher = this.WATCHER_HANDLERS.get(watcherId);
    if (watcher) {
      this.WATCHER_HANDLERS.delete(watcherId);
      watcher.disposable.dispose();
    }
    return Promise.resolve();
  }

  protected pushAdded(path: string): void {
    this.pushFileChange(path, FileChangeType.ADDED);
  }

  protected pushUpdated(path: string): void {
    this.pushFileChange(path, FileChangeType.UPDATED);
  }

  protected pushDeleted(path: string): void {
    this.pushFileChange(path, FileChangeType.DELETED);
  }

  protected pushFileChange(path: string, type: FileChangeType): void {
    const uri = FileUri.create(path).toString();
    this.changes.push({ uri, type });
    this.fireDidFilesChanged();
  }

  /**
   * Fires file changes to clients.
   * It is debounced in the case if the filesystem is spamming to avoid overwhelming clients with events.
   */
  protected readonly fireDidFilesChanged: () => void = debounce(() => this.doFireDidFilesChanged(), 100);

  protected doFireDidFilesChanged(): void {
    const changes = this.changes.values();
    this.changes = new FileChangeCollection();
    const event = { changes };
    if (this.client) {
      this.client.onDidFilesChanged(event);
    }
  }

  setClient(client: FileSystemWatcherClient | undefined) {
    if (client && this.toDispose.disposed) {
      return;
    }
    this.client = client;
  }

  protected isTemporaryFile(path: string): boolean {
    if (path) {
      if (/\.\d{7}\d+$/.test(path)) {
        // write-file-atomic 源文件xxx.xx 对应的临时文件为 xxx.xx.22243434
        // 这类文件的更新应当完全隐藏掉
        return true;
      }
    }
    return false;
  }
}
