import { execSync } from 'child_process';

import * as fse from 'fs-extra';
import temp from 'temp';

import { ILogServiceManager, URI } from '@opensumi/ide-core-common';
import { FileUri } from '@opensumi/ide-core-node';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { DidFilesChangedParams, FileChangeType } from '../../src/common';
import { ParcelWatcherServer } from '../../src/node/file-service-watcher';

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

describe('ParceWatcher Test', () => {
  const track = temp.track();
  const sleepTime = 1500;
  let injector: MockInjector;
  let root: URI;
  let watcherServer: ParcelWatcherServer;
  let watcherId: number;
  jest.setTimeout(10000);

  beforeEach(async () => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: ILogServiceManager,
      useValue: {
        getLogger: () => console,
      },
    });
    root = FileUri.create(fse.realpathSync(temp.mkdirSync('node-fs-root')));
    watcherServer = injector.get(ParcelWatcherServer);
    watcherId = await watcherServer.watchFileChanges(root.toString());
    await sleep(sleepTime);
  });

  afterEach(async () => {
    track.cleanupSync();
    watcherServer.dispose();
  });

  it('Should receive file changes events from in the workspace by default.', async () => {
    const actualUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => actualUris.add(c.uri.toString()));
      },
    };
    watcherServer.setClient(watcherClient);

    const expectedUris = [
      root.resolve('foo').toString(),
      root.withPath(root.path.join('foo', 'bar')).toString(),
      root.withPath(root.path.join('foo', 'bar', 'baz.txt')).toString(),
    ];

    fse.mkdirSync(FileUri.fsPath(root.resolve('foo')));
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fse.mkdirSync(FileUri.fsPath(root.resolve('foo').resolve('bar')));
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo').resolve('bar'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fse.writeFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'baz');
    expect(fse.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual(
      'baz',
    );
    await sleep(sleepTime);
    expect(expectedUris).toEqual([...actualUris]);
  });

  it('Should not receive file changes events from in the workspace by default if unwatched', async () => {
    const actualUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => actualUris.add(c.uri.toString()));
      },
    };
    watcherServer.setClient(watcherClient);

    /* Unwatch root */
    await watcherServer.unwatchFileChanges(watcherId);

    fse.mkdirSync(FileUri.fsPath(root.resolve('foo')));
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fse.mkdirSync(FileUri.fsPath(root.resolve('foo').resolve('bar')));
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo').resolve('bar'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fse.writeFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'baz');
    expect(fse.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual(
      'baz',
    );
    await sleep(sleepTime);

    expect(actualUris.size).toEqual(0);
  });
});

describe('Watch file rename/move/new', () => {
  const track = temp.track();
  const sleepTime = 1500;
  let root: URI;
  let watcherServer: ParcelWatcherServer;
  let injector: MockInjector;
  jest.setTimeout(10000);

  beforeEach(async () => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: ILogServiceManager,
      useValue: {
        getLogger: () => console,
      },
    });
    root = FileUri.create(fse.realpathSync(temp.mkdirSync('node-fs-root')));
    fse.mkdirpSync(FileUri.fsPath(root.resolve('for_rename_folder')));
    fse.writeFileSync(FileUri.fsPath(root.resolve('for_rename')), 'rename');
    watcherServer = injector.get(ParcelWatcherServer);
    await watcherServer.watchFileChanges(root.toString());
    await sleep(sleepTime);
  });

  afterEach(() => {
    track.cleanupSync();
    watcherServer.dispose();
  });

  it('Rename file', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => {
          if (c.type === FileChangeType.ADDED) {
            addUris.add(c.uri);
          }
          if (c.type === FileChangeType.DELETED) {
            deleteUris.add(c.uri);
          }
        });
      },
    };

    watcherServer.setClient(watcherClient);

    const expectedAddUris = [root.resolve('for_rename_renamed').toString()];

    const expectedDeleteUris = [root.resolve('for_rename').toString()];

    fse.renameSync(FileUri.fsPath(root.resolve('for_rename')), FileUri.fsPath(root.resolve('for_rename_renamed')));
    await sleep(sleepTime);

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
  });

  it('Move file', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => {
          if (c.type === FileChangeType.ADDED) {
            addUris.add(c.uri);
          }
          if (c.type === FileChangeType.DELETED) {
            deleteUris.add(c.uri);
          }
        });
      },
    };

    watcherServer.setClient(watcherClient);

    const expectedAddUris = [root.resolve('for_rename_folder').resolve('for_rename').toString()];

    const expectedDeleteUris = [root.resolve('for_rename').toString()];
    await fse.move(
      FileUri.fsPath(root.resolve('for_rename')),
      FileUri.fsPath(root.resolve('for_rename_folder').resolve('for_rename')),
      {
        overwrite: true,
      },
    );

    await sleep(sleepTime);

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
  });

  it('Move file on current directry', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => {
          if (c.type === FileChangeType.ADDED) {
            addUris.add(c.uri);
          }
          if (c.type === FileChangeType.DELETED) {
            deleteUris.add(c.uri);
          }
        });
      },
    };

    watcherServer.setClient(watcherClient);

    const expectedAddUris = [root.resolve('for_rename_1').toString()];

    const expectedDeleteUris = [root.resolve('for_rename').toString()];
    await fse.move(FileUri.fsPath(root.resolve('for_rename')), FileUri.fsPath(root.resolve('for_rename_1')), {
      overwrite: true,
    });

    await sleep(sleepTime);

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
  });

  it.skip('new file', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => {
          if (c.type === FileChangeType.ADDED) {
            addUris.add(c.uri);
          }
          if (c.type === FileChangeType.DELETED) {
            deleteUris.add(c.uri);
          }
        });
      },
    };

    watcherServer.setClient(watcherClient);

    const expectedAddUris = [root.resolve('中文.md').toString()];

    const expectedDeleteUris = [];

    await new Promise<void>((resolve) => {
      execSync('touch 中文.md', {
        cwd: FileUri.fsPath(root),
      });
      resolve();
    });
    await sleep(sleepTime);

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
  });
});

process.on('unhandledRejection', (reason: any) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection: ' + reason);
});
