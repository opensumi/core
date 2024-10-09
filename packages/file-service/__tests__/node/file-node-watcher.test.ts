import * as fse from 'fs-extra';
import temp from 'temp';

import { Disposable, FileUri, URI, sleep } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { DidFilesChangedParams, FileChangeType } from '../../src/common/index';
import { FileChangeCollectionManager, FileChangeCollectionManagerOptions } from '../../src/node/file-change-collection';
import { UnRecursiveFileSystemWatcher } from '../../src/node/un-recursive/file-service-watcher';

const sleepTime = 1000;

async function generateWatcher(track: typeof temp, watchPathCb: (root: URI) => string) {
  const injector = createNodeInjector([]);
  const root = FileUri.create(await fse.realpath(await track.mkdir('unRecursive-test')));
  injector.addProviders({
    token: FileChangeCollectionManagerOptions,
    useValue: { debounceTimeout: 0 },
  });
  const fileChangeCollectionManager = injector.get(FileChangeCollectionManager);
  const watcherServer = injector.get(UnRecursiveFileSystemWatcher);
  fse.mkdirpSync(FileUri.fsPath(root.resolve('for_rename_folder')));
  fse.writeFileSync(FileUri.fsPath(root.resolve('for_rename')), 'rename');
  const watcherId = await watcherServer.watchFileChanges(watchPathCb(root));

  const setClient = (client: { onDidFilesChanged: (event: DidFilesChangedParams) => void }) =>
    watcherServer.addDispose(fileChangeCollectionManager.setClientForTest(watcherId, client));
  watcherServer.addDispose(
    Disposable.create(() => {
      // eslint-disable-next-line no-console
      console.log('dispose watcher id', watcherId);
      watcherServer.unwatchFileChanges(watcherId);
    }),
  );
  return { root, watcherServer, setClient };
}

describe('unRecursively watch for folder additions, deletions, rename,and updates', () => {
  const track = temp.track();
  const rootPathCb = (root: URI) => root.toString();

  afterAll(() => {
    track.cleanupSync();
  });
  it('Rename the files under the folder', async () => {
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
    const { root, watcherServer, setClient } = await generateWatcher(track, rootPathCb);
    setClient(watcherClient);

    const expectedAddUris = [root.resolve('for_rename_renamed').toString()];

    const expectedDeleteUris = [root.resolve('for_rename').toString()];

    fse.renameSync(FileUri.fsPath(root.resolve('for_rename')), FileUri.fsPath(root.resolve('for_rename_renamed')));
    await sleep(sleepTime);
    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Add the files under the folder', async () => {
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
    const { root, watcherServer, setClient } = await generateWatcher(track, rootPathCb);
    setClient(watcherClient);

    const expectedAddUris = [root.resolve('README.md').toString()];

    const expectedDeleteUris = [];

    await fse.ensureFile(root.resolve('README.md').codeUri.fsPath.toString());
    await sleep(sleepTime);

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Update the files under the folder', async () => {
    const updatedUris = new Set<string>();
    const deleteUris = new Set<string>();
    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => {
          if (c.type === FileChangeType.UPDATED) {
            updatedUris.add(c.uri);
          }
          if (c.type === FileChangeType.DELETED) {
            deleteUris.add(c.uri);
          }
        });
      },
    };
    const { root, watcherServer, setClient } = await generateWatcher(track, rootPathCb);
    setClient(watcherClient);
    const expectedDeleteUris = [];
    const expectedUpdatedUris = [root.resolve('for_rename').toString()];
    fse.writeFileSync(root.resolve('for_rename').codeUri.fsPath.toString(), '');
    await sleep(sleepTime);
    expect(Array.from(updatedUris)).toEqual(expectedUpdatedUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Delete the files under the folder', async () => {
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
    const { root, watcherServer, setClient } = await generateWatcher(track, rootPathCb);
    setClient(watcherClient);

    const expectedDeleteUris = [root.resolve('for_rename').toString()];
    const expectedAddUris = [];
    await fse.unlink(root.resolve('for_rename').codeUri.fsPath.toString());
    await sleep(sleepTime);

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Rename the watched folder', async () => {
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
    const { root, watcherServer, setClient } = await generateWatcher(track, rootPathCb);
    setClient(watcherClient);

    const expectedAddUris = [];
    const expectedDeleteUris = [];

    fse.renameSync(
      FileUri.fsPath(root.resolve('for_rename_folder')),
      FileUri.fsPath(root.resolve('for_rename_folder_ed')),
    );
    await sleep(sleepTime);

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Add the watched folder', async () => {
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
    const { root, watcherServer, setClient } = await generateWatcher(track, rootPathCb);
    setClient(watcherClient);

    const expectedAddUris = [];

    const expectedDeleteUris = [];

    await fse.ensureDir(root.resolve('README').codeUri.fsPath.toString());
    await sleep(sleepTime);

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });

  it('Delete the watched folder', async () => {
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
    const { root, watcherServer, setClient } = await generateWatcher(track, rootPathCb);
    setClient(watcherClient);

    const expectedDeleteUris = [];
    const expectedAddUris = [];
    await fse.remove(root.resolve('for_rename_folder').codeUri.fsPath.toString());
    await sleep(sleepTime);

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
});

describe('Delete and update monitored files', () => {
  const track = temp.track();
  const rootPathCb = (root: URI) => root.toString() + '/for_rename';

  afterAll(() => {
    track.cleanupSync();
  });

  it('Delete watched files', async () => {
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
    const { root, watcherServer, setClient } = await generateWatcher(track, rootPathCb);
    setClient(watcherClient);

    const expectedDeleteUris = [root.resolve('for_rename').toString()];

    const expectedAddUris = [];
    await fse.unlink(root.resolve('for_rename').codeUri.fsPath.toString());
    await sleep(sleepTime);
    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });

  it('Update watched files', async () => {
    const updatedUris = new Set<string>();
    const deleteUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => {
          if (c.type === FileChangeType.UPDATED) {
            updatedUris.add(c.uri);
          }
          if (c.type === FileChangeType.DELETED) {
            deleteUris.add(c.uri);
          }
        });
      },
    };
    const { root, watcherServer, setClient } = await generateWatcher(track, rootPathCb);
    setClient(watcherClient);
    const expectedDeleteUris = [];
    const expectedUpdatedUris = [root.resolve('for_rename').toString()];
    await fse.writeFile(root.resolve('for_rename').codeUri.fsPath.toString(), 'for');
    await sleep(sleepTime);
    expect(Array.from(updatedUris)).toEqual(expectedUpdatedUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
});
