import * as fse from 'fs-extra';
import temp from 'temp';

import { URI } from '@opensumi/ide-core-common';
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
  const sleepTime = 1000;
  let injector: MockInjector;
  let root: URI;
  let watcherServer: ParcelWatcherServer;
  let watcherId: number;
  jest.setTimeout(10000);

  beforeEach(async () => {
    injector = createBrowserInjector([]);
    root = FileUri.create(await fse.realpath(await temp.mkdir('node-fs-root')));
    watcherServer = injector.get(ParcelWatcherServer);
    watcherId = await watcherServer.watchFileChanges(root.toString());
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

    await fse.mkdir(FileUri.fsPath(root.resolve('foo')));
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo'))).isDirectory()).toBe(true);

    await fse.mkdir(FileUri.fsPath(root.resolve('foo').resolve('bar')));
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo').resolve('bar'))).isDirectory()).toBe(true);

    await fse.writeFile(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'baz');
    expect(fse.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual(
      'baz',
    );
    await sleep(sleepTime);
    expect(expectedUris).toEqual(Array.from(actualUris));
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

  it('Merge common events on one watcher', async () => {
    const newFolder = FileUri.fsPath(root.resolve('test'));
    expect(watcherId).toBeDefined();
    fse.mkdirSync(newFolder);
    const newWatcherId = await watcherServer.watchFileChanges(newFolder);
    expect(newWatcherId === watcherId).toBeTruthy();
  });

  it('Can receive events while watch file is not existed', async () => {
    const newFolder = FileUri.fsPath(root.resolve('test'));
    expect(watcherId).toBeDefined();
    fse.mkdirSync(newFolder);
    const parentId = await watcherServer.watchFileChanges(newFolder);
    const childFile = FileUri.fsPath(root.resolve('test').resolve('index.js'));
    const childId = await watcherServer.watchFileChanges(childFile);
    expect(parentId === childId).toBeTruthy();
  });

  it('Excludes options should be worked', async () => {
    const watcherClient = {
      onDidFilesChanged: jest.fn(),
    };
    watcherServer.setClient(watcherClient);
    const folder1 = FileUri.fsPath(root.resolve('folder1'));
    const fileA = FileUri.fsPath(root.resolve('folder1').resolve('a'));
    const fileB = FileUri.fsPath(root.resolve('folder1').resolve('b'));
    fse.mkdirSync(folder1);
    await sleep(sleepTime);
    watcherClient.onDidFilesChanged.mockClear();
    let id = await watcherServer.watchFileChanges(folder1, { excludes: [] });
    await fse.ensureFile(fileA);
    await sleep(sleepTime);
    expect(watcherClient.onDidFilesChanged).toBeCalledTimes(1);
    await watcherServer.unwatchFileChanges(id);
    id = await watcherServer.watchFileChanges(folder1, { excludes: ['**/b/**'] });
    await fse.ensureFile(fileB);
    await sleep(sleepTime);
    expect(watcherClient.onDidFilesChanged).toBeCalledTimes(1);
    watcherServer.unwatchFileChanges(id);
  });
});

describe('Watch file rename/move/new', () => {
  const track = temp.track();
  const sleepTime = 500;
  let root: URI;
  let watcherServer: ParcelWatcherServer;
  let injector: MockInjector;
  jest.setTimeout(10000);

  beforeEach(async () => {
    injector = createBrowserInjector([]);
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

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
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

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
  });

  it('New file', async () => {
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

    const expectedAddUris = [root.resolve('README.md').toString()];

    const expectedDeleteUris = [];

    await fse.ensureFile(root.resolve('README.md').codeUri.fsPath.toString());
    await sleep(sleepTime);

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
  });
});
