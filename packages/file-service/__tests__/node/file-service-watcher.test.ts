import * as fse from 'fs-extra';
import temp from 'temp';

import { isMacintosh, sleep } from '@opensumi/ide-core-common';
import { ILogServiceManager } from '@opensumi/ide-core-common/lib/log';
import { FileUri } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { DidFilesChangedParams, FileChangeType } from '../../src/common';
import { RecursiveFileSystemWatcher } from '../../src/node/hosted/recursive/file-service-watcher';

const sleepTime = 1000;

(isMacintosh ? describe.skip : describe)('ParceWatcher Test', () => {
  const track = temp.track();
  const watcherServerList: RecursiveFileSystemWatcher[] = [];
  let seed = 1;

  async function generateWatcher() {
    const injector = createNodeInjector([]);
    const root = FileUri.create(fse.realpathSync(await temp.mkdir(`parce-watcher-test-${seed++}`)));
    const watcherServer = new RecursiveFileSystemWatcher([], injector.get(ILogServiceManager).getLogger());

    await watcherServer.watchFileChanges(root.path.toString());

    return { root, watcherServer };
  }

  afterAll(async () => {
    track.cleanupSync();
    watcherServerList.forEach((watcherServer) => {
      watcherServer.dispose();
    });
  });

  it('Should receive file changes events from in the workspace by default.', async () => {
    const actualUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => actualUris.add(c.uri.toString()));
      },
    };

    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedUris = [
      root.toString(),
      root.resolve('foo').toString(),
      root.withPath(root.path.join('foo', 'bar')).toString(),
      root.withPath(root.path.join('foo', 'bar', 'baz.txt')).toString(),
    ];

    await fse.mkdir(FileUri.fsPath(root.resolve('foo')), { recursive: true });
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo'))).isDirectory()).toBe(true);

    await fse.mkdir(FileUri.fsPath(root.resolve('foo').resolve('bar')), { recursive: true });
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo').resolve('bar'))).isDirectory()).toBe(true);

    await fse.writeFile(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'baz');
    expect(fse.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual(
      'baz',
    );
    await sleep(sleepTime);
    expect(Array.from(actualUris).some((val) => expectedUris.includes(val))).toBeTruthy();

    watcherServerList.push(watcherServer);
  });

  it('Should not receive file changes events from in the workspace by default if unwatched', async () => {
    const actualUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => actualUris.add(c.uri.toString()));
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    /* Unwatch root */
    await watcherServer.unwatchFileChanges(root.path.toString());

    fse.mkdirSync(FileUri.fsPath(root.resolve('foo')), { recursive: true });
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fse.mkdirSync(FileUri.fsPath(root.resolve('foo').resolve('bar')), { recursive: true });
    expect(fse.statSync(FileUri.fsPath(root.resolve('foo').resolve('bar'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fse.writeFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'baz');
    expect(fse.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual(
      'baz',
    );
    await sleep(sleepTime);
    expect(actualUris.size).toEqual(0);

    watcherServerList.push(watcherServer);
  });

  it('Merge common events on one watcher', async () => {
    const { root, watcherServer } = await generateWatcher();
    const folderName = `folder_${seed}`;
    const newFolder = FileUri.fsPath(root.resolve(folderName));
    fse.mkdirSync(newFolder, { recursive: true });
    await watcherServer.watchFileChanges(newFolder);
    watcherServerList.push(watcherServer);
  });

  it('Can receive events while watch file is not existed', async () => {
    const { root, watcherServer } = await generateWatcher();

    const folderName = `folder_${seed}`;
    const newFolder = FileUri.fsPath(root.resolve(folderName));
    fse.mkdirSync(newFolder, { recursive: true });
    const parentId = await watcherServer.watchFileChanges(newFolder);
    const childFile = FileUri.fsPath(root.resolve(folderName).resolve('index.js'));
    const childId = await watcherServer.watchFileChanges(childFile);
    expect(parentId === childId).toBeTruthy();
    watcherServerList.push(watcherServer);
  });

  it('Excludes options should be worked', async () => {
    const watcherClient = {
      onDidFilesChanged: jest.fn(),
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const folderName = `folder_${seed}`;
    const newFolder = FileUri.fsPath(root.resolve(folderName));
    const fileA = FileUri.fsPath(root.resolve(folderName).resolve('a'));
    const fileB = FileUri.fsPath(root.resolve(folderName).resolve('b'));

    fse.mkdirSync(newFolder, { recursive: true });
    await sleep(sleepTime);
    watcherClient.onDidFilesChanged.mockClear();

    let id = await watcherServer.watchFileChanges(newFolder, { excludes: [] });
    await fse.ensureFile(fileA);
    await sleep(sleepTime);
    expect(watcherClient.onDidFilesChanged).toHaveBeenCalledTimes(1);
    await watcherServer.unwatchFileChanges(newFolder.toString());

    id = await watcherServer.watchFileChanges(newFolder, { excludes: ['**/b/**'] });
    await fse.ensureFile(fileB);
    await sleep(sleepTime);
    expect(watcherClient.onDidFilesChanged).toHaveBeenCalled();
    await watcherServer.unwatchFileChanges(newFolder.toString());
    watcherServerList.push(watcherServer);
  });
});

(isMacintosh ? describe.skip : describe)('Watch file rename/move/new', () => {
  const track = temp.track();

  async function generateWatcher() {
    const injector = createNodeInjector([]);
    const root = FileUri.create(fse.realpathSync(await temp.mkdir('nfsw-test')));
    const watcherServer = new RecursiveFileSystemWatcher([], injector.get(ILogServiceManager).getLogger());
    watcherServer['isEnableNSFW'] = () => false;

    fse.mkdirpSync(FileUri.fsPath(root.resolve('for_rename_folder')));
    fse.writeFileSync(FileUri.fsPath(root.resolve('for_rename')), 'rename');

    await watcherServer.watchFileChanges(root.path.toString());

    return { root, watcherServer };
  }
  const watcherServerList: RecursiveFileSystemWatcher[] = [];

  afterAll(async () => {
    track.cleanupSync();
    watcherServerList.forEach((watcherServer) => {
      watcherServer.dispose();
    });
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
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedAddUris = [root.resolve('for_rename_renamed').toString()];

    const expectedDeleteUris = [root.resolve('for_rename').toString()];

    fse.renameSync(FileUri.fsPath(root.resolve('for_rename')), FileUri.fsPath(root.resolve('for_rename_renamed')));
    await sleep(sleepTime);

    expect([...addUris].some((val) => expectedAddUris.includes(val))).toBeTruthy();
    expect([...deleteUris]).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
    watcherServer.unwatchFileChanges(root.path.toString());
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

    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedAddUris = [
      root.toString(),
      root.resolve('for_rename_folder').toString(),
      root.resolve('for_rename_folder').resolve('for_rename').toString(),
    ];
    const expectedDeleteUris = [root.resolve('for_rename').toString()];

    await fse.move(
      FileUri.fsPath(root.resolve('for_rename')),
      FileUri.fsPath(root.resolve('for_rename_folder').resolve('for_rename')),
      {
        overwrite: true,
      },
    );

    await sleep(sleepTime);

    expect(expectedAddUris.some((val) => Array.from(addUris).includes(val))).toBeTruthy();
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
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
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedAddUris = [
      root.toString(),
      root.resolve('for_rename_1').toString(),
      root.resolve('for_rename_folder').toString(),
    ];

    const expectedDeleteUris = [root.resolve('for_rename').toString()];
    await fse.move(FileUri.fsPath(root.resolve('for_rename')), FileUri.fsPath(root.resolve('for_rename_1')), {
      overwrite: true,
    });

    await sleep(sleepTime);

    expect(Array.from(addUris).some((val) => expectedAddUris.includes(val))).toBeTruthy();
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
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
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedAddUris = [root.resolve('README.md').toString()];

    const expectedDeleteUris = [];

    await fse.ensureFile(root.resolve('README.md').codeUri.fsPath.toString());
    await sleep(sleepTime);

    expect(Array.from(addUris).some((val) => expectedAddUris.includes(val)));
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });
});
