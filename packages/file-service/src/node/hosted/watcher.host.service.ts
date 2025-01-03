import { SumiConnectionMultiplexer } from '@opensumi/ide-connection';
import { DidFilesChangedParams, RecursiveWatcherBackend } from '@opensumi/ide-core-common';
import { defaultFilesWatcherExcludes, flattenExcludes } from '@opensumi/ide-core-common/lib/preferences/file-watch';
import { URI, Uri, UriComponents } from '@opensumi/ide-utils/lib/uri';

import { IWatcherHostService, WatcherProcessManagerProxy, WatcherServiceProxy } from '../../common/watcher';
import { IWatcher } from '../disk-file-system.provider';

import { FileSystemWatcherServer } from './recursive/file-service-watcher';
import { UnRecursiveFileSystemWatcher } from './un-recursive/file-service-watcher';
import { WatcherProcessLogger } from './watch-process-log';

export class WatcherHostServiceImpl implements IWatcherHostService {
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

  private async doWatch(
    uri: Uri,
    options?: { excludes?: string[]; recursive?: boolean; pollingWatch?: boolean },
  ): Promise<number> {
    const watcherServer = this.getWatcherServer(options?.recursive);
    if (!watcherServer) {
      return -1;
    }

    this.logger.log('watch file changes: ', uri.toString(), ' recursive: ', options?.recursive);

    const mergedExcludes = new Set([...(options?.excludes ?? []), ...this.defaultExcludes]);
    const id = await watcherServer.watchFileChanges(uri.toString(), {
      excludes: Array.from(mergedExcludes),
      pollingWatch: options?.pollingWatch,
    });

    this.watchedDirs.add(uri.toString());

    const disposable = {
      dispose: () => {
        watcherServer.unwatchFileChanges(id);
        this.watchedDirs.delete(uri.toString());
      },
    };

    this.watcherCollection.set(uri.toString(), { id, options, disposable });
    return id;
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
