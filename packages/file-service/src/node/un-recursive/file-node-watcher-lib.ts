import paths from 'path';

import fs, { watch } from 'fs-extra';
import debounce from 'lodash/debounce';

import { Injectable, Optional, Autowired } from '@opensumi/di';
import {
  FileUri,
  ParsedPattern,
  ILogService,
  ILogServiceManager,
  SupportLogNamespace,
  IDisposable,
  Disposable,
  DisposableCollection,
  isLinux,
  isMacintosh,
} from '@opensumi/ide-core-node';

import { join, basename } from '../../../../utils/src/path';
import { FileChangeType, FileSystemWatcherClient, IFileSystemWatcherServer } from '../../common/index';
import { FileChangeCollection } from '../file-change-collection';

export interface UnRecursiveEvent {
  path: string;
  type: 'added' | 'updated' | 'deleted';
}

export type UnRecursiveCallback = (err: Error | null, events: Event[]) => unknown;

export interface WatcherOptions {
  excludesPattern: ParsedPattern[];
  excludes: string[];
}

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

  protected watcherOptions = new Map<number, WatcherOptions>();

  private static readonly FILE_DELETE_HANDLER_DELAY = 10;

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

      // 目录下面的所有文件
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

      watcher.on('change', (type, raw) => {
        // 对传入的raw做一个统一处理
        let changeFileName = '';
        if (raw) {
          changeFileName = this.deleteFileNumberSuffix(raw as string);
          if (isMacintosh) {
            changeFileName = this.deleteFileNumberSuffix(fs.realpathSync.native(changeFileName));
          }
        }

        if (!raw || (type !== 'change' && type !== 'rename')) {
          return;
        }

        const changePath = join(basePath, changeFileName);
        if (isDirectory) {
          const timeoutHandle = setTimeout(async () => {
            // 监听的目录如果是文件夹，那么只对其下面的文件改动做出响应
            if (docChildren.has(changeFileName)) {
              if (type === 'rename') {
                const fileExists = await fs.pathExists(changePath);
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
          timeoutHandle;
        } else {
          const timeOutHandle = setTimeout(async () => {
            if (changeFileName === signalDoc) {
              if (fs.pathExistsSync(basePath)) {
                this.pushUpdated(basePath);
              } else {
                this.pushDeleted(basePath);
                signalDoc = '';
              }
            } else {
              if (basename(basePath) === changeFileName) {
                this.pushAdded(basePath);
                signalDoc = changeFileName;
              }
            }
          }, UnRecursiveFileSystemWatcher.FILE_DELETE_HANDLER_DELAY);
          timeOutHandle;
        }
      });
    } catch (error) {
      this.logger.error(`Failed to watch ${basePath} for change using fs.watch() (${error.toString()})`);
    }
  }

  /**
   * @param uri
   * @param options
   */
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
      this.logger.warn('此路径不存在，请重新开始');
    }
    disposables.push(await this.start(watchPath));
    this.toDispose.push(disposables);
    return watcherId;
  }

  /**
   * 过滤 `write-file-atomic` 写入生成的临时文件
   * @param events
   */
  protected trimChangeEvent(events: UnRecursiveEvent[]): UnRecursiveEvent[] {
    events = events.filter((event: UnRecursiveEvent) => {
      if (event.path) {
        if (/\.\d{7}\d+$/.test(event.path)) {
          // write-file-atomic 源文件xxx.xx 对应的临时文件为 xxx.xx.22243434
          // 这类文件的更新应当完全隐藏掉
          return false;
        }
      }
      return true;
    });

    return events;
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

  protected resolvePath(directory: string, file: string): string {
    const path = paths.join(directory, file);
    // 如果是 linux 则获取一下真实 path，以防返回的是软连路径被过滤
    if (isLinux) {
      try {
        return fs.realpathSync.native(path);
      } catch (_e) {
        try {
          // file does not exist try to resolve directory
          return paths.join(fs.realpathSync.native(directory), file);
        } catch (_e) {
          // directory does not exist fall back to symlink
          return path;
        }
      }
    }
    return path;
  }
  protected deleteFileNumberSuffix(fileName: string): string {
    const cleanFileName = fileName.replace(/\.\d+$/, '');
    return cleanFileName;
  }
}
