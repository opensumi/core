import paths from 'path';

import ParcelWatcher from '@parcel/watcher';
import * as fs from 'fs-extra';
import debounce from 'lodash/debounce';

import { Injectable, Autowired, Optional } from '@opensumi/di';
import {
  FileUri,
  ParsedPattern,
  IDisposable,
  Disposable,
  DisposableCollection,
  isWindows,
  URI,
  isLinux,
  ILogService,
  SupportLogNamespace,
  ILogServiceManager,
} from '@opensumi/ide-core-node';

import { FileChangeType, FileSystemWatcherClient, IFileSystemWatcherServer, WatchOptions } from '../common';

import { FileChangeCollection } from './file-change-collection';

export interface WatcherOptions {
  excludesPattern: ParsedPattern[];
  excludes: string[];
}

@Injectable({ multiple: true })
export class ParcelWatcherServer implements IFileSystemWatcherServer {
  private static readonly PARCEL_WATCHER_BACKEND = isWindows ? 'windows' : isLinux ? 'inotify' : 'fs-events';

  private static WATCHER_HANDLERS = new Map<
    number,
    { path: string; handlers: ParcelWatcher.SubscribeCallback[]; disposable: IDisposable }
  >();
  private static WATCHER_SEQUENCE = 1;

  protected client: FileSystemWatcherClient | undefined;

  protected readonly toDispose = new DisposableCollection(Disposable.create(() => this.setClient(undefined)));

  protected changes = new FileChangeCollection();

  @Autowired(ILogServiceManager)
  private readonly loggerManager: ILogServiceManager;

  private logger: ILogService;

  constructor(@Optional() private readonly excludes: string[] = []) {
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  dispose(): void {
    this.toDispose.dispose();
    ParcelWatcherServer.WATCHER_HANDLERS.clear();
  }

  /**
   * 查找某个路径是否已被监听
   * @param watcherPath
   */
  checkIsAlreadyWatched(watcherPath: string): number | undefined {
    for (const [watcherId, watcher] of ParcelWatcherServer.WATCHER_HANDLERS) {
      if (watcherPath.indexOf(watcher.path) === 0) {
        return watcherId;
      }
    }
  }

  /**
   * 如果监听路径不存在，则会监听父目录
   * @param uri 要监听的路径
   * @param options
   * @returns
   */
  async watchFileChanges(uri: string, options?: WatchOptions): Promise<number> {
    const basePath = FileUri.fsPath(uri);
    const exist = await fs.pathExists(basePath);

    let watcherId = this.checkIsAlreadyWatched(basePath);
    if (watcherId) {
      return watcherId;
    }
    watcherId = ParcelWatcherServer.WATCHER_SEQUENCE++;
    const toDisposeWatcher = new DisposableCollection();
    let watchPath;
    if (exist) {
      const stat = await fs.lstatSync(basePath);
      if (stat && stat.isDirectory()) {
        watchPath = basePath;
      } else {
        watchPath = await this.lookup(basePath);
      }
    } else {
      watchPath = await this.lookup(basePath);
    }
    this.logger.log('Starting watching:', watchPath, options);
    const handler = (err, events: ParcelWatcher.Event[]) => {
      if (err) {
        this.logger.error(`Watching ${watchPath} error: `, err);
        return;
      }
      events = this.trimChangeEvent(events);
      for (const event of events) {
        if (event.type === 'create') {
          this.pushAdded(event.path);
        }
        if (event.type === 'delete') {
          this.pushDeleted(event.path);
        }
        if (event.type === 'update') {
          this.pushUpdated(event.path);
        }
      }
    };
    ParcelWatcherServer.WATCHER_HANDLERS.set(watcherId, {
      path: watchPath,
      disposable: toDisposeWatcher,
      handlers: [handler],
    });
    toDisposeWatcher.push(Disposable.create(() => ParcelWatcherServer.WATCHER_HANDLERS.delete(watcherId as number)));
    toDisposeWatcher.push(await this.start(watcherId, watchPath, options));
    this.toDispose.push(toDisposeWatcher);
    return watcherId;
  }

  /**
   * 向上查找存在的目录
   * 默认向上查找 5 层，避免造成较大的目录监听带来的性能问题
   * 当前框架内所有配置文件可能存在的路径层级均不超过 5 层
   * @param path 监听路径
   * @param count 向上查找层级
   */
  protected async lookup(path: string, count = 5) {
    let uri = new URI(path).parent;
    let times = 0;
    while (!(await fs.pathExists(uri.codeUri.fsPath)) && times < count) {
      uri = uri.parent;
      times++;
    }
    if (await fs.pathExists(uri.codeUri.fsPath)) {
      return uri.codeUri.fsPath;
    } else {
      return '';
    }
  }

  /**
   * 过滤 `write-file-atomic` 写入生成的临时文件
   * @param events
   */
  protected trimChangeEvent(events: ParcelWatcher.Event[]): ParcelWatcher.Event[] {
    events = events.filter((event: ParcelWatcher.Event) => {
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

  private getDefaultWatchExclude() {
    return ['**/.git/objects/**', '**/.git/subtree-cache/**', '**/node_modules/**/*', '**/.hg/store/**'];
  }

  protected async start(
    watcherId: number,
    basePath: string,
    rawOptions: WatchOptions | undefined,
  ): Promise<DisposableCollection> {
    const disposables = new DisposableCollection();
    if (!(await fs.pathExists(basePath))) {
      return disposables;
    }
    const realPath = await fs.realpath(basePath);
    const tryWatchDir = async (maxRetries = 3, retryDelay = 1000) => {
      for (let times = 0; times < maxRetries; times++) {
        try {
          return await ParcelWatcher.subscribe(
            realPath,
            (err, events: ParcelWatcher.Event[]) => {
              // 对于超过 5000 数量的 events 做屏蔽优化，避免潜在的卡死问题
              if (events.length > 5000) {
                // FIXME: 研究此处屏蔽的影响，考虑下阈值应该设置多少，或者更加优雅的方式
                return;
              }
              const handlers = ParcelWatcherServer.WATCHER_HANDLERS.get(watcherId)?.handlers;
              if (!handlers) {
                return;
              }
              for (const handler of handlers) {
                handler(err, events);
              }
            },
            {
              backend: ParcelWatcherServer.PARCEL_WATCHER_BACKEND,
              ignore: this.excludes.concat(rawOptions?.excludes || this.getDefaultWatchExclude()),
            },
          );
        } catch (e) {
          // Parcel Watcher 启动失败，尝试重试
          this.logger.error('watcher subscribe failed ', e, ' try times ', times);
          await new Promise((resolve) => {
            setTimeout(resolve, retryDelay);
          });
        }
      }

      // 经过若干次的尝试后，Parcel Watcher 依然启动失败，此时就不再尝试重试
      this.logger.error(`watcher subscribe finally failed after ${maxRetries} times`);
      return undefined; // watch 失败则返回 undefined
    };

    const hanlder: ParcelWatcher.AsyncSubscription | undefined = await tryWatchDir();

    if (hanlder) {
      // watch 成功才加入 disposables，否则也就无需 dispose
      disposables.push(
        Disposable.create(async () => {
          if (hanlder) {
            await hanlder.unsubscribe();
          }
        }),
      );
    }

    return disposables;
  }

  unwatchFileChanges(watcherId: number): Promise<void> {
    const watcher = ParcelWatcherServer.WATCHER_HANDLERS.get(watcherId);
    if (watcher) {
      ParcelWatcherServer.WATCHER_HANDLERS.delete(watcherId);
      watcher.disposable.dispose();
    }
    return Promise.resolve();
  }

  setClient(client: FileSystemWatcherClient | undefined) {
    if (client && this.toDispose.disposed) {
      return;
    }
    this.client = client;
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
}
