import paths from 'path';

import ParcelWatcher from '@parcel/watcher';
import fs from 'fs-extra';
import debounce from 'lodash/debounce';
import groupBy from 'lodash/groupBy';
import uniqBy from 'lodash/uniqBy';

import { Autowired, Injectable, Optional } from '@opensumi/di';
import {
  Disposable,
  DisposableCollection,
  FileUri,
  GDataStore,
  IDisposable,
  ILogService,
  ILogServiceManager,
  ParsedPattern,
  RefCountedDisposable,
  SupportLogNamespace,
  isLinux,
  isWindows,
  parseGlob,
  sleep,
} from '@opensumi/ide-core-node';

import { FileChangeType, FileSystemWatcherClient, IFileSystemWatcherServer, INsfw, WatchOptions } from '../../common';
import { WatchInsData, fileChangeEvent } from '../data-store';
import { FileChangeCollection } from '../file-change-collection';
import { shouldIgnorePath } from '../shared';

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
export class FileSystemWatcherServer extends Disposable implements IFileSystemWatcherServer {
  private static readonly PARCEL_WATCHER_BACKEND = isWindows ? 'windows' : isLinux ? 'inotify' : 'fs-events';

  private static WATCHER_SEQUENCE = 1;
  protected watcherOptions = new Map<number, WatcherOptions>();

  protected changes = new FileChangeCollection();

  @Autowired(ILogServiceManager)
  private readonly loggerManager: ILogServiceManager;

  @GDataStore(WatchInsData, { id: 'watcherId' })
  private watcherGDataStore: GDataStore<WatchInsData, 'watcherId'>;

  private logger: ILogService;

  constructor(@Optional() private readonly excludes: string[] = []) {
    super();
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  /**
   * 如果监听路径不存在，则会监听父目录
   * @param uri 要监听的路径
   * @param options
   * @returns
   */
  async watchFileChanges(uri: string, options?: WatchOptions): Promise<number> {
    const basePath = FileUri.fsPath(uri);

    const existsWatcher = this.watcherGDataStore.find({
      path: basePath,
    });

    if (existsWatcher && existsWatcher.length > 0) {
      const watcher = existsWatcher[0];
      watcher.disposable.acquire();
      return watcher.watcherId;
    }

    const watcherId = FileSystemWatcherServer.WATCHER_SEQUENCE++;
    const session = new DisposableCollection();
    const refCountDisposable = new RefCountedDisposable(session);

    this.watcherGDataStore.create({
      watcherId,
      disposable: refCountDisposable,
      path: basePath,
    });

    let watchPath: string;

    const exist = await fs.pathExists(basePath);
    if (exist) {
      const stat = await fs.lstat(basePath);
      if (stat && stat.isDirectory()) {
        watchPath = basePath;
      } else {
        watchPath = await this.lookup(basePath);
      }
    } else {
      watchPath = await this.lookup(basePath);
    }

    if (!watchPath) {
      this.logger.error('watch path not found:', basePath);
      throw new Error('watch path not found: ' + basePath);
    }

    this.logger.log('Starting watching:', watchPath, options);

    session.push(Disposable.create(() => this.watcherGDataStore.remove(watcherId)));
    const realPath = await fs.realpath(basePath);

    // 如果监听的路径不是真实路径，则记录一个新的监听
    if (realPath !== watchPath) {
      const newWatcherId = FileSystemWatcherServer.WATCHER_SEQUENCE++;
      session.push(
        Disposable.create(() => {
          this.watcherGDataStore.remove(newWatcherId);
        }),
      );

      this.watcherGDataStore.create({
        watcherId: newWatcherId,
        disposable: refCountDisposable,
        path: watchPath,
      });
    }

    session.push(await this.start(watcherId, realPath, options));

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
    events = events.filter((event: ParcelWatcher.Event) => !shouldIgnorePath(event.path));
    return events;
  }

  private getDefaultWatchExclude() {
    return ['**/.git/objects/**', '**/.git/subtree-cache/**', '**/node_modules/**/*', '**/.hg/store/**'];
  }

  protected async start(
    watcherId: number,
    realPath: string,
    rawOptions: WatchOptions | undefined,
  ): Promise<DisposableCollection> {
    const disposables = new DisposableCollection();

    const tryWatchDirByParcelWatcher = async () => {
      const handle = await ParcelWatcher.subscribe(
        realPath,
        (err, events: ParcelWatcher.Event[]) => {
          if (err) {
            this.logger.error(`Watching ${realPath} error: `, err);
            this.terminateWatcher(watcherId);
            return;
          }

          events = this.trimChangeEvent(events);

          // 对于超过 5000 数量的 events 做屏蔽优化，避免潜在的卡死问题
          if (events.length > 5000) {
            // FIXME: 研究此处屏蔽的影响，考虑下阈值应该设置多少，或者更加优雅的方式
            return;
          }

          for (const event of events) {
            switch (event.type) {
              case 'create':
                this.pushAdded(watcherId, event.path);
                break;
              case 'delete':
                this.pushDeleted(watcherId, event.path);
                break;
              case 'update':
                this.pushUpdated(watcherId, event.path);
                break;
            }
          }
        },
        {
          backend: FileSystemWatcherServer.PARCEL_WATCHER_BACKEND,
          ignore: this.excludes.concat(rawOptions?.excludes || this.getDefaultWatchExclude()),
        },
      );
      return {
        dispose: () => handle.unsubscribe(),
      };
    };

    const tryWatchDirByNSFW = async (): Promise<IDisposable> => {
      const nsfw = requireNSFWModule();
      const watcher: INsfw.NSFW = await nsfw(
        realPath,
        (events: INsfw.ChangeEvent[]) => this.handleNSFWEvents(events, watcherId),
        {
          errorCallback: (err) => {
            this.logger.error('NSFW watcher encountered an error and will stop watching.', err);
            // see https://github.com/atom/github/issues/342
            this.terminateWatcher(watcherId);
          },
        },
      );

      await watcher.start();

      const stop: IDisposable = {
        dispose: async () => {
          await watcher.stop();
        },
      };

      disposables.push(
        Disposable.create(async () => {
          this.watcherOptions.delete(watcherId);
        }),
      );

      const excludes = this.excludes.concat(rawOptions?.excludes || this.getDefaultWatchExclude());

      this.watcherOptions.set(watcherId, {
        excludesPattern: excludes.map((pattern) => parseGlob(pattern)),
        excludes,
      });

      return stop;
    };

    const tryWatchDir = async (maxRetries = 3, retryDelay = 1000): Promise<IDisposable | undefined> => {
      for (let times = 0; times < maxRetries; times++) {
        try {
          if (this.isEnableNSFW()) {
            return tryWatchDirByNSFW();
          }
          return tryWatchDirByParcelWatcher();
        } catch (e) {
          // Watcher 启动失败，尝试重试
          this.logger.error('watcher subscribe failed ', e, ' try times ', times);
          await sleep(retryDelay);
        }
      }

      // 经过若干次的尝试后, Watcher 依然启动失败，此时就不再尝试重试
      this.logger.error(`watcher subscribe finally failed after ${maxRetries} times`);
      return undefined; // watch 失败则返回 undefined
    };

    const hanlder: IDisposable | undefined = await tryWatchDir();

    if (hanlder) {
      disposables.push(hanlder);
    }

    return disposables;
  }

  private terminateWatcher(watcherId: number): void {
    const data = this.watcherGDataStore.get(watcherId);
    if (data) {
      while (!data.disposable.disposed) {
        data.disposable.release();
      }
    }
  }

  unwatchFileChanges(watcherId: number): Promise<void> {
    const data = this.watcherGDataStore.get(watcherId);
    if (data) {
      data.disposable.release();
    }
    return Promise.resolve();
  }

  setClient(client: FileSystemWatcherClient | undefined) {
    if (client && this.disposed) {
      return;
    }
  }

  /**
   * 由于 parcel/watcher 在 Linux 下存在内存越界访问问题触发了 sigsegv 导致 crash，所以在 Linux 下仍旧使用 nsfw
   * 社区相关 issue: https://github.com/parcel-bundler/watcher/issues/49
   */
  private isEnableNSFW(): boolean {
    return isLinux;
  }

  private async handleNSFWEvents(events: INsfw.ChangeEvent[], watcherId: number): Promise<void> {
    if (events.length > 5000) {
      return;
    }

    const isIgnored = (watcherId: number, path: string): boolean => {
      const options = this.watcherOptions.get(watcherId);
      if (!options || !options.excludes || options.excludes.length < 1) {
        return false;
      }
      return options.excludesPattern.some((match) => match(path));
    };

    const filterEvents = events.filter((event) => {
      // 如果是 RENAME，不会产生临时文件
      if (event.action === INsfw.actions.RENAMED) {
        return true;
      }

      return !shouldIgnorePath(event.file);
    });

    const mergedEvents = uniqBy(filterEvents, (event) => {
      if (event.action === INsfw.actions.RENAMED) {
        const deletedPath = paths.join(event.directory, event.oldFile!);
        const newPath = paths.join(event.newDirectory || event.directory, event.newFile!);
        return deletedPath + newPath;
      }

      return event.action + paths.join(event.directory, event.file!);
    });

    await Promise.all(
      mergedEvents.map(async (event) => {
        switch (event.action) {
          case INsfw.actions.RENAMED:
            {
              const deletedPath = await this.resolvePath(event.directory, event.oldFile!);
              if (isIgnored(watcherId, deletedPath)) {
                return;
              }

              this.pushDeleted(watcherId, deletedPath);

              if (event.newDirectory) {
                const path = await this.resolvePath(event.newDirectory, event.newFile!);
                if (isIgnored(watcherId, path)) {
                  return;
                }

                this.pushAdded(watcherId, path);
              } else {
                const path = await this.resolvePath(event.directory, event.newFile!);
                if (isIgnored(watcherId, path)) {
                  return;
                }

                this.pushAdded(watcherId, path);
              }
            }
            break;
          default:
            {
              const path = await this.resolvePath(event.directory, event.file!);
              if (isIgnored(watcherId, path)) {
                return;
              }

              switch (event.action) {
                case INsfw.actions.CREATED:
                  this.pushAdded(watcherId, path);
                  break;
                case INsfw.actions.DELETED:
                  this.pushDeleted(watcherId, path);
                  break;
                case INsfw.actions.MODIFIED:
                  this.pushUpdated(watcherId, path);
                  break;
              }
            }
            break;
        }
      }),
    );
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

  protected async resolvePath(directory: string, file: string): Promise<string> {
    const path = paths.join(directory, file);
    // 如果是 linux 则获取一下真实 path，以防返回的是软连路径被过滤
    if (isLinux) {
      try {
        return await fs.realpath.native(path);
      } catch (_e) {
        try {
          // file does not exist try to resolve directory
          return paths.join(await fs.realpath.native(directory), file);
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

    const data = groupBy(changes, 'watcherId');

    Object.keys(data).forEach((watcherId) => {
      this.watcherGDataStore.emit(fileChangeEvent(watcherId), data[watcherId]);
    });
  }
}

function requireNSFWModule(): typeof import('nsfw') {
  return require('nsfw');
}
