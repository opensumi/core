import { createConnection } from 'net';

import { SumiConnectionMultiplexer } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers';
import { argv } from '@opensumi/ide-core-common/lib/node/cli';
import { suppressNodeJSEpipeError } from '@opensumi/ide-core-common/lib/node/utils';
import { DidFilesChangedParams } from '@opensumi/ide-core-common/lib/types';
import { Uri, UriComponents, isPromiseCanceledError } from '@opensumi/ide-utils';

import { IWatcherHostService, KT_WATCHER_PROCESS_SOCK_KEY, WATCHER_INIT_DATA_KEY, WatcherProcessManagerProxy, WatcherServiceProxy } from '../../common/watcher';
import { IWatcher } from '../disk-file-system.provider';

import { FileSystemWatcherServer } from './recursive/file-service-watcher';
import { UnRecursiveFileSystemWatcher } from './un-recursive/file-service-watcher';
import { WatcherProcessLogger } from './watch-process-log';

class WatcherHostServiceImpl implements IWatcherHostService {
  /**
 * recursive file system watcher
 */
  private recursiveFileSystemWatcher?: FileSystemWatcherServer;

  /**
   * unrecursive file system watcher
   */
  private unrecursiveFileSystemWatcher?: UnRecursiveFileSystemWatcher;

  private ignoreNextChangesEvent: Set<string> = new Set();

  protected readonly watcherCollection = new Map<string, IWatcher>();
  protected watchFileExcludes: string[] = [];

  constructor(
    private rpcProtocol: SumiConnectionMultiplexer, private logger: WatcherProcessLogger,
  ) {
    this.rpcProtocol.set(WatcherServiceProxy, this);
    this.initWatcherServer();
  }

  initWatcherServer(excludes?: string[], force = false) {
    if (this.recursiveFileSystemWatcher && this.unrecursiveFileSystemWatcher && !force) {
      return;
    }

    if (force) {
      this.recursiveFileSystemWatcher?.dispose();
      this.unrecursiveFileSystemWatcher?.dispose();
    }

    this.recursiveFileSystemWatcher = new FileSystemWatcherServer(excludes);
    this.unrecursiveFileSystemWatcher = new UnRecursiveFileSystemWatcher(excludes);

    const watcherClient = {
      onDidFilesChanged: (events: DidFilesChangedParams) => {
        if (events.changes.length > 0) {
          const changes = events.changes.filter((c) => !this.ignoreNextChangesEvent.has(c.uri));
          const proxy = this.rpcProtocol.getProxy(WatcherProcessManagerProxy);
          proxy.$onDidFilesChanged(changes);
        }
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


  async $watch(uri: UriComponents, options?: { excludes?: string[]; recursive?: boolean }): Promise<number> {
    const _uri = Uri.revive(uri);

    const watcherServer = this.getWatcherServer(options?.recursive);
    if (!watcherServer) {
      return -1;
    }

    const id = await watcherServer.watchFileChanges(_uri.toString(), {
      excludes: options?.excludes ?? [],
    });
    const disposable = {
      dispose: () => {
        watcherServer.unwatchFileChanges(id);
      },
    };

    this.watcherCollection.set(_uri.toString(), { id, options, disposable });
    return id;
  }

  async $unwatch(watcherId: number): Promise<void> {
    for (const [_uri, { id, disposable }] of this.watcherCollection) {
      if (watcherId === id) {
        disposable.dispose();
      }
    }
  }

  $setWatcherFileExcludes(excludes: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  $dispose(): Promise<void> {
    throw new Error('Method not implemented.');
  }

}

async function initWatcherProcess() {
  const initData = JSON.parse(argv[WATCHER_INIT_DATA_KEY]);
  const connection = JSON.parse(argv[KT_WATCHER_PROCESS_SOCK_KEY]);


  const socket = createConnection(connection);

  const watcherProtocol = new SumiConnectionMultiplexer(
    new NetSocketConnection(socket),
    {
      timeout: 1000,
    },
  );

  const logger = new WatcherProcessLogger(initData.logDir, initData.logLevel);
  const watcherHostService = new WatcherHostServiceImpl(watcherProtocol, logger);
  watcherHostService.initWatcherServer();
}

(async () => {
  await initWatcherProcess();
})();


function unexpectedErrorHandler(e) {
  setTimeout(() => {
    console.log('[Watcehr-Host]', e.message, e.stack && '\n\n' + e.stack);
  }, 0);
}

function onUnexpectedError(e: any) {
  let err = e;
  if (!err) {
    return;
  }

  if (isPromiseCanceledError(err)) {
    return;
  }

  if (!(err instanceof Error)) {
    err = new Error(e);
  }
  unexpectedErrorHandler(err);
}

suppressNodeJSEpipeError(process, (msg) => {
});

process.on('uncaughtException', (err) => {
  onUnexpectedError(err);
});

const unhandledPromises: Promise<any>[] = [];
process.on('unhandledRejection', (reason, promise) => {
  unhandledPromises.push(promise);
  setTimeout(() => {
    const idx = unhandledPromises.indexOf(promise);
    if (idx >= 0) {
      promise.catch((e) => {
        unhandledPromises.splice(idx, 1);
        onUnexpectedError(e);
      });
    }
  }, 1000);
});

process.on('rejectionHandled', (promise: Promise<any>) => {
  const idx = unhandledPromises.indexOf(promise);
  if (idx >= 0) {
    unhandledPromises.splice(idx, 1);
  }
});
