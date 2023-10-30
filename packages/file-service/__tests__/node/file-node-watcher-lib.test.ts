import * as fse from 'fs-extra';
import temp from 'temp';

import { isMacintosh, isLinux } from '@opensumi/ide-core-common';
import { FileUri } from '@opensumi/ide-core-node';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { DidFilesChangedParams, FileChangeType } from '../../src/common';
import { UnRecursiveFileSystemWatcher } from '../../src/node/un-recursive/file-node-watcher-lib';

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
const sleepTime = 1000;

(isMacintosh ? describe.skip : describe)('watch directory delete/add/update', () => {
  const track = temp.track();
  async function generateWatcher() {
    const injector = createNodeInjector([]);
    const root = FileUri.create(fse.realpathSync(await temp.mkdir('unRecursive-test')));
    // injector.mock(UnRecursiveFileSystemWatcher, 'watchFileChanges', () => false);
    const watcherServer = injector.get(UnRecursiveFileSystemWatcher);
    fse.mkdirpSync(FileUri.fsPath(root.resolve('for_rename_folder')));
    fse.writeFileSync(FileUri.fsPath(root.resolve('for_rename')), 'rename');
    await watcherServer.watchFileChanges(root.toString());
    return { root, watcherServer };
  }
  const watcherServerList: UnRecursiveFileSystemWatcher[] = [];
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
    // await new Promise((resolve) => setTimeout(resolve, sleepTime));

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });
  it('add file', async () => {
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

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });
  it('update file', async () => {
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
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);
    const expectedDeleteUris = [];
    const expectedUpdatedUris = [root.resolve('for_rename').toString()];
    fse.writeFileSync(root.resolve('for_rename').codeUri.fsPath.toString(), '');
    await sleep(sleepTime);
    expect(Array.from(updatedUris)).toEqual(expectedUpdatedUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });
  it('delete file', async () => {
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
    const expectedDeleteUris = [root.resolve('for_rename').toString()];
    const expectedAddUris = [];
    await fse.unlink(root.resolve('for_rename').codeUri.fsPath.toString());
    await sleep(sleepTime);

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });
  it('Rename folder', async () => {
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

    const expectedAddUris = [];
    const expectedDeleteUris = [];

    fse.renameSync(
      FileUri.fsPath(root.resolve('for_rename_folder')),
      FileUri.fsPath(root.resolve('for_rename_folder_ed')),
    );
    await sleep(sleepTime);

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });
  it('Add folder', async () => {
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

    const expectedAddUris = [];

    const expectedDeleteUris = [];

    await fse.ensureDir(root.resolve('README').codeUri.fsPath.toString());
    await sleep(sleepTime);

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });

  it('Delete folder', async () => {
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
    const expectedDeleteUris = [];
    const expectedAddUris = [];
    await fse.remove(root.resolve('for_rename_folder').codeUri.fsPath.toString());
    await sleep(sleepTime);

    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });
});

(isMacintosh ? describe.skip : describe)('watch document delete/update/deleteAndAdd', () => {
  const track = temp.track();
  async function generateWatcher() {
    const injector = createNodeInjector([]);
    const root = FileUri.create(fse.realpathSync(await temp.mkdir('unRecursive-test')));
    // injector.mock(UnRecursiveFileSystemWatcher, 'watchFileChanges', () => false);
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

  it('deleted file', async () => {
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

    const expectedDeleteUris = [root.resolve('for_rename').toString()];

    const expectedAddUris = [];
    await fse.unlink(root.resolve('for_rename').codeUri.fsPath.toString());
    await sleep(sleepTime);
    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });

  it('Deleted and Add file', async () => {
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
    let expectedAddUris: string[];
    if (isLinux || isMacintosh) {
      expectedAddUris = [];
    } else {
      expectedAddUris = [root.resolve('for_rename').toString()];
    }
    const expectedDeleteUris = [root.resolve('for_rename').toString()];
    await fse.unlink(root.resolve('for_rename').codeUri.fsPath.toString());
    await sleep(sleepTime);
    await fse.writeFile(root.resolve('for_rename').codeUri.fsPath.toString(), 'for');
    await sleep(sleepTime);
    expect(Array.from(addUris)).toEqual(expectedAddUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });
  it('updated file', async () => {
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
    const { root, watcherServer } = await generateWatcher();
    watcherServer.setClient(watcherClient);
    const expectedDeleteUris = [];
    const expectedUpdatedUris = [root.resolve('for_rename').toString()];
    await fse.writeFile(root.resolve('for_rename').codeUri.fsPath.toString(), 'for');
    await sleep(sleepTime);
    expect(Array.from(updatedUris)).toEqual(expectedUpdatedUris);
    expect(Array.from(deleteUris)).toEqual(expectedDeleteUris);
    watcherServerList.push(watcherServer);
  });
});
