import paths from 'path';

import * as fs from 'fs-extra';
import debounce = require('lodash.debounce');
import nsfw from 'nsfw';

import { IDisposable, Disposable, DisposableCollection, isWindows, URI, isLinux } from '@opensumi/ide-core-common';
import { parse, ParsedPattern } from '@opensumi/ide-core-common/lib/utils/glob';
import { FileUri } from '@opensumi/ide-core-node';

import { FileChangeType, FileSystemWatcherClient, FileSystemWatcherServer, WatchOptions } from '..';
import { INsfw } from '../common/watcher';

import { FileChangeCollection } from './file-change-collection';

export interface WatcherOptions {
  excludesPattern: ParsedPattern[];
  excludes: string[];
}

export interface NsfwFileSystemWatcherOption {
  verbose?: boolean;
  info?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

export class NsfwFileSystemWatcherServer implements FileSystemWatcherServer {
  private static WATCHER_FILE_DETECTED_TIME = 500;

  protected client: FileSystemWatcherClient | undefined;

  protected watcherSequence = 1;
  protected watcherOptions = new Map<number, WatcherOptions>();
  protected readonly watchers = new Map<number, { path: string; disposable: IDisposable }>();

  protected readonly toDispose = new DisposableCollection(Disposable.create(() => this.setClient(undefined)));

  protected changes = new FileChangeCollection();

  protected readonly options: {
    verbose: boolean;
    // tslint:disable-next-line
    info: (message: string, ...args: any[]) => void;
    // tslint:disable-next-line
    error: (message: string, ...args: any[]) => void;
  };

  constructor(options?: NsfwFileSystemWatcherOption) {
    this.options = {
      verbose: false,
      // tslint:disable-next-line
      info: (message, ...args) => {},
      // tslint:disable-next-line
      error: (message, ...args) => {},
      ...options,
    };
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  /**
   * 查找父目录是否已经在监听
   * @param watcherPath
   */
  checkIsParentWatched(watcherPath: string): number {
    let watcherId;
    this.watchers.forEach((watcher) => {
      if (watcherId) {
        return;
      }
      if (watcherPath.indexOf(watcher.path) === 0) {
        watcherId = this.watcherSequence++;
        this.watchers.set(watcherId, {
          path: watcherPath,
          disposable: new DisposableCollection(),
        });
      }
    });
    return watcherId;
  }

  async watchFileChanges(uri: string, options?: WatchOptions): Promise<number> {
    const basePath = FileUri.fsPath(uri);
    let realpath;
    if (await fs.pathExists(basePath)) {
      realpath = basePath;
    }
    let watcherId = realpath && this.checkIsParentWatched(realpath);
    if (watcherId) {
      return watcherId;
    }
    watcherId = this.watcherSequence++;
    this.debug('Starting watching:', basePath, options);
    const toDisposeWatcher = new DisposableCollection();
    if (await fs.pathExists(basePath)) {
      this.watchers.set(watcherId, {
        path: realpath,
        disposable: toDisposeWatcher,
      });
      toDisposeWatcher.push(Disposable.create(() => this.watchers.delete(watcherId)));
      this.start(watcherId, basePath, options, toDisposeWatcher);
    } else {
      const watchPath = await this.lookup(basePath);
      if (watchPath) {
        this.watchers.set(watcherId, {
          path: watchPath,
          disposable: toDisposeWatcher,
        });
        toDisposeWatcher.push(Disposable.create(() => this.watchers.delete(watcherId)));
        this.start(watcherId, watchPath, options, toDisposeWatcher, basePath);
      } else {
        // 向上查找不到对应文件时，使用定时逻辑定时检索文件，当检测到文件时，启用监听逻辑
        const toClearTimer = new DisposableCollection();
        const timer = setInterval(async () => {
          if (await fs.pathExists(basePath)) {
            toClearTimer.dispose();
            this.pushAdded(watcherId, basePath);
            this.start(watcherId, basePath, options, toDisposeWatcher);
          }
        }, NsfwFileSystemWatcherServer.WATCHER_FILE_DETECTED_TIME);
        toClearTimer.push(Disposable.create(() => clearInterval(timer)));
        toDisposeWatcher.push(toClearTimer);
      }
    }
    this.toDispose.push(toDisposeWatcher);
    return watcherId;
  }

  /**
   * 向上查找存在的目录
   * 默认向上查找 3 层，避免造成较大的目录监听带来的性能问题
   * 当前框架内所有配置文件可能存在的路径层级均不超过 3 层
   * @param path 监听路径
   * @param count 向上查找层级
   */
  protected async lookup(path: string, count = 3) {
    let uri = new URI(path);
    let times = 0;
    while (!(await fs.pathExists(uri.codeUri.fsPath)) && times <= count) {
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
   * 一些特殊事件的过滤：
   *  * write-file-atomic 生成临时文件的问题
   *  * windows 下 https://github.com/Axosoft/nsfw/issues/26
   * @param events
   */
  protected trimChangeEvent(events: INsfw.ChangeEvent[]): INsfw.ChangeEvent[] {
    if (events.length < 2) {
      return events;
    }

    let renameEvent: INsfw.ChangeEvent;

    events = events.filter((event: INsfw.ChangeEvent) => {
      if (event.file) {
        if (/\.\d{7}\d+$/.test(event.file)) {
          // write-file-atomic 源文件xxx.xx 对应的临时文件为 xxx.xx.22243434, 视为 xxx.xx;
          event.file = event.file.replace(/\.\d{7}\d+$/, '');
        }
      }

      // Fix https://github.com/Axosoft/nsfw/issues/26
      if (isWindows) {
        if (
          renameEvent &&
          event.action === INsfw.actions.CREATED &&
          event.directory === renameEvent.directory &&
          event.file === renameEvent.oldFile
        ) {
          return false;
        }
        if (event.action === INsfw.actions.RENAMED) {
          renameEvent = event;
        }
      }

      return true;
    });

    return events;
  }

  protected async start(
    watcherId: number,
    basePath: string,
    rawOptions: WatchOptions | undefined,
    toDisposeWatcher: DisposableCollection,
    rawFile?: string,
  ): Promise<void> {
    const options: WatchOptions = {
      excludes: [],
      ...rawOptions,
    };
    let watcher: INsfw.NSFW | undefined;

    watcher = await (nsfw as any)(
      await fs.realpath(basePath),
      (events: INsfw.ChangeEvent[]) => {
        events = this.trimChangeEvent(events);
        for (const event of events) {
          if (rawFile && event.file !== rawFile) {
            return;
          }
          if (event.action === INsfw.actions.CREATED) {
            this.pushAdded(watcherId, this.resolvePath(event.directory, event.file!));
          }
          if (event.action === INsfw.actions.DELETED) {
            this.pushDeleted(watcherId, this.resolvePath(event.directory, event.file!));
          }
          if (event.action === INsfw.actions.MODIFIED) {
            this.pushUpdated(watcherId, this.resolvePath(event.directory, event.file!));
          }
          if (event.action === INsfw.actions.RENAMED) {
            if (event.newDirectory) {
              this.pushDeleted(watcherId, this.resolvePath(event.directory, event.oldFile!));
              this.pushAdded(watcherId, this.resolvePath(event.newDirectory, event.newFile!));
            } else {
              this.pushDeleted(watcherId, this.resolvePath(event.directory, event.oldFile!));
              this.pushAdded(watcherId, this.resolvePath(event.directory, event.newFile!));
            }
          }
        }
      },
      {
        errorCallback: (error: any) => {
          // see https://github.com/atom/github/issues/342
          // eslint-disable-next-line no-console
          console.warn(`Failed to watch "${basePath}":`, error);
          this.unwatchFileChanges(watcherId);
        },
      },
    );

    await watcher!.start();
    // this.options.info('Started watching:', basePath);
    if (toDisposeWatcher.disposed) {
      this.debug('Stopping watching:', basePath);
      await watcher!.stop();
      // remove a reference to nsfw otherwise GC cannot collect it
      watcher = undefined;
      this.options.info('Stopped watching:', basePath);
      return;
    }
    toDisposeWatcher.push(
      Disposable.create(async () => {
        this.watcherOptions.delete(watcherId);
        if (watcher) {
          this.debug('Stopping watching:', basePath);
          await watcher.stop();
          // remove a reference to nsfw otherwise GC cannot collect it
          watcher = undefined;
          this.options.info('Stopped watching:', basePath);
        }
      }),
    );
    this.watcherOptions.set(watcherId, {
      excludesPattern: options.excludes.map((pattern) => parse(pattern)),
      excludes: options.excludes,
    });
  }

  unwatchFileChanges(watcherId: number): Promise<void> {
    const watcher = this.watchers.get(watcherId);
    if (watcher) {
      this.watchers.delete(watcherId);
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

  protected pushAdded(watcherId: number, path: string): void {
    // this.debug('Added:', `${watcherId}:${path}`);
    this.pushFileChange(watcherId, path, FileChangeType.ADDED);
  }

  protected pushUpdated(watcherId: number, path: string): void {
    // this.debug('Updated:', `${watcherId}:${path}`);
    this.pushFileChange(watcherId, path, FileChangeType.UPDATED);
  }

  protected pushDeleted(watcherId: number, path: string): void {
    // this.debug('Deleted:', `${watcherId}:${path}`);
    this.pushFileChange(watcherId, path, FileChangeType.DELETED);
  }

  protected pushFileChange(watcherId: number, path: string, type: FileChangeType): void {
    if (this.isIgnored(watcherId, path)) {
      return;
    }

    const uri = FileUri.create(path).toString();
    this.changes.push({ uri, type });

    this.fireDidFilesChanged();
  }

  protected resolvePath(directory: string, file: string): string {
    const path = paths.join(directory, file);
    // https://github.com/Axosoft/nsfw/issues/67
    // 如果是 linux 则获取一下真实 path，以防因为 nsfw 返回的是软连路径被过滤
    if (isLinux) {
      try {
        return fs.realpathSync.native(path);
      } catch {
        try {
          // file does not exist try to resolve directory
          return paths.join(fs.realpathSync.native(directory), file);
        } catch {
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

  protected isIgnored(watcherId: number, path: string): boolean {
    const options = this.watcherOptions.get(watcherId);

    if (!options || !options.excludes || options.excludes.length < 1) {
      return false;
    }
    return options.excludesPattern.some((match) => match(path));
  }

  protected debug(message: string, ...params: any[]): void {
    if (this.options.verbose) {
      this.options.info(message, ...params);
    }
  }
}
