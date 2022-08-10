import paths, { isAbsolute } from 'path';

import ParcelWatcher from '@parcel/watcher';
import * as fs from 'fs-extra';
import debounce from 'lodash/debounce';

import { Injectable, Autowired } from '@opensumi/di';
import {
  FileUri,
  ParsedPattern,
  IDisposable,
  Disposable,
  DisposableCollection,
  isWindows,
  URI,
  isLinux,
  strings,
  path,
  ILogService,
  SupportLogNamespace,
  ILogServiceManager,
} from '@opensumi/ide-core-node';

import { FileChangeType, FileSystemWatcherClient, IFileSystemWatcherServer, WatchOptions } from '../common';

import { FileChangeCollection } from './file-change-collection';

const { rtrim } = strings;
const { Path } = path;

export interface WatcherOptions {
  excludesPattern: ParsedPattern[];
  excludes: string[];
}

@Injectable({ multiple: true })
export class ParcelWatcherServer implements IFileSystemWatcherServer {
  private static readonly PARCEL_WATCHER_BACKEND = isWindows ? 'windows' : isLinux ? 'inotify' : 'fs-events';

  private static readonly GLOB_MARKERS = {
    Star: '*',
    GlobStar: '**',
    GlobStarPosix: '**/**',
    GlobStarWindows: '**\\**',
    GlobStarPathStartPosix: '**/',
    GlobStarPathEndPosix: '/**',
    StarPathEndPosix: '/*',
    GlobStarPathStartWindows: '**\\',
    GlobStarPathEndWindows: '\\**',
  };

  protected client: FileSystemWatcherClient | undefined;

  protected watcherSequence = 1;
  protected readonly watchers = new Map<number, { path: string; disposable: IDisposable }>();

  protected readonly toDispose = new DisposableCollection(Disposable.create(() => this.setClient(undefined)));

  protected changes = new FileChangeCollection();

  @Autowired(ILogServiceManager)
  private readonly loggerManager: ILogServiceManager;

  private logger: ILogService;

  constructor() {
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.Node);
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  /**
   * 查找父目录是否已经在监听
   * @param watcherPath
   */
  checkIsAlreadyWatched(watcherPath: string): number {
    let watcherId;
    for (const [_id, watcher] of this.watchers) {
      if (watcherPath.indexOf(watcher.path) === 0) {
        watcherId = this.watcherSequence++;
        this.watchers.set(watcherId, {
          path: watcherPath,
          disposable: new DisposableCollection(),
        });
        break;
      }
    }
    return watcherId;
  }

  /**
   * 如果监听路径不存在，则会监听父目录
   * @param uri 要监听的路径
   * @param options
   * @returns
   */
  async watchFileChanges(uri: string, options?: WatchOptions): Promise<number> {
    const basePath = FileUri.fsPath(uri);
    let realpath;
    if (await fs.pathExists(basePath)) {
      realpath = basePath;
    }
    let watcherId = realpath && this.checkIsAlreadyWatched(realpath);
    if (watcherId) {
      return watcherId;
    }
    watcherId = this.watcherSequence++;
    this.logger.log('Starting watching:', basePath, options);
    const toDisposeWatcher = new DisposableCollection();
    const stat = await fs.lstatSync(basePath);
    if (stat && stat.isDirectory()) {
      this.watchers.set(watcherId, {
        path: realpath,
        disposable: toDisposeWatcher,
      });
      toDisposeWatcher.push(Disposable.create(() => this.watchers.delete(watcherId)));
      await this.start(watcherId, basePath, options, toDisposeWatcher);
    } else {
      const watchPath = await this.lookup(basePath);
      if (watchPath) {
        const existingWatcher = watchPath && this.checkIsAlreadyWatched(watchPath);
        if (existingWatcher) {
          return existingWatcher;
        }
        this.watchers.set(watcherId, {
          path: watchPath,
          disposable: toDisposeWatcher,
        });
        toDisposeWatcher.push(Disposable.create(() => this.watchers.delete(watcherId)));
        await this.start(watcherId, watchPath, options, toDisposeWatcher);
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

  // ref: https://github.com/microsoft/vscode/blob/2a63d7baf2db7eabf141f876581ea4c808a6b8e4/src/vs/platform/files/node/watcher/parcel/parcelWatcher.ts#L170
  protected toExcludePaths(path: string, excludes: string[] | undefined): string[] | undefined {
    if (!Array.isArray(excludes)) {
      return undefined;
    }

    const excludePaths = new Set<string>();

    // Parcel watcher currently does not support glob patterns
    // for native exclusions. As long as that is the case, try
    // to convert exclude patterns into absolute paths that the
    // watcher supports natively to reduce the overhead at the
    // level of the file watcher as much as possible.
    // Refs: https://github.com/parcel-bundler/watcher/issues/64
    for (const exclude of excludes) {
      const isGlob = exclude.includes(ParcelWatcherServer.GLOB_MARKERS.Star);

      // Glob pattern: check for typical patterns and convert
      let normalizedExclude: string | undefined;
      if (isGlob) {
        // Examples: **, **/**, **\**
        if (
          exclude === ParcelWatcherServer.GLOB_MARKERS.GlobStar ||
          exclude === ParcelWatcherServer.GLOB_MARKERS.GlobStarPosix ||
          exclude === ParcelWatcherServer.GLOB_MARKERS.GlobStarWindows
        ) {
          normalizedExclude = path;
        }

        // Examples:
        // - **/node_modules/**
        // - **/.git/objects/**
        // - **/build-folder
        // - output/**
        else {
          const startsWithGlobStar =
            exclude.startsWith(ParcelWatcherServer.GLOB_MARKERS.GlobStarPathStartPosix) ||
            exclude.startsWith(ParcelWatcherServer.GLOB_MARKERS.GlobStarPathStartWindows);
          const endsWithGlobStar =
            exclude.endsWith(ParcelWatcherServer.GLOB_MARKERS.GlobStarPathEndPosix) ||
            exclude.endsWith(ParcelWatcherServer.GLOB_MARKERS.GlobStarPathEndWindows);
          if (startsWithGlobStar || endsWithGlobStar) {
            if (startsWithGlobStar && endsWithGlobStar) {
              normalizedExclude = exclude.substring(
                ParcelWatcherServer.GLOB_MARKERS.GlobStarPathStartPosix.length,
                exclude.length - ParcelWatcherServer.GLOB_MARKERS.GlobStarPathEndPosix.length,
              );
            } else if (startsWithGlobStar) {
              normalizedExclude = exclude.substring(ParcelWatcherServer.GLOB_MARKERS.GlobStarPathStartPosix.length);
            } else {
              normalizedExclude = exclude.substring(
                0,
                exclude.length - ParcelWatcherServer.GLOB_MARKERS.GlobStarPathEndPosix.length,
              );
            }
          }

          // Support even more glob patterns on Linux where we know
          // that each folder requires a file handle to watch.
          // Examples:
          // - node_modules/* (full form: **/node_modules/*/**)
          if (isLinux && normalizedExclude) {
            const endsWithStar = normalizedExclude?.endsWith(ParcelWatcherServer.GLOB_MARKERS.StarPathEndPosix);
            if (endsWithStar) {
              normalizedExclude = normalizedExclude.substring(
                0,
                normalizedExclude.length - ParcelWatcherServer.GLOB_MARKERS.StarPathEndPosix.length,
              );
            }
          }
        }
      }

      // Not a glob pattern, take as is
      else {
        normalizedExclude = exclude;
      }

      if (!normalizedExclude || normalizedExclude.includes(ParcelWatcherServer.GLOB_MARKERS.Star)) {
        continue; // skip for parcel (will be applied later by our glob matching)
      }

      // Absolute path: normalize to watched path and
      // exclude if not a parent of it otherwise.
      if (isAbsolute(normalizedExclude)) {
        const base = new Path(normalizedExclude);
        if (!base.isEqualOrParent(new Path(path))) {
          continue; // exclude points to path outside of watched folder, ignore
        }
        // convert to relative path to ensure we
        // get the correct path casing going forward
        normalizedExclude = normalizedExclude.substr(path.length);
      }

      // Finally take as relative path joined to watched path
      excludePaths.add(rtrim(new Path(path).join(normalizedExclude).toString(), Path.separator));
    }

    if (excludePaths.size > 0) {
      return Array.from(excludePaths);
    }

    return undefined;
  }

  protected async start(
    watcherId: number,
    basePath: string,
    rawOptions: WatchOptions | undefined,
    toDisposeWatcher: DisposableCollection,
  ): Promise<void> {
    let hanlder: ParcelWatcher.AsyncSubscription;
    if (!(await fs.pathExists(basePath))) {
      return;
    }
    const realPath = await fs.realpath(basePath);
    const ignore = this.toExcludePaths(realPath, rawOptions?.excludes);
    hanlder = await ParcelWatcher.subscribe(
      realPath,
      (err, events: ParcelWatcher.Event[]) => {
        if (err) {
          this.logger.error(`Watch path ${realPath} error: `, err);
          return;
        }
        events = this.trimChangeEvent(events);
        for (const event of events) {
          if (event.type === 'create') {
            this.pushAdded(watcherId, event.path);
          }
          if (event.type === 'delete') {
            this.pushDeleted(watcherId, event.path);
          }
          if (event.type === 'update') {
            this.pushUpdated(watcherId, event.path);
          }
        }
      },
      {
        backend: ParcelWatcherServer.PARCEL_WATCHER_BACKEND,
        ignore,
      },
    );

    if (toDisposeWatcher.disposed) {
      await hanlder.unsubscribe();
      return;
    }
    toDisposeWatcher.push(
      Disposable.create(async () => {
        if (hanlder) {
          await hanlder.unsubscribe();
        }
      }),
    );
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
