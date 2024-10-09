import paths from 'path';

import fs from 'fs-extra';

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
  retry,
  sleep,
} from '@opensumi/ide-core-node';

import { FileChangeType, FileSystemWatcherClient, IFileSystemWatcherServer, WatchOptions } from '../../common';
import { WatchInsData } from '../data-store';
import { FileChangeCollectionManager } from '../file-change-collection';

import { DriverFileChange } from './drivers/base';
import { watchByNSFW } from './drivers/nsfw';
import { watchByParcelWatcher } from './drivers/parcel';

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
  private static WATCHER_SEQUENCE = 1;

  @Autowired(ILogServiceManager)
  private readonly loggerManager: ILogServiceManager;

  @GDataStore(WatchInsData, { id: 'watcherId' })
  private watcherGDataStore: GDataStore<WatchInsData, 'watcherId'>;

  @Autowired(FileChangeCollectionManager)
  private readonly fileChangeCollectionManager: FileChangeCollectionManager;

  private logger: ILogService;

  client: FileSystemWatcherClient | undefined;

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

    const existsWatcher = this.watcherGDataStore.find()?.filter((watcher) => basePath.indexOf(watcher.path) === 0);

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

  private getDefaultWatchExclude() {
    return ['**/.git/objects/**', '**/.git/subtree-cache/**', '**/node_modules/**/*', '**/.hg/store/**'];
  }

  protected onDriverFileChange(watcherId: number, changes: DriverFileChange[]): void {
    for (const change of changes) {
      switch (change.type) {
        case FileChangeType.ADDED:
          this.fileChangeCollectionManager.pushAdded(watcherId, change.path);
          break;
        case FileChangeType.DELETED:
          this.fileChangeCollectionManager.pushDeleted(watcherId, change.path);
          break;
        case FileChangeType.UPDATED:
          this.fileChangeCollectionManager.pushUpdated(watcherId, change.path);
          break;
      }
    }
  }

  protected async start(
    watcherId: number,
    realPath: string,
    rawOptions: WatchOptions | undefined,
  ): Promise<DisposableCollection> {
    const tryWatchDirByParcelWatcher = async () =>
      await watchByParcelWatcher(realPath, {
        onError: (err) => {
          this.logger.error(`Watching ${realPath} error: `, err);
          this.terminateWatcher(watcherId);
        },
        onEvents: (events) => {
          this.onDriverFileChange(watcherId, events);
        },
        excludes: this.excludes.concat(rawOptions?.excludes || this.getDefaultWatchExclude()),
      });

    const tryWatchDirByNSFW = async (): Promise<IDisposable> =>
      await watchByNSFW(realPath, {
        onEvents: (events) => {
          this.onDriverFileChange(watcherId, events);
        },
        onError: (err) => {
          this.logger.error('NSFW watcher encountered an error and will stop watching.', err);
          // see https://github.com/atom/github/issues/342
          this.terminateWatcher(watcherId);
        },
        excludes: this.excludes.concat(rawOptions?.excludes || this.getDefaultWatchExclude()),
      });

    const disposables = new DisposableCollection();
    try {
      const handler: IDisposable | undefined = await retry(
        async () => {
          if (this.isEnableNSFW()) {
            return tryWatchDirByNSFW();
          }
          return tryWatchDirByParcelWatcher();
        },
        {
          delay: 1000,
          retries: 3,
        },
      );

      if (handler) {
        disposables.push(handler);
      }
    } catch (error) {
      // 经过若干次的尝试后, Watcher 依然启动失败，此时就不再尝试重试
      this.logger.error('watcher subscribe failed', error);
    }

    return disposables;
  }

  terminateWatcher(watcherId: number): void {
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

  /**
   * 由于 parcel/watcher 在 Linux 下存在内存越界访问问题触发了 sigsegv 导致 crash，所以在 Linux 下仍旧使用 nsfw
   * 社区相关 issue: https://github.com/parcel-bundler/watcher/issues/49
   */
  private isEnableNSFW(): boolean {
    return isLinux;
  }
}
