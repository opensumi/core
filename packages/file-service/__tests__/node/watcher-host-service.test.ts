import { tmpdir } from 'os';
import { join } from 'path';

import { RecursiveWatcherBackend } from '@opensumi/ide-core-common';
import { createMockPairRPCProtocol } from '@opensumi/ide-extension/__mocks__/initRPCProtocol';
import { URI } from '@opensumi/ide-utils/lib/uri';

import { RecursiveFileSystemWatcher } from '../../src/node/hosted/recursive/file-service-watcher';
import { UnRecursiveFileSystemWatcher } from '../../src/node/hosted/un-recursive/file-service-watcher';
import { WatcherHostServiceImpl } from '../../src/node/hosted/watcher.host.service';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

interface WatcherMockState {
  unrecursiveWatchDefers: Array<Deferred<void>>;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function getMockState(): WatcherMockState {
  const globalAny = globalThis as { __watcherHostServiceMockState?: WatcherMockState };
  if (!globalAny.__watcherHostServiceMockState) {
    globalAny.__watcherHostServiceMockState = { unrecursiveWatchDefers: [] };
  }
  return globalAny.__watcherHostServiceMockState;
}

jest.mock('../../src/node/hosted/recursive/file-service-watcher', () => ({
  RecursiveFileSystemWatcher: jest.fn().mockImplementation(() => ({
    setClient: jest.fn(),
    dispose: jest.fn(),
    watchFileChanges: jest.fn().mockResolvedValue(undefined),
    unwatchFileChanges: jest.fn(),
  })),
}));

jest.mock('../../src/node/hosted/un-recursive/file-service-watcher', () => {
  const state = getMockState();
  return {
    UnRecursiveFileSystemWatcher: jest.fn().mockImplementation(() => ({
      setClient: jest.fn(),
      dispose: jest.fn(),
      watchFileChanges: jest.fn(() => {
        const deferred = state.unrecursiveWatchDefers.shift();
        return deferred ? deferred.promise : Promise.resolve();
      }),
      unwatchFileChanges: jest.fn(),
    })),
  };
});

describe('WatcherHostServiceImpl', () => {
  const makeUri = () => URI.file(join(tmpdir(), 'watcher-host-service-test')).codeUri.toJSON();

  const createService = () => {
    const { rpcProtocolMain } = createMockPairRPCProtocol();
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      critical: jest.fn(),
    };
    return new WatcherHostServiceImpl(rpcProtocolMain, logger as any, RecursiveWatcherBackend.NSFW);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getMockState().unrecursiveWatchDefers.length = 0;
  });

  it('dedupes pending watch requests', async () => {
    const pendingWatch = createDeferred<void>();
    getMockState().unrecursiveWatchDefers.push(pendingWatch);

    const service = createService();
    const uri = makeUri();

    const firstWatchPromise = service.$watch(uri);
    const secondWatchId = await service.$watch(uri);

    pendingWatch.resolve();
    const firstWatchId = await firstWatchPromise;

    expect(secondWatchId).toBe(firstWatchId);

    const unrecursiveCtor = UnRecursiveFileSystemWatcher as unknown as jest.Mock;
    expect(unrecursiveCtor).toHaveBeenCalledTimes(1);
    const unrecursiveInstance = unrecursiveCtor.mock.results[0].value;
    expect(unrecursiveInstance.watchFileChanges).toHaveBeenCalledTimes(1);
  });

  it('defers excludes reinit until pending watch completes and retries', async () => {
    const pendingWatch = createDeferred<void>();
    getMockState().unrecursiveWatchDefers.push(pendingWatch);

    const service = createService();
    const uri = makeUri();

    const watchPromise = service.$watch(uri);
    await service.$setWatcherFileExcludes(['**/foo/**']);

    const recursiveCtor = RecursiveFileSystemWatcher as unknown as jest.Mock;
    const unrecursiveCtor = UnRecursiveFileSystemWatcher as unknown as jest.Mock;
    expect(recursiveCtor).toHaveBeenCalledTimes(1);
    expect(unrecursiveCtor).toHaveBeenCalledTimes(1);

    pendingWatch.resolve();
    await watchPromise;

    expect(recursiveCtor).toHaveBeenCalledTimes(2);
    expect(unrecursiveCtor).toHaveBeenCalledTimes(2);
    const firstUnrecursive = unrecursiveCtor.mock.results[0].value;
    const secondUnrecursive = unrecursiveCtor.mock.results[1].value;
    expect(firstUnrecursive.watchFileChanges).toHaveBeenCalledTimes(1);
    expect(secondUnrecursive.watchFileChanges).toHaveBeenCalledTimes(1);
  });

  it('skips reinit when excludes are unchanged', async () => {
    const service = createService();
    const defaultExcludes = (service as any).defaultExcludes as string[];

    await service.$setWatcherFileExcludes([...defaultExcludes]);

    const recursiveCtor = RecursiveFileSystemWatcher as unknown as jest.Mock;
    const unrecursiveCtor = UnRecursiveFileSystemWatcher as unknown as jest.Mock;
    expect(recursiveCtor).toHaveBeenCalledTimes(1);
    expect(unrecursiveCtor).toHaveBeenCalledTimes(1);
  });
});
