import { tmpdir } from 'os';
import paths, { join } from 'path';

import ParcelWatcher from '@parcel/watcher';
import fs from 'fs-extra';
import debounce from 'lodash/debounce';
import uniqBy from 'lodash/uniqBy';

import {
  FileChangeType,
  FileSystemWatcherClient,
  IWatcher,
  RecursiveWatcherBackend,
  WatchOptions,
} from '@opensumi/ide-core-common';
import { ILogService } from '@opensumi/ide-core-common/lib/log';
import {
  Disposable,
  DisposableCollection,
  FileUri,
  IDisposable,
  ParsedPattern,
  RunOnceScheduler,
  isLinux,
  isWindows,
  parseGlob,
} from '@opensumi/ide-core-common/lib/utils';

import { INsfw } from '../../../common/watcher';
import { FileChangeCollection } from '../../file-change-collection';
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

export class RecursiveFileSystemWatcher extends Disposable implements IWatcher {
  private static readonly PARCEL_WATCHER_BACKEND = isWindows ? 'windows' : isLinux ? 'inotify' : 'fs-events';

  private static DEFAULT_POLLING_INTERVAL = 100;

  private WATCHER_HANDLERS = new Map<
    string,
    { path: string; handlers: ParcelWatcher.SubscribeCallback[]; disposable: IDisposable }
  >();

  protected watcherOptions = new Map<string, WatcherOptions>();

  protected client: FileSystemWatcherClient | undefined;

  protected changes = new FileChangeCollection();

  constructor(
    private excludes: string[] = [],
    private readonly logger: ILogService,
    private backend: RecursiveWatcherBackend = RecursiveWatcherBackend.NSFW,
  ) {
    super();
    this.addDispose(
      Disposable.create(() => {
        this.WATCHER_HANDLERS.clear();
      }),
    );
  }

  /**
   * 如果监听路径不存在，则会监听父目录
   * @param uri 要监听的路径
   * @param options
   * @returns
   */
  async watchFileChanges(uri: string, options?: WatchOptions) {
    return new Promise<void>((resolve, rej) => {
      const timer = setTimeout(() => {
        rej(`Watch ${uri} Timeout`);
        // FIXME：暂时写死60秒
      }, 60000);

      if (options?.excludes) {
        this.updateWatcherFileExcludes(options.excludes);
      }

      this.doWatchFileChange(uri, options).then(() => {
        resolve(void 0);
        if (timer) {
          clearTimeout(timer);
        }
      });
    });
  }

  private async doWatchFileChange(uri: string, options?: WatchOptions) {
    const basePath = FileUri.fsPath(uri);
    this.logger.log('[Recursive] watch file changes: ', uri, 'basePath:', basePath);

    const toDisposeWatcher = new DisposableCollection();
    let watchPath: string | undefined;

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
      this.logger.warn(`[Recursive] No valid watch path found for ${uri}`);
      return;
    }

    // 先检查并清理已存在的 handler（使用 watchPath 确保目录级别的去重）
    if (this.WATCHER_HANDLERS.has(watchPath!)) {
      this.logger.debug(`[Recursive] Cleaning up existing watcher for directory: ${watchPath}`);
      const handler = this.WATCHER_HANDLERS.get(watchPath!);
      handler?.disposable.dispose();
      this.WATCHER_HANDLERS.delete(watchPath!);
    }

    const handler = (err, events: ParcelWatcher.Event[]) => {
      if (err) {
        this.logger.error(`[Recursive] Watching ${watchPath} error: `, err);
        return;
      }
      events = this.trimChangeEvent(events);
      for (const event of events) {
        switch (event.type) {
          case 'create':
            this.pushAdded(event.path);
            break;
          case 'delete':
            this.pushDeleted(event.path);
            break;
          case 'update':
            this.pushUpdated(event.path);
            break;
        }
      }
    };

    this.WATCHER_HANDLERS.set(watchPath, {
      path: watchPath,
      disposable: toDisposeWatcher,
      handlers: [handler],
    });

    toDisposeWatcher.push(await this.start(watchPath, options));
    this.addDispose(toDisposeWatcher);
  }

  /**
   * 向上查找存在的目录
   * 默认向上查找 5 层，避免造成较大的目录监听带来的性能问题
   * 当前框架内所有配置文件可能存在的路径层级均不超过 5 层
   * @param path 监听的文件路径
   * @param count 向上查找层级
   */
  protected async lookup(path: string, count = 5): Promise<string | undefined> {
    let uri = paths.dirname(path);
    let times = 0;
    while (!(await fs.pathExists(uri)) && times < count) {
      if (uri === paths.dirname(uri)) {
        // 已经到达根目录，仍未找到有效路径
        return undefined;
      }
      uri = paths.dirname(uri);
      times++;
    }
    return (await fs.pathExists(uri)) ? uri : undefined;
  }

  /**
   * 过滤 `write-file-atomic` 写入生成的临时文件
   * @param events
   */
  protected trimChangeEvent(events: ParcelWatcher.Event[]): ParcelWatcher.Event[] {
    events = events.filter((event: ParcelWatcher.Event) => !shouldIgnorePath(event.path));
    return events;
  }

  async updateWatcherFileExcludes(excludes: string[]): Promise<void> {
    this.excludes = excludes;
  }

  protected async start(basePath: string, rawOptions: WatchOptions | undefined): Promise<DisposableCollection> {
    this.logger.log('[Recursive] Start watching', basePath);

    if (!(await fs.pathExists(basePath))) {
      return new DisposableCollection();
    }

    const realPath = await fs.realpath(basePath);

    if (this.isEnableNSFW()) {
      return this.watchWithNsfw(realPath, rawOptions);
    } else {
      // polling
      if (rawOptions?.pollingWatch) {
        this.logger.log('[Recursive] Start polling watch:', realPath);
        return this.pollingWatch(realPath, rawOptions);
      }

      return this.watchWithParcel(realPath, rawOptions);
    }
  }

  private async watchWithNsfw(realPath: string, rawOptions?: WatchOptions | undefined) {
    const disposables = new DisposableCollection();
    const nsfw = await this.withNSFWModule();
    const watcher: INsfw.NSFW = await nsfw(
      realPath,
      (events: INsfw.ChangeEvent[]) => this.handleNSFWEvents(events, realPath),
      {
        errorCallback: (err) => {
          this.logger.error('[Recursive] NSFW watcher encountered an error and will stop watching.', err);
          // see https://github.com/atom/github/issues/342
          this.unwatchFileChanges(realPath);
        },
      },
    );

    await watcher.start();

    disposables.push(
      Disposable.create(async () => {
        this.watcherOptions.delete(realPath);
        await watcher.stop();
      }),
    );

    const excludes = this.excludes.concat(rawOptions?.excludes || []);

    this.watcherOptions.set(realPath, {
      excludesPattern: excludes.map((pattern) => parseGlob(pattern)),
      excludes,
    });
    return disposables;
  }

  private async watchWithParcel(realPath: string, rawOptions?: WatchOptions | undefined) {
    const disposables = new DisposableCollection();
    const tryWatchDir = async (maxRetries = 3, retryDelay = 1000) => {
      for (let times = 0; times < maxRetries; times++) {
        try {
          return await ParcelWatcher.subscribe(
            realPath,
            (err, events: ParcelWatcher.Event[]) => {
              if (err) {
                this.logger.error(`[Recursive] Watcher error for ${realPath}:`, err);
                return;
              }

              // 对于超过 5000 数量的 events 做屏蔽优化，避免潜在的卡死问题
              if (events.length > 5000) {
                this.logger.warn(`[Recursive] Too many events (${events.length}) for ${realPath}, skipping...`);
                return;
              }

              const watcherInfo = this.WATCHER_HANDLERS.get(realPath);
              if (!watcherInfo || !watcherInfo.handlers) {
                this.logger.warn('[Recursive] No handler found for watcher', realPath);
                return;
              }

              if (events.length === 0) {
                return;
              }

              this.logger.debug('[Recursive] Received events:', events);
              for (const handler of watcherInfo.handlers) {
                try {
                  (handler as ParcelWatcher.SubscribeCallback)(err, events);
                } catch (handlerError) {
                  this.logger.error(`[Recursive] Handler error for ${realPath}:`, handlerError);
                }
              }
            },
            {
              backend: RecursiveFileSystemWatcher.PARCEL_WATCHER_BACKEND,
              ignore: this.excludes.concat(rawOptions?.excludes ?? []),
            },
          );
        } catch (e) {
          // Watcher 启动失败，尝试重试
          this.logger.error('[Recursive] watcher subscribe failed ', e, ' try times ', times);
          if (times < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        }
      }

      // 经过若干次的尝试后，Parcel Watcher 依然启动失败，此时就不再尝试重试
      this.logger.error(`[Recursive] watcher subscribe finally failed after ${maxRetries} times for ${realPath}`);
      return undefined;
    };

    try {
      const handler = await tryWatchDir();
      if (handler) {
        disposables.push(
          Disposable.create(async () => {
            try {
              await handler.unsubscribe();
              this.logger.debug(`[Recursive] Successfully unsubscribed watcher for ${realPath}`);
            } catch (error) {
              this.logger.error(`[Recursive] Error unsubscribing watcher for ${realPath}:`, error);
            }
          }),
        );
      }
    } catch (error) {
      this.logger.error(`[Recursive] Error setting up watcher for ${realPath}:`, error);
    }

    return disposables;
  }

  private async pollingWatch(realPath: string, rawOptions?: WatchOptions | undefined) {
    const disposables = new DisposableCollection();
    const snapshotFile = join(tmpdir(), `watcher-snapshot-${realPath}`);
    let counter = 0;

    const pollingWatcher = new RunOnceScheduler(async () => {
      counter++;
      if (counter > 1) {
        const parcelEvents = await ParcelWatcher.getEventsSince(realPath, snapshotFile, {
          ignore: rawOptions?.excludes,
          backend: RecursiveFileSystemWatcher.PARCEL_WATCHER_BACKEND,
        });

        const handlers = this.WATCHER_HANDLERS.get(realPath)?.handlers;

        if (!handlers) {
          this.logger.log('[Recursive] No handler found for watcher', realPath);
          return;
        }

        this.logger.log('[Recursive] Received events:', parcelEvents);
        for (const handler of handlers) {
          (handler as ParcelWatcher.SubscribeCallback)(null, parcelEvents);
        }
      }

      await ParcelWatcher.writeSnapshot(realPath, snapshotFile, {
        ignore: rawOptions?.excludes,
        backend: RecursiveFileSystemWatcher.PARCEL_WATCHER_BACKEND,
      });

      pollingWatcher.schedule();
    }, RecursiveFileSystemWatcher.DEFAULT_POLLING_INTERVAL);

    pollingWatcher.schedule(0);

    disposables.push(pollingWatcher);

    return disposables;
  }

  private disposeWatcher(path: string) {
    const watcher = this.WATCHER_HANDLERS.get(path);
    if (watcher) {
      try {
        watcher.disposable.dispose();
      } catch (err) {
        this.logger.error(`Dispose watcher failed for ${path}`, err);
      } finally {
        this.WATCHER_HANDLERS.delete(path);
      }
    }
  }

  unwatchFileChanges(uri: string): void {
    this.logger.log('[Recursive] Un watch: ', uri);
    const basePath = FileUri.fsPath(uri);
    this.disposeWatcher(basePath);
  }

  setClient(client: FileSystemWatcherClient | undefined) {
    if (this.client && this.disposed) {
      return;
    }
    this.client = client;
  }

  /**
   * 由于 parcel/watcher 在 Linux 下存在内存越界访问问题触发了 sigsegv 导致 crash，所以在 Linux 下仍旧使用 nsfw
   * 社区相关 issue: https://github.com/parcel-bundler/watcher/issues/49
   */
  private isEnableNSFW(): boolean {
    return this.backend === RecursiveWatcherBackend.NSFW && isLinux;
  }

  private async handleNSFWEvents(events: INsfw.ChangeEvent[], realPath: string): Promise<void> {
    if (events.length > 5000) {
      return;
    }

    const isIgnored = (realPath: string, path: string): boolean => {
      const options = this.watcherOptions.get(realPath);
      if (!options || !options.excludes || options.excludes.length < 1) {
        return false;
      }

      const excludesPattern = [...this.excludes.map((pattern) => parseGlob(pattern)), ...options.excludesPattern];
      return excludesPattern.some((match) => match(path));
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
              if (isIgnored(realPath, deletedPath)) {
                return;
              }

              this.pushDeleted(deletedPath);

              if (event.newDirectory) {
                const path = await this.resolvePath(event.newDirectory, event.newFile!);
                if (isIgnored(realPath, path)) {
                  return;
                }

                this.pushAdded(path);
              } else {
                const path = await this.resolvePath(event.directory, event.newFile!);
                if (isIgnored(realPath, path)) {
                  return;
                }

                this.pushAdded(path);
              }
            }
            break;
          default:
            {
              const path = await this.resolvePath(event.directory, event.file!);
              if (isIgnored(realPath, path)) {
                return;
              }

              switch (event.action) {
                case INsfw.actions.CREATED:
                  this.pushAdded(path);
                  break;
                case INsfw.actions.DELETED:
                  this.pushDeleted(path);
                  break;
                case INsfw.actions.MODIFIED:
                  this.pushUpdated(path);
                  break;
              }
            }
            break;
        }
      }),
    );
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
    const event = { changes };
    if (this.client) {
      this.client.onDidFilesChanged(event);
    }
  }
}
