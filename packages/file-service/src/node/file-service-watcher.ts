import * as fs from 'fs';
import * as nsfw from 'nsfw';
import * as paths from 'path';
import { parse, ParsedPattern } from '@ali/ide-core-common/lib/utils/glob';
// import { IMinimatch, Minimatch } from 'minimatch';
import { IDisposable, Disposable, DisposableCollection, isWindows, isLinux } from '@ali/ide-core-common';
import { FileUri } from '@ali/ide-core-node';
import {
  FileChangeType,
  FileSystemWatcherClient,
  FileSystemWatcherServer,
  WatchOptions,
} from '../common/file-service-watcher-protocol';
import { FileChangeCollection } from './file-change-collection';
import { INsfw, IEfsw } from '../common/watcher';
import { setInterval, clearInterval } from 'timers';
import debounce = require('lodash.debounce');
import { Watcher } from 'efsw';

export interface WatcherOptions {
  excludesPattern: ParsedPattern[];
  excludes: string[];
}

export interface NsfwFileSystemWatcherOption {
  verbose?: boolean;
  info?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
  useExperimentalEfsw?: boolean;
}

export class NsfwFileSystemWatcherServer implements FileSystemWatcherServer {

  protected client: FileSystemWatcherClient | undefined;

  protected watcherSequence = 1;
  protected watcherOptions = new Map<number, WatcherOptions>();
  protected readonly watchers = new Map<number, {path: string, disposable: IDisposable}>();

  protected readonly toDispose = new DisposableCollection(
    Disposable.create(() => this.setClient(undefined)),
  );

  protected changes = new FileChangeCollection();

  protected readonly options: {
    verbose: boolean,
    // tslint:disable-next-line
    info: (message: string, ...args: any[]) => void,
    // tslint:disable-next-line
    error: (message: string, ...args: any[]) => void,
    useExperimentalEfsw?: boolean,
  };

  constructor(options?: NsfwFileSystemWatcherOption) {
    this.options = {
      verbose: false,
      // tslint:disable-next-line
      info: (message, ...args) => console.info(message, ...args),
      // tslint:disable-next-line
      error: (message, ...args) => console.error(message, ...args),
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
    const realpath = fs.realpathSync(basePath);
    let watcherId = this.checkIsParentWatched(realpath);
    if (watcherId) {
      return watcherId;
    }
    watcherId = this.watcherSequence++;
    this.debug('Starting watching:', basePath, options);
    const toDisposeWatcher = new DisposableCollection();
    this.watchers.set(watcherId, {
      path: realpath,
      disposable: toDisposeWatcher,
    });
    toDisposeWatcher.push(Disposable.create(() => this.watchers.delete(watcherId)));
    if (fs.existsSync(basePath)) {
      this.start(watcherId, basePath, options, toDisposeWatcher);
    } else {
      const toClearTimer = new DisposableCollection();
      const timer = setInterval(() => {
        if (fs.existsSync(basePath)) {
          toClearTimer.dispose();
          this.pushAdded(watcherId, basePath);
          this.start(watcherId, basePath, options, toDisposeWatcher);
        }
      }, 500);
      toClearTimer.push(Disposable.create(() => clearInterval(timer)));
      toDisposeWatcher.push(toClearTimer);
    }
    this.toDispose.push(toDisposeWatcher);
    return watcherId;
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
        if (renameEvent && event.action === INsfw.actions.CREATED &&
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

  protected async start(watcherId: number, basePath: string, rawOptions: WatchOptions | undefined, toDisposeWatcher: DisposableCollection): Promise<void> {
    const options: WatchOptions = {
      excludes: [],
      ...rawOptions,
    };
    let watcher: INsfw.NSFW | undefined | Watcher;

    if (isLinux && this.options.useExperimentalEfsw) {
      watcher = new Watcher(fs.realpathSync(basePath));
      watcher.on('change', (filename: string, event: IEfsw.ChangeEvent) => {
        if (event.action === IEfsw.actions.ADD) {
          this.pushAdded(watcherId, this.resolvePath(event.dir, event.relative!));
        }
        if (event.action === IEfsw.actions.DELETE) {
          this.pushDeleted(watcherId, this.resolvePath(event.dir, event.relative!));
        }
        if (event.action === IEfsw.actions.MODIFIED) {
          this.pushUpdated(watcherId, this.resolvePath(event.dir, event.relative!));
        }
        if (event.action === IEfsw.actions.MOVED) {
          this.pushDeleted(watcherId, this.resolvePath(event.dir, event.oldRelative!));
          this.pushAdded(watcherId, this.resolvePath(event.dir, event.relative!));
        }
      });
      watcher.on('error', (error) => {
        // tslint:disable-next-line
        console.warn(`Failed to watch "${basePath}":`, error);
        this.unwatchFileChanges(watcherId);
      });
    } else {
      watcher = await (nsfw as any)(fs.realpathSync(basePath), (events: INsfw.ChangeEvent[]) => {
        events = this.trimChangeEvent(events);
        for (const event of events) {
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
      }, {
          errorCallback: (error: any) => {
            // see https://github.com/atom/github/issues/342
            // tslint:disable-next-line
            console.warn(`Failed to watch "${basePath}":`, error);
            this.unwatchFileChanges(watcherId);
          },
        });
    }

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
    toDisposeWatcher.push(Disposable.create(async () => {
      this.watcherOptions.delete(watcherId);
      if (watcher) {
        this.debug('Stopping watching:', basePath);
        await watcher.stop();
        // remove a reference to nsfw otherwise GC cannot collect it
        watcher = undefined;
        this.options.info('Stopped watching:', basePath);
      }
    }));
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
    return path;
    // try {
    //   return fs.realpathSync(path);
    // } catch (e) {
    //   try {
    //     // file does not exist try to resolve directory
    //     return paths.join(fs.realpathSync(directory), file);
    //   } catch (e) {
    //     // directory does not exist fall back to symlink
    //     return path;
    //   }
    // }
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
    return options.excludesPattern.some((match) => {
      return match(path);
    });
  }

  protected debug(message: string, ...params: any[]): void {
    if (this.options.verbose) {
      this.options.info(message, ...params);
    }
  }

}
