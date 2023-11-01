import paths from 'path';

import ParcelWatcher from '@parcel/watcher';
import fs from 'fs-extra';
import debounce from 'lodash/debounce';

import { Injectable, Autowired, Optional } from '@opensumi/di';
import {
  FileUri,
  ParsedPattern,
  IDisposable,
  Disposable,
  DisposableCollection,
  isWindows,
  isLinux,
  ILogService,
  SupportLogNamespace,
  ILogServiceManager,
  parseGlob,
} from '@opensumi/ide-core-node';

import { FileChangeType, FileSystemWatcherClient, IFileSystemWatcherServer, INsfw, WatchOptions } from '../../common';
import { FileChangeCollection } from '../file-change-collection';

export interface WatcherOptions {
  excludesPattern: ParsedPattern[];
  excludes: string[];
}

/**
 * @deprecated
 */
export interface NsfwFileSystemWatcherOption {
  verbose?: boolean;
  info?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

@Injectable({ multiple: true })
export class FileSystemWatcherServer implements IFileSystemWatcherServer {
  private static readonly PARCEL_WATCHER_BACKEND = isWindows ? 'windows' : isLinux ? 'inotify' : 'fs-events';

  private WATCHER_HANDLERS = new Map<
    number,
    { path: string; handlers: ParcelWatcher.SubscribeCallback[]; disposable: IDisposable }
  >();
  private static WATCHER_SEQUENCE = 1;
  protected watcherOptions = new Map<number, WatcherOptions>();

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

    watcherId = FileSystemWatcherServer.WATCHER_SEQUENCE++;
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

    this.WATCHER_HANDLERS.set(watcherId, {
      path: watchPath,
      disposable: toDisposeWatcher,
      handlers: [handler],
    });
    toDisposeWatcher.push(Disposable.create(() => this.WATCHER_HANDLERS.delete(watcherId as number)));
    toDisposeWatcher.push(await this.start(watcherId, watchPath, options));
    this.toDispose.push(toDisposeWatcher);
    return watcherId;
  }

  /**
   * 向上查找存在的目录
   * 默认向上查找 5 层，避免造成较大的目录监听带来的性能问题
   * 当前框架内所有配置文件可能存在的路径层级均不超过 5 层
   * @param path 监听的文件路径
   * @param count 向上查找层级
   */
  protected async lookup(path: string, count = 5) {
    let uri = paths.dirname(path);
    let times = 0;
    while (!(await fs.pathExists(uri)) && times < count) {
      uri = paths.dirname(uri);
      times++;
    }
    if (await fs.pathExists(uri)) {
      return uri;
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
              const handlers = this.WATCHER_HANDLERS.get(watcherId)?.handlers;

              if (!handlers) {
                return;
              }
              for (const handler of handlers) {
                (handler as ParcelWatcher.SubscribeCallback)(err, events);
              }
            },
            {
              backend: FileSystemWatcherServer.PARCEL_WATCHER_BACKEND,
              ignore: this.excludes.concat(rawOptions?.excludes || this.getDefaultWatchExclude()),
            },
          );
        } catch (e) {
          // Watcher 启动失败，尝试重试
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

    /**
     * 由于 parcel/watcher 在 Linux 下存在内存越界访问问题触发了 sigsegv 导致 crash，所以在 Linux 下仍旧使用 nsfw
     * 社区相关 issue: https://github.com/parcel-bundler/watcher/issues/49
     * 后续这里的 watcher 模块需要重构掉，先暂时这样处理
     *
     * 代码来自 issue: https://github.com/opensumi/core/pull/1437/files?diff=split&w=0#diff-9de963117a88a70d7c58974bf2b092c61a196d6eef719846d78ca5c9d100b796 的旧代码处理
     */
    if (this.isEnableNSFW()) {
      const nsfw = await this.withNSFWModule();
      const watcher: INsfw.NSFW = await nsfw(
        realPath,
        (events: INsfw.ChangeEvent[]) => this.handleNSFWEvents(events, watcherId),
        {
          errorCallback: (error: any) => {
            // see https://github.com/atom/github/issues/342
            this.unwatchFileChanges(watcherId);
          },
        },
      );

      await watcher.start();

      disposables.push(
        Disposable.create(async () => {
          this.watcherOptions.delete(watcherId);
          await watcher.stop();
        }),
      );

      const excludes = this.excludes.concat(rawOptions?.excludes || this.getDefaultWatchExclude());

      this.watcherOptions.set(watcherId, {
        excludesPattern: excludes.map((pattern) => parseGlob(pattern)),
        excludes,
      });
    } else {
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
    }

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

  setClient(client: FileSystemWatcherClient | undefined) {
    if (client && this.toDispose.disposed) {
      return;
    }
    this.client = client;
  }

  /**
   * @deprecated
   * 主要是用来跳过 jest 测试
   */
  private isEnableNSFW(): boolean {
    return isLinux;
  }

  private async handleNSFWEvents(events: INsfw.ChangeEvent[], watcherId: number): Promise<void> {
    const isIgnored = (watcherId: number, path: string): boolean => {
      const options = this.watcherOptions.get(watcherId);
      if (!options || !options.excludes || options.excludes.length < 1) {
        return false;
      }
      return options.excludesPattern.some((match) => match(path));
    };

    if (events.length > 5000) {
      return;
    }

    for (const event of events) {
      if (event.action === INsfw.actions.RENAMED) {
        const deletedPath = this.resolvePath(event.directory, event.oldFile!);
        if (isIgnored(watcherId, deletedPath)) {
          continue;
        }

        this.pushDeleted(deletedPath);

        if (event.newDirectory) {
          const path = this.resolvePath(event.newDirectory, event.newFile!);
          if (isIgnored(watcherId, path)) {
            continue;
          }

          this.pushAdded(path);
        } else {
          const path = this.resolvePath(event.directory, event.newFile!);
          if (isIgnored(watcherId, path)) {
            continue;
          }

          this.pushAdded(path);
        }
      } else {
        const path = this.resolvePath(event.directory, event.file!);
        if (isIgnored(watcherId, path)) {
          continue;
        }

        if (event.action === INsfw.actions.CREATED) {
          this.pushAdded(path);
        }
        if (event.action === INsfw.actions.DELETED) {
          this.pushDeleted(path);
        }
        if (event.action === INsfw.actions.MODIFIED) {
          this.pushUpdated(path);
        }
      }
    }
  }

  private async withNSFWModule(): Promise<typeof import('nsfw')> {
    return require('nsfw');
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
