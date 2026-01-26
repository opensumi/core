import { SumiConnectionMultiplexer } from '@opensumi/ide-connection';
import {
  DidFilesChangedParams,
  Disposable,
  DisposableCollection,
  FileUri,
  FileWatcherFailureParams,
  FileWatcherOverflowParams,
  IDisposable,
  RecursiveWatcherBackend,
} from '@opensumi/ide-core-common';
import { defaultFilesWatcherExcludes, flattenExcludes } from '@opensumi/ide-core-common/lib/preferences/file-watch';
import { URI, Uri, UriComponents } from '@opensumi/ide-utils/lib/uri';

import { IWatcherHostService, WatcherProcessManagerProxy, WatcherServiceProxy } from '../../common/watcher';
import { IWatcher } from '../disk-file-system.provider';

import { RecursiveFileSystemWatcher } from './recursive/file-service-watcher';
import { UnRecursiveFileSystemWatcher } from './un-recursive/file-service-watcher';
import { WatcherProcessLogger } from './watch-process-log';

const watcherPlaceHolder = {
  disposable: {
    dispose: () => {},
  },
  handlers: [],
};

export class WatcherHostServiceImpl implements IWatcherHostService {
  private static WATCHER_SEQUENCE = 1;

  private WATCHER_HANDLERS = new Map<
    number,
    {
      path: string;
      handlers: any;
      disposable: IDisposable;
    }
  >();

  /**
   * recursive file system watcher
   */
  private recursiveFileSystemWatcher?: RecursiveFileSystemWatcher;

  /**
   * unrecursive file system watcher
   */
  private unrecursiveFileSystemWatcher?: UnRecursiveFileSystemWatcher;

  protected readonly watcherCollection = new Map<string, IWatcher>();

  private defaultExcludes: string[] = [];
  private defaultExcludesKey = '';

  private watchedDirs: Set<string> = new Set();

  private watcherServerVersion = 0;

  private pendingWatchers = new Map<
    string,
    {
      id: number;
      uriString: string;
      options?: { excludes?: string[]; recursive?: boolean; pollingWatch?: boolean };
      version: number;
    }
  >();

  private deferredExcludes?: { excludes: string[]; key: string };

  constructor(
    private rpcProtocol: SumiConnectionMultiplexer,
    private logger: WatcherProcessLogger,
    private backend: RecursiveWatcherBackend,
  ) {
    this.rpcProtocol.set(WatcherServiceProxy, this);
    this.defaultExcludes = flattenExcludes(defaultFilesWatcherExcludes);
    this.defaultExcludesKey = this.normalizeExcludes(this.defaultExcludes);
    void this.initWatcherServer(this.defaultExcludes);
    this.logger.log('init watcher host service');
  }

  private normalizeExcludes(excludes: string[] | undefined): string {
    return (excludes ?? []).slice().sort().join('|');
  }

  async initWatcherServer(excludes?: string[], force = false): Promise<void> {
    this.logger.log('init watcher server with: ', JSON.stringify(excludes), ' force: ', force);

    if (this.recursiveFileSystemWatcher && this.unrecursiveFileSystemWatcher && !force) {
      return;
    }

    let rewatchTargets: Array<
      [
        string,
        { options?: { excludes?: string[]; recursive?: boolean; pollingWatch?: boolean }; disposable: IDisposable },
      ]
    > = [];

    if (force) {
      this.logger.log('force to init watcher server, dispose old watcher server');
      this.watcherServerVersion += 1;
      if (this.pendingWatchers.size > 0) {
        for (const [watchPath, pending] of this.pendingWatchers) {
          this.logger.warn('force reinit with pending watcher, cleaning:', watchPath);
          this.WATCHER_HANDLERS.delete(pending.id);
        }
        this.pendingWatchers.clear();
      }
      rewatchTargets = Array.from(this.watcherCollection.entries());

      for (const [_uri, { disposable }] of rewatchTargets) {
        disposable.dispose();
        this.watcherCollection.delete(_uri);
      }

      this.recursiveFileSystemWatcher?.dispose();
      this.unrecursiveFileSystemWatcher?.dispose();
    }

    this.recursiveFileSystemWatcher = new RecursiveFileSystemWatcher(excludes, this.logger, this.backend);
    this.unrecursiveFileSystemWatcher = new UnRecursiveFileSystemWatcher(this.logger);

    const watcherClient = {
      onDidFilesChanged: (events: DidFilesChangedParams) => {
        this.logger.log('onDidFilesChanged: ', events);
        const proxy = this.rpcProtocol.getProxy(WatcherProcessManagerProxy);
        proxy.$onDidFilesChanged(events);
      },
      onWatcherOverflow: (event: FileWatcherOverflowParams) => {
        this.logger.log('onWatcherOverflow: ', event);
        const proxy = this.rpcProtocol.getProxy(WatcherProcessManagerProxy);
        proxy.$onWatcherOverflow?.(event);
      },
      onWatcherFailed: (event: FileWatcherFailureParams) => {
        this.logger.error('onWatcherFailed: ', event);
        const proxy = this.rpcProtocol.getProxy(WatcherProcessManagerProxy);
        proxy.$onWatcherFailed?.(event);
      },
    };

    this.recursiveFileSystemWatcher.setClient(watcherClient);
    this.unrecursiveFileSystemWatcher.setClient(watcherClient);

    if (force) {
      // rewatch after new watcher instances are ready
      const rewatchTasks: Promise<void>[] = [];
      for (const [_uri, { options }] of rewatchTargets) {
        this.logger.log('rewatch file changes: ', _uri, ' recursive: ', options?.recursive);
        rewatchTasks.push(
          this.doWatch(Uri.parse(_uri), options)
            .then(() => undefined)
            .catch((error) => {
              this.logger.error('rewatch failed: ', _uri, error);
            }),
        );
      }
      await Promise.all(rewatchTasks);
    }
  }

  checkIsAlreadyWatched(watcherPath: string): number | undefined {
    const pending = this.pendingWatchers.get(watcherPath);
    if (pending) {
      if (pending.version === this.watcherServerVersion) {
        return pending.id;
      }
      this.pendingWatchers.delete(watcherPath);
      this.WATCHER_HANDLERS.delete(pending.id);
    }
    for (const [watcherId, watcher] of this.WATCHER_HANDLERS) {
      if (watcherPath === watcher.path) {
        const hasCollection = Array.from(this.watcherCollection.keys()).some(
          (uriString) => FileUri.fsPath(uriString) === watcherPath,
        );
        if (!hasCollection) {
          this.logger.warn('stale watcher handler found, cleaning:', watcherPath);
          this.WATCHER_HANDLERS.delete(watcherId);
          return undefined;
        }
        return watcherId;
      }
    }
  }

  private async doWatch(
    uri: Uri,
    options?: { excludes?: string[]; recursive?: boolean; pollingWatch?: boolean },
    retry = 0,
  ): Promise<number> {
    const uriString = uri.toString();
    const basePath = FileUri.fsPath(uriString);
    const watcherVersion = this.watcherServerVersion;
    let watcherId = this.checkIsAlreadyWatched(basePath);

    if (watcherId) {
      this.logger.log(uriString, 'is already watched');
      return watcherId;
    }

    watcherId = WatcherHostServiceImpl.WATCHER_SEQUENCE++;

    this.WATCHER_HANDLERS.set(watcherId, {
      ...watcherPlaceHolder,
      path: basePath,
    });
    this.pendingWatchers.set(basePath, { id: watcherId, uriString, options, version: watcherVersion });

    try {
      await this.initWatcherServer();
    } catch (error) {
      this.pendingWatchers.delete(basePath);
      this.WATCHER_HANDLERS.delete(watcherId);
      throw error;
    }

    const recursiveWatcher = this.recursiveFileSystemWatcher!;
    const unrecursiveWatcher = this.unrecursiveFileSystemWatcher!;

    this.logger.log('watch file changes: ', uriString, ' recursive: ', options?.recursive);

    const mergedExcludes = new Set([...(options?.excludes ?? []), ...this.defaultExcludes]);

    const disposables = new DisposableCollection();
    const startWatchers: Promise<void>[] = [];
    let unrecursiveWatchStarted = false;
    let recursiveWatchStarted = false;

    startWatchers.push(
      unrecursiveWatcher.watchFileChanges(uriString).then(() => {
        unrecursiveWatchStarted = true;
      }),
    );

    if (options?.recursive) {
      this.logger.log('use recursive watcher for: ', uriString);
      startWatchers.push(
        recursiveWatcher
          .watchFileChanges(uriString, {
            excludes: Array.from(mergedExcludes),
            pollingWatch: options?.pollingWatch,
          })
          .then(() => {
            recursiveWatchStarted = true;
          })
          .catch((error) => {
            // watch error or timeout
            this.logger.error('watch error: ', error);
          }),
      );
    }

    try {
      await Promise.all(startWatchers);
    } finally {
      this.pendingWatchers.delete(basePath);
      if (this.pendingWatchers.size === 0 && this.deferredExcludes) {
        const deferred = this.deferredExcludes;
        this.deferredExcludes = undefined;
        if (deferred.key !== this.defaultExcludesKey) {
          this.defaultExcludes = deferred.excludes;
          this.defaultExcludesKey = deferred.key;
          await this.initWatcherServer(deferred.excludes, true);
        }
      }
    }

    if (watcherVersion !== this.watcherServerVersion) {
      this.logger.warn('watcher server reset while starting watch, retrying:', uriString);
      try {
        unrecursiveWatcher.unwatchFileChanges(uriString);
      } catch (error) {
        this.logger.error('failed to cleanup unrecursive watcher after reset:', error);
      }
      try {
        recursiveWatcher.unwatchFileChanges(uriString);
      } catch (error) {
        this.logger.error('failed to cleanup recursive watcher after reset:', error);
      }
      this.WATCHER_HANDLERS.delete(watcherId);
      if (retry < 1) {
        return this.doWatch(uri, options, retry + 1);
      }
    }

    if (unrecursiveWatchStarted) {
      disposables.push(
        Disposable.create(async () => {
          unrecursiveWatcher.unwatchFileChanges(uriString);
          this.logger.log('dispose unrecursive watcher: ', uriString);
          this.watchedDirs.delete(uriString);
          this.WATCHER_HANDLERS.delete(watcherId);
        }),
      );
    }

    if (recursiveWatchStarted) {
      disposables.push(
        Disposable.create(async () => {
          this.logger.log('dispose recursive watcher: ', uriString);
          recursiveWatcher.unwatchFileChanges(uriString);
          this.watchedDirs.delete(uriString);
          this.WATCHER_HANDLERS.delete(watcherId);
        }),
      );
    }

    this.watcherCollection.set(uriString, { id: watcherId, options, disposable: disposables });

    this.watchedDirs.add(uriString);

    return watcherId;
  }

  async $watch(
    uri: UriComponents,
    options?: { excludes?: string[]; recursive?: boolean; pollingWatch?: boolean },
  ): Promise<number> {
    const _uri = URI.revive(uri);
    return this.doWatch(_uri, options);
  }

  async $unwatch(watcherId: number): Promise<void> {
    this.logger.log('unwatch file changes: ', watcherId);
    for (const [_uri, { id, disposable }] of this.watcherCollection) {
      if (watcherId === id) {
        this.watchedDirs.delete(_uri);
        disposable.dispose();
        this.watcherCollection.delete(_uri);
      }
    }
  }

  async $setWatcherFileExcludes(excludes: string[]): Promise<void> {
    this.logger.log('set watcher file excludes: ', excludes);
    const nextKey = this.normalizeExcludes(excludes);
    if (nextKey === this.defaultExcludesKey && this.recursiveFileSystemWatcher && this.unrecursiveFileSystemWatcher) {
      this.logger.log('watcher excludes unchanged, skip reinit');
      return;
    }
    if (this.pendingWatchers.size > 0) {
      this.logger.log('watchers pending, defer reinit until ready');
      this.deferredExcludes = { excludes, key: nextKey };
      return;
    }
    this.defaultExcludes = excludes;
    this.defaultExcludesKey = nextKey;
    await this.initWatcherServer(excludes, true);
  }

  async $dispose(): Promise<void> {
    this.logger.log('dispose watcher host service');
    this.unrecursiveFileSystemWatcher?.dispose();
    this.recursiveFileSystemWatcher?.dispose();
    process.exit(0);
  }
}
