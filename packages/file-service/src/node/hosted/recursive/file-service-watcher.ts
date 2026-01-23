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
  private static MAX_NATIVE_EVENT_BATCH = 5000;

  private WATCHER_HANDLERS = new Map<
    string,
    { path: string; handlers: ParcelWatcher.SubscribeCallback[]; disposable: IDisposable }
  >();

  private readonly watchPathMap = new Map<string, string>();

  protected watcherOptions = new Map<string, WatcherOptions>();

  protected client: FileSystemWatcherClient | undefined;

  protected changes = new FileChangeCollection();

  private parcelWatcherAvailableOnLinux: boolean | undefined;

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

  private async resolveWatchPath(basePath: string): Promise<string> {
    try {
      return await fs.realpath(basePath);
    } catch (e) {
      return basePath;
    }
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

    const realWatchPath = await this.resolveWatchPath(watchPath);

    const prevWatchPath = this.watchPathMap.get(basePath);

    if (prevWatchPath && prevWatchPath !== realWatchPath) {
      this.logger.warn(`[Recursive] Watch path changed from ${prevWatchPath} to ${realWatchPath}`);
      this.disposeWatcher(prevWatchPath);
    }

    // 先检查并清理已存在的 handler（使用 watchPath 确保目录级别的去重）
    if (this.WATCHER_HANDLERS.has(realWatchPath)) {
      this.logger.debug(`[Recursive] Cleaning up existing watcher for directory: ${realWatchPath}`);
      const handler = this.WATCHER_HANDLERS.get(realWatchPath);
      handler?.disposable.dispose();
      this.WATCHER_HANDLERS.delete(realWatchPath);
      this.cleanupWatchPathMap(realWatchPath);
    }

    // 记录原始请求与真实监听目录的映射，方便后续释放
    this.watchPathMap.set(basePath, realWatchPath);

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

    this.WATCHER_HANDLERS.set(realWatchPath, {
      path: realWatchPath,
      disposable: toDisposeWatcher,
      handlers: [handler],
    });

    toDisposeWatcher.push(await this.start(realWatchPath, options));
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

    const realPath = await this.resolveWatchPath(basePath);
    const shouldUseNSFW = await this.shouldUseNSFW();

    if (shouldUseNSFW) {
      return this.watchWithNsfw(realPath, rawOptions);
    }

    // polling
    if (rawOptions?.pollingWatch) {
      this.logger.log('[Recursive] Start polling watch:', realPath);
      return this.pollingWatch(realPath, rawOptions);
    }

    // Linux 上 parcel watcher 可能失败，需要回退到 NSFW
    if (isLinux) {
      try {
        return await this.watchWithParcel(realPath, rawOptions);
      } catch (error) {
        this.logger.warn(`[Recursive] parcel watcher failed for ${realPath}, falling back to nsfw.`, error);
        return this.watchWithNsfw(realPath, rawOptions);
      }
    }

    return this.watchWithParcel(realPath, rawOptions);
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
          this.notifyWatcherFailed({
            resolvedUri: realPath,
            backend: RecursiveWatcherBackend.NSFW,
            message: err instanceof Error ? err.message : String(err || 'watcher error'),
          });
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
                this.notifyWatcherFailed({
                  resolvedUri: realPath,
                  backend: RecursiveWatcherBackend.PARCEL,
                  message: err?.message || 'watcher error',
                });
                return;
              }

              // 对于超过 5000 数量的 events 做屏蔽优化，避免潜在的卡死问题
              if (events.length > RecursiveFileSystemWatcher.MAX_NATIVE_EVENT_BATCH) {
                this.logger.warn(`[Recursive] Too many parcel events (${events.length}) for ${realPath}, skipping...`);
                this.notifyOverflow({
                  resolvedUri: realPath,
                  backend: RecursiveWatcherBackend.PARCEL,
                  eventCount: events.length,
                });
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
      this.notifyWatcherFailed({
        resolvedUri: realPath,
        backend: RecursiveWatcherBackend.PARCEL,
        message: `Failed to subscribe watcher after ${maxRetries} retries`,
        attempts: maxRetries,
      });
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
      } else if (isLinux) {
        // Linux 上订阅失败，抛出错误以便 start 方法可以回退到 NSFW
        throw new Error(`Parcel watcher subscribe failed for ${realPath}`);
      }
    } catch (error) {
      this.logger.error(`[Recursive] Error setting up watcher for ${realPath}:`, error);
      this.notifyWatcherFailed({
        resolvedUri: realPath,
        backend: RecursiveWatcherBackend.PARCEL,
        message: error instanceof Error ? error.message : String(error),
      });
      // Linux 上重新抛出错误以便回退到 NSFW
      if (isLinux) {
        throw error;
      }
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

        if (parcelEvents.length > RecursiveFileSystemWatcher.MAX_NATIVE_EVENT_BATCH) {
          this.logger.warn(`[Recursive] Too many polling events (${parcelEvents.length}) for ${realPath}, skipping...`);
          this.notifyOverflow({
            resolvedUri: realPath,
            backend: 'polling',
            eventCount: parcelEvents.length,
          });
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
        this.cleanupWatchPathMap(path);
      }
    }
  }

  unwatchFileChanges(uri: string): void {
    this.logger.log('[Recursive] Un watch: ', uri);
    const basePath = FileUri.fsPath(uri);
    const watchPath = this.watchPathMap.get(basePath) ?? basePath;
    this.watchPathMap.delete(basePath);
    this.disposeWatcher(watchPath);
  }

  private cleanupWatchPathMap(watchPath: string) {
    for (const [basePath, mappedPath] of this.watchPathMap) {
      if (mappedPath === watchPath) {
        this.watchPathMap.delete(basePath);
      }
    }
  }

  setClient(client: FileSystemWatcherClient | undefined) {
    if (this.client && this.disposed) {
      return;
    }
    this.client = client;
  }

  private notifyOverflow(params: {
    resolvedUri?: string;
    backend?: RecursiveWatcherBackend | 'polling';
    eventCount: number;
  }) {
    if (!this.client || !this.client.onWatcherOverflow) {
      return;
    }

    this.client.onWatcherOverflow({
      resolvedUri: params.resolvedUri,
      backend: params.backend,
      eventCount: params.eventCount,
      limit: RecursiveFileSystemWatcher.MAX_NATIVE_EVENT_BATCH,
      timestamp: Date.now(),
    });
  }

  private notifyWatcherFailed(params: {
    resolvedUri?: string;
    backend?: RecursiveWatcherBackend | 'polling';
    message: string;
    attempts?: number;
  }) {
    if (!this.client || !this.client.onWatcherFailed) {
      return;
    }

    this.client.onWatcherFailed({
      resolvedUri: params.resolvedUri,
      backend: params.backend,
      message: params.message,
      attempts: params.attempts,
      timestamp: Date.now(),
    });
  }

  /**
   * parcel/watcher 曾在 Linux 下触发过 sigsegv（https://github.com/parcel-bundler/watcher/issues/49）。
   * 在 Linux 上先探测 parcel 是否可用，如果不可用则回退到 nsfw，避免直接崩溃。
   */
  private async shouldUseNSFW(): Promise<boolean> {
    if (this.backend !== RecursiveWatcherBackend.NSFW || !isLinux) {
      return false;
    }

    const canUseParcel = await this.canUseParcelWatcherOnLinux();
    if (canUseParcel) {
      return false;
    }

    this.logger.warn('[Recursive] parcel/watcher unavailable on linux, fallback to nsfw backend.');
    return true;
  }

  private async canUseParcelWatcherOnLinux(): Promise<boolean> {
    if (!isLinux) {
      return true;
    }

    if (typeof this.parcelWatcherAvailableOnLinux !== 'undefined') {
      return this.parcelWatcherAvailableOnLinux;
    }

    this.parcelWatcherAvailableOnLinux = await this.detectParcelWatcherAvailabilityOnLinux();

    return this.parcelWatcherAvailableOnLinux;
  }

  /**
   * 通过实际订阅并触发文件变更来检测 parcel/watcher 是否真正可用。
   * 某些 Linux 系统上 parcel 的 snapshot 功能正常，但 subscribe 监听不生效，
   * 因此需要通过实际触发事件来验证。
   */
  private async detectParcelWatcherAvailabilityOnLinux(): Promise<boolean> {
    let tempDir: string | undefined;
    let subscription: ParcelWatcher.AsyncSubscription | undefined;

    const PROBE_TIMEOUT_MS = 3000;

    try {
      const tempDirPrefix = join(tmpdir(), 'opensumi-parcel-watch-');
      tempDir = await fs.mkdtemp(tempDirPrefix);
      const testFile = join(tempDir, 'probe-test-file');

      // 创建一个 Promise 来等待事件
      const eventPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, PROBE_TIMEOUT_MS);

        ParcelWatcher.subscribe(
          tempDir!,
          (err, events) => {
            if (err) {
              this.logger.warn('[Recursive] parcel/watcher probe received error:', err);
              return;
            }
            // 检查是否收到了我们创建的测试文件的事件
            const hasTestFileEvent = events.some((event) => event.path === testFile);
            if (hasTestFileEvent) {
              clearTimeout(timeout);
              resolve(true);
            }
          },
          {
            backend: RecursiveFileSystemWatcher.PARCEL_WATCHER_BACKEND,
          },
        )
          .then((sub) => {
            subscription = sub;
          })
          .catch((subError) => {
            this.logger.warn('[Recursive] parcel/watcher subscribe failed during probe:', subError);
            clearTimeout(timeout);
            resolve(false);
          });
      });

      // 等待订阅建立后再触发文件变更
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 触发文件变更事件
      await fs.writeFile(testFile, 'probe');

      // 等待事件或超时
      const result = await eventPromise;

      if (result) {
        this.logger.log('[Recursive] parcel/watcher backend verified working on linux, prefer parcel watcher.');
      } else {
        this.logger.warn(
          '[Recursive] parcel/watcher backend did not receive events on linux within timeout, will fallback to nsfw.',
        );
      }

      return result;
    } catch (error) {
      this.logger.warn('[Recursive] parcel/watcher backend probe failed on linux.', error);
      return false;
    } finally {
      // 清理订阅
      if (subscription) {
        try {
          await subscription.unsubscribe();
        } catch (unsubError) {
          this.logger.debug('[Recursive] Failed to unsubscribe parcel watcher probe:', unsubError);
        }
      }
      // 清理临时目录
      if (tempDir) {
        await fs
          .remove(tempDir)
          .catch((cleanupError) =>
            this.logger.debug('[Recursive] Failed to cleanup parcel watcher probe dir:', cleanupError),
          );
      }
    }
  }

  private async handleNSFWEvents(events: INsfw.ChangeEvent[], realPath: string): Promise<void> {
    if (events.length > RecursiveFileSystemWatcher.MAX_NATIVE_EVENT_BATCH) {
      this.logger.warn(`[Recursive] Too many NSFW events (${events.length}) for ${realPath}, skipping...`);
      this.notifyOverflow({
        resolvedUri: realPath,
        backend: RecursiveWatcherBackend.NSFW,
        eventCount: events.length,
      });
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
