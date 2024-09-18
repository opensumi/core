import * as fse from 'fs-extra';
import temp from 'temp';

import { Deferred, FileUri, sleep } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { DidFilesChangedParams, FileChangeType } from '../../src/common/index';
import { UnRecursiveFileSystemWatcher } from '../../src/node/un-recursive/file-service-watcher';

const sleepTime = 1000;

// jest.retryTimes(3, { logErrorsBeforeRetry: true });

describe('unRecursively watch for folder additions, deletions, rename,and updates', () => {
  const track = temp.track();
  async function generateWatcher() {
    const injector = createNodeInjector([]);
    const root = FileUri.create(fse.realpathSync(await temp.mkdir('unRecursive-test')));
    const watcherServer = injector.get(UnRecursiveFileSystemWatcher);
    fse.mkdirpSync(FileUri.fsPath(root.resolve('for_rename_folder')));
    fse.writeFileSync(FileUri.fsPath(root.resolve('for_rename')), 'rename');
    await watcherServer.watchFileChanges(root.toString());
    return { root, watcherServer };
  }
  afterAll(() => {
    track.cleanupSync();
  });

  it('Rename the files under the folder', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();
    const triggered = new Deferred<void>();
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
        if (addUris.size === 1 && deleteUris.size === 1) {
          triggered.resolve();
        }
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedAddUris = [root.resolve('for_rename_renamed').toString()];

    const expectedDeleteUris = [root.resolve('for_rename').toString()];

    fse.renameSync(FileUri.fsPath(root.resolve('for_rename')), FileUri.fsPath(root.resolve('for_rename_renamed')));
    await sleep(sleepTime);
    await triggered.promise;
    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Add the files under the folder', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();
    const triggered = new Deferred<void>();

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
        if (addUris.size === 1) {
          triggered.resolve();
        }
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedAddUris = [root.resolve('README.md').toString()];

    const expectedDeleteUris = [];

    await fse.ensureFile(root.resolve('README.md').codeUri.fsPath.toString());
    await sleep(sleepTime);
    await triggered.promise;

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Update the files under the folder', async () => {
    const updatedUris = new Set<string>();
    const deleteUris = new Set<string>();
    const triggered = new Deferred<void>();

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
        if (updatedUris.size === 1) {
          triggered.resolve();
        }
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);
    const expectedDeleteUris = [];
    const expectedUpdatedUris = [root.resolve('for_rename').toString()];
    fse.writeFileSync(root.resolve('for_rename').codeUri.fsPath.toString(), '');
    await sleep(sleepTime);
    await triggered.promise;

    expect(Array.from(updatedUris)).toEqual(expectedUpdatedUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Delete the files under the folder', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();
    const triggered = new Deferred<void>();

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

        if (deleteUris.size === 1) {
          triggered.resolve();
        }
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);
    const expectedDeleteUris = [root.resolve('for_rename').toString()];
    const expectedAddUris = [];
    await fse.unlink(root.resolve('for_rename').codeUri.fsPath.toString());
    await sleep(sleepTime);
    await triggered.promise;

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Rename the watched folder', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();
    const triggered = new Deferred<void>();

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
        triggered.resolve();
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedAddUris = [];
    const expectedDeleteUris = [];

    fse.renameSync(
      FileUri.fsPath(root.resolve('for_rename_folder')),
      FileUri.fsPath(root.resolve('for_rename_folder_ed')),
    );
    await sleep(sleepTime);
    await triggered.promise;

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
  it('Add the watched folder', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();
    const triggered = new Deferred<void>();

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
        triggered.resolve();
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedAddUris = [];

    const expectedDeleteUris = [];

    await fse.ensureDir(root.resolve('README').codeUri.fsPath.toString());
    await sleep(sleepTime);
    await triggered.promise;

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });

  it('Delete the watched folder', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();
    const triggered = new Deferred<void>();

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
        triggered.resolve();
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);
    const expectedDeleteUris = [];
    const expectedAddUris = [];
    await fse.remove(root.resolve('for_rename_folder').codeUri.fsPath.toString());
    await sleep(sleepTime);
    await triggered.promise;

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
});

describe('Delete and update monitored files', () => {
  const track = temp.track();
  async function generateWatcher() {
    const injector = createNodeInjector([]);
    const root = FileUri.create(fse.realpathSync(await temp.mkdir('unRecursive-test')));
    const watcherServer = injector.get(UnRecursiveFileSystemWatcher);
    fse.writeFileSync(FileUri.fsPath(root.resolve('for_rename')), 'rename');
    await watcherServer.watchFileChanges(root.toString() + '/for_rename');
    return { root, watcherServer };
  }
  const watcherServerList: UnRecursiveFileSystemWatcher[] = [];
  afterAll(async () => {
    track.cleanupSync();
    watcherServerList.forEach((watcherServer) => {
      watcherServer.dispose();
    });
  });

  it('Delete watched files', async () => {
    const addUris = new Set<string>();
    const deleteUris = new Set<string>();
    const triggered = new Deferred<void>();

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

        if (deleteUris.size === 1) {
          triggered.resolve();
        }
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);

    const expectedDeleteUris = [root.resolve('for_rename').toString()];

    const expectedAddUris = [];
    await fse.unlink(root.resolve('for_rename').codeUri.fsPath.toString());
    await sleep(sleepTime);
    await triggered.promise;

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });

  it('Update watched files', async () => {
    const updatedUris = new Set<string>();
    const deleteUris = new Set<string>();
    const triggered = new Deferred<void>();

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

        if (updatedUris.size === 1) {
          triggered.resolve();
        }
      },
    };
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);
    const expectedDeleteUris = [];
    const expectedUpdatedUris = [root.resolve('for_rename').toString()];
    await fse.writeFile(root.resolve('for_rename').codeUri.fsPath.toString(), 'for');
    await sleep(sleepTime);
    await triggered.promise;

    expect(Array.from(updatedUris)).toEqual(expectedUpdatedUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServer.dispose();
  });
});
