import { SumiConnectionMultiplexer } from '@opensumi/ide-connection';
import { DidFilesChangedParams, FileUri, IDisposable, RecursiveWatcherBackend } from '@opensumi/ide-core-common';
import { defaultFilesWatcherExcludes, flattenExcludes } from '@opensumi/ide-core-common/lib/preferences/file-watch';
import { URI, Uri, UriComponents } from '@opensumi/ide-utils/lib/uri';

import { IWatcherHostService, WatcherProcessManagerProxy, WatcherServiceProxy } from '../../common/watcher';
import { IWatcher } from '../disk-file-system.provider';

import { FileSystemWatcherServer } from './recursive/file-service-watcher';
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
  private recursiveFileSystemWatcher?: FileSystemWatcherServer;

  /**
   * unrecursive file system watcher
   */
  private unrecursiveFileSystemWatcher?: UnRecursiveFileSystemWatcher;

  protected readonly watcherCollection = new Map<string, IWatcher>();

  private defaultExcludes: string[] = [];

  private watchedDirs: Set<string> = new Set();

  constructor(
    private rpcProtocol: SumiConnectionMultiplexer,
    private logger: WatcherProcessLogger,
    private backend: RecursiveWatcherBackend,
  ) {
    this.rpcProtocol.set(WatcherServiceProxy, this);
    this.defaultExcludes = flattenExcludes(defaultFilesWatcherExcludes);
    this.initWatcherServer(this.defaultExcludes);
    this.logger.log('init watcher host service');
  }

  initWatcherServer(excludes?: string[], force = false) {
    this.logger.log('init watcher server with: ', JSON.stringify(excludes), ' force: ', force);

    if (this.recursiveFileSystemWatcher && this.unrecursiveFileSystemWatcher && !force) {
      return;
    }

    if (force) {
      this.logger.log('force to init watcher server, dispose old watcher server');
      this.recursiveFileSystemWatcher?.dispose();
      this.unrecursiveFileSystemWatcher?.dispose();

      // rewatch
      for (const [_uri, { options, disposable }] of this.watcherCollection) {
        this.doWatch(Uri.parse(_uri), options);
        this.logger.log('rewatch file changes: ', _uri, ' recursive: ', options?.recursive);
        disposable.dispose();
      }
    }

    this.recursiveFileSystemWatcher = new FileSystemWatcherServer(excludes, this.logger, this.backend);
    this.unrecursiveFileSystemWatcher = new UnRecursiveFileSystemWatcher(this.logger);

    const watcherClient = {
      onDidFilesChanged: (events: DidFilesChangedParams) => {
        this.logger.log('watcher server onDidFilesChanged: ', events);
        const proxy = this.rpcProtocol.getProxy(WatcherProcessManagerProxy);
        proxy.$onDidFilesChanged(events);
      },
    };

    this.recursiveFileSystemWatcher.setClient(watcherClient);
    this.unrecursiveFileSystemWatcher.setClient(watcherClient);
  }

  private getWatcherServer(recursive?: boolean) {
    const useRecursiveServer = recursive;
    let watcherServer: FileSystemWatcherServer | UnRecursiveFileSystemWatcher;
    this.initWatcherServer();

    if (useRecursiveServer) {
      watcherServer = this.recursiveFileSystemWatcher!;
    } else {
      watcherServer = this.unrecursiveFileSystemWatcher!;
    }

    return watcherServer;
  }

  checkIsAlreadyWatched(watcherPath: string): number | undefined {
    for (const [watcherId, watcher] of this.WATCHER_HANDLERS) {
      if (watcherPath.indexOf(watcher.path) === 0) {
        return watcherId;
      }
    }
  }

  private async doWatch(
    uri: Uri,
    options?: { excludes?: string[]; recursive?: boolean; pollingWatch?: boolean },
  ): Promise<number> {
    this.initWatcherServer();
    const basePath = FileUri.fsPath(uri.toString());
    let watcherId = this.checkIsAlreadyWatched(basePath);

    if (watcherId) {
      this.logger.log(uri.toString(), 'is already watched');
      return watcherId;
    }

    watcherId = WatcherHostServiceImpl.WATCHER_SEQUENCE++;

    this.WATCHER_HANDLERS.set(watcherId, {
      ...watcherPlaceHolder,
      path: basePath,
    });

    this.logger.log('watch file changes: ', uri.toString(), ' recursive: ', options?.recursive);

    const mergedExcludes = new Set([...(options?.excludes ?? []), ...this.defaultExcludes]);

    if (options?.recursive) {
      await this.recursiveFileSystemWatcher!.watchFileChanges(uri.toString(), {
        excludes: Array.from(mergedExcludes),
        pollingWatch: options?.pollingWatch,
      });

      const disposable = {
        dispose: () => {
          this.recursiveFileSystemWatcher!.unwatchFileChanges(uri.toString());
          this.watchedDirs.delete(uri.toString());
        },
      };

      this.watcherCollection.set(uri.toString(), { id: watcherId, options, disposable });
    }

    await this.unrecursiveFileSystemWatcher!.watchFileChanges(uri.toString());

    const disposable = {
      dispose: () => {
        this.recursiveFileSystemWatcher!.unwatchFileChanges(uri.toString());
        this.watchedDirs.delete(uri.toString());
      },
    };

    this.watcherCollection.set(uri.toString(), { id: watcherId, options, disposable });

    this.watchedDirs.add(uri.toString());

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
    this.initWatcherServer(excludes, true);
  }

  async $dispose(): Promise<void> {
    this.logger.log('dispose watcher host service');
    this.unrecursiveFileSystemWatcher?.dispose();
    this.recursiveFileSystemWatcher?.dispose();
    process.exit(0);
  }
}
