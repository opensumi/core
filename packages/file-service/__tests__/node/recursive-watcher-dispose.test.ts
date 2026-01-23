import * as fse from 'fs-extra';
import temp from 'temp';

import { DisposableCollection, FileUri, WatchOptions } from '@opensumi/ide-core-common';
import { ILogServiceManager } from '@opensumi/ide-core-common/lib/log';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { RecursiveFileSystemWatcher } from '../../src/node/hosted/recursive/file-service-watcher';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
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

class TestRecursiveFileSystemWatcher extends RecursiveFileSystemWatcher {
  public readonly startDeferred = createDeferred<DisposableCollection>();

  protected async start(_basePath: string, _rawOptions?: WatchOptions): Promise<DisposableCollection> {
    return this.startDeferred.promise;
  }
}

describe('RecursiveFileSystemWatcher dispose', () => {
  const track = temp.track();

  const createLogger = () => {
    const injector = createNodeInjector([]);
    return injector.get(ILogServiceManager).getLogger();
  };

  afterAll(() => {
    track.cleanupSync();
  });

  it('rejects watch requests after dispose', async () => {
    const watcher = new RecursiveFileSystemWatcher([], createLogger());
    watcher.dispose();

    await expect(watcher.watchFileChanges(FileUri.create('/tmp/recursive-disposed').toString())).rejects.toThrow(
      /disposed/,
    );
  });

  it('cleans up when disposed while starting', async () => {
    const root = FileUri.create(fse.realpathSync(await temp.mkdir('recursive-dispose-test')));
    const watcher = new TestRecursiveFileSystemWatcher([], createLogger());

    const watchPromise = watcher.watchFileChanges(root.path.toString());

    watcher.dispose();
    watcher.startDeferred.resolve(new DisposableCollection());

    await expect(watchPromise).rejects.toThrow(/disposed while starting/);

    const handlers = (watcher as any).WATCHER_HANDLERS as Map<string, unknown>;
    const watchPathMap = (watcher as any).watchPathMap as Map<string, unknown>;
    expect(handlers.size).toBe(0);
    expect(watchPathMap.size).toBe(0);
  });
});
