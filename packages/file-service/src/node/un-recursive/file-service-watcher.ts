import fs, { watch } from 'fs-extra';
import debounce from 'lodash/debounce';
import groupBy from 'lodash/groupBy';

import { Autowired, Injectable, Optional } from '@opensumi/di';
import {
  Disposable,
  DisposableCollection,
  FileUri,
  GDataStore,
  IDisposable,
  ILogService,
  ILogServiceManager,
  SupportLogNamespace,
  isMacintosh,
  path,
  sleep,
} from '@opensumi/ide-core-node';

import { FileChangeType, IFileSystemWatcherServer } from '../../common/index';
import { WatchInsData, fileChangeEvent } from '../data-store';
import { FileChangeCollection } from '../file-change-collection';
import { shouldIgnorePath } from '../shared';

const { join, basename, normalize } = path;
@Injectable({ multiple: true })
export class UnRecursiveFileSystemWatcher extends Disposable implements IFileSystemWatcherServer {
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
  private readonly loggerManager: ILogServiceManager;

  @GDataStore(WatchInsData, { id: 'watcherId' })
  private watcherGDataStore: GDataStore<WatchInsData, 'watcherId'>;

  // 收集发生改变的文件
  protected changes = new FileChangeCollection();

  private logger: ILogService;

  constructor(@Optional() private readonly excludes: string[] = []) {
    super();
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  dispose(): void {
    this.WATCHER_HANDLERS.clear();
    super.dispose();
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

  private async doWatch(basePath: string, watcherId: number) {
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
        if (shouldIgnorePath(filename as string)) {
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
                  this.pushUpdated(watcherId, changePath);
                } else {
                  docChildren.delete(changeFileName);
                  this.pushDeleted(watcherId, changePath);
                }
              }
            } else if (fs.pathExistsSync(changePath)) {
              if (!fs.lstatSync(changePath).isDirectory()) {
                this.pushAdded(watcherId, changePath);
                docChildren.add(changeFileName);
              }
            }
          }, UnRecursiveFileSystemWatcher.FILE_DELETE_HANDLER_DELAY);
        } else {
          setTimeout(async () => {
            if (changeFileName === signalDoc) {
              if (fs.pathExistsSync(basePath)) {
                this.pushUpdated(watcherId, basePath);
              } else {
                this.pushDeleted(watcherId, basePath);
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
      const stat = await fs.lstat(basePath);
      if (stat) {
        watchPath = basePath;
      }
    } else {
      this.logger.warn('This path does not exist. Please try again');
    }
    disposables.push(await this.start(watchPath, watcherId));
    this.addDispose(disposables);
    return watcherId;
  }

  protected async start(basePath: string, watcherId: number): Promise<DisposableCollection> {
    const disposables = new DisposableCollection();
    if (!(await fs.pathExists(basePath))) {
      return disposables;
    }

    const realPath = await fs.realpath(basePath);
    const tryWatchDir = async (retryDelay = 1000) => {
      try {
        await this.doWatch(realPath, watcherId);
      } catch (error) {
        await sleep(retryDelay);
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

  protected pushAdded(watcherId: number, path: string): void {
    this.pushFileChange(watcherId, path, FileChangeType.ADDED);
  }

  protected pushUpdated(watcherId: number, path: string): void {
    this.pushFileChange(watcherId, path, FileChangeType.UPDATED);
  }

  protected pushDeleted(watcherId: number, path: string): void {
    this.pushFileChange(watcherId, path, FileChangeType.DELETED);
  }

  protected pushFileChange(watcherId: number, path: string, type: FileChangeType): void {
    const uri = FileUri.create(path).toString();
    this.changes.push({ watcherId, uri, type });
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

    const data = groupBy(changes, 'watcherId');

    Object.keys(data).forEach((watcherId) => {
      this.watcherGDataStore.emit(fileChangeEvent(watcherId), data[watcherId]);
    });
  }
}
