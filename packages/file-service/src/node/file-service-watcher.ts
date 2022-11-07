import paths, { isAbsolute } from 'path';

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
    let exist = await fs.pathExists(basePath);

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

  private getDefaultWatchExclude() {
    return ['**/.git/objects/**', '**/.git/subtree-cache/**', '**/node_modules/**/*'];
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
    const ignore = this.toExcludePaths(
      realPath,
      this.excludes.concat(rawOptions?.excludes || this.getDefaultWatchExclude()),
    );

    const tryWatchDir = async (maxRetries = 3, retryDelay = 1000) => {
      for (let times = 0; times < maxRetries; times++) {
        try {
          return await ParcelWatcher.subscribe(
            realPath,
            (err, events: ParcelWatcher.Event[]) => {
              // 对于超过5000数量的 events 做屏蔽优化，避免潜在的卡死问题
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
              ignore,
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
