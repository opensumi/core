import { execSync } from 'child_process';

import * as fs from 'fs-extra';
import mv from 'mv';
import temp from 'temp';


import { URI } from '@opensumi/ide-core-common';
import { FileUri } from '@opensumi/ide-core-node';

import { DidFilesChangedParams, FileChangeType } from '../../src/common';
import { NsfwFileSystemWatcherServer } from '../../src/node/file-service-watcher';
// tslint:disable:no-unused-expression

function createNsfwFileSystemWatcherServer() {
  return new NsfwFileSystemWatcherServer({
    verbose: false,
  });
}

function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

describe('nsfw-filesystem-watcher', () => {
  const track = temp.track();
  const sleepTime = 1500;
  let root: URI;
  let watcherServer: NsfwFileSystemWatcherServer;
  let watcherId: number;
  jest.setTimeout(10000);

  beforeEach(async () => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));
    watcherServer = createNsfwFileSystemWatcherServer();
    watcherId = await watcherServer.watchFileChanges(root.toString());
    await sleep(sleepTime);
  });

  afterEach(async () => {
    track.cleanupSync();
    watcherServer.dispose();
  });

  it('Should receive file changes events from in the workspace by default.', async () => {
    // if (process.platform === 'win32') {
    //   // this.skip();
    //   return;
    // }
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

    fs.mkdirSync(FileUri.fsPath(root.resolve('foo')));
    expect(fs.statSync(FileUri.fsPath(root.resolve('foo'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fs.mkdirSync(FileUri.fsPath(root.resolve('foo').resolve('bar')));
    expect(fs.statSync(FileUri.fsPath(root.resolve('foo').resolve('bar'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fs.writeFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'baz');
    expect(fs.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual(
      'baz',
    );
    await sleep(sleepTime);
    expect(expectedUris).toEqual([...actualUris]);
  });

  it('Should not receive file changes events from in the workspace by default if unwatched', async () => {
    // if (process.platform === 'win32') {
    //   // this.skip();
    //   return;
    // }
    const actualUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach((c) => actualUris.add(c.uri.toString()));
      },
    };
    watcherServer.setClient(watcherClient);

    /* Unwatch root */
    watcherServer.unwatchFileChanges(watcherId);

    fs.mkdirSync(FileUri.fsPath(root.resolve('foo')));
    expect(fs.statSync(FileUri.fsPath(root.resolve('foo'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fs.mkdirSync(FileUri.fsPath(root.resolve('foo').resolve('bar')));
    expect(fs.statSync(FileUri.fsPath(root.resolve('foo').resolve('bar'))).isDirectory()).toBe(true);
    await sleep(sleepTime);

    fs.writeFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'baz');
    expect(fs.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual(
      'baz',
    );
    await sleep(sleepTime);

    expect(actualUris.size).toEqual(0);
  });
});

describe('测试重命名、移动、新建相关', () => {
  const track = temp.track();
  const sleepTime = 1500;
  let root: URI;
  let watcherServer: NsfwFileSystemWatcherServer;
  jest.setTimeout(10000);

  beforeEach(async () => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));
    fs.mkdirpSync(FileUri.fsPath(root.resolve('for_rename_folder')));
    fs.writeFileSync(FileUri.fsPath(root.resolve('for_rename')), 'rename');
    watcherServer = createNsfwFileSystemWatcherServer();
    await watcherServer.watchFileChanges(root.toString());
    await sleep(sleepTime);
  });

  afterEach(async () => {
    track.cleanupSync();
    watcherServer.dispose();
  });

  it('重命名文件，需要收到原文件DELETED 和 新文件的ADDED', async () => {
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

    fs.renameSync(FileUri.fsPath(root.resolve('for_rename')), FileUri.fsPath(root.resolve('for_rename_renamed')));
    await sleep(sleepTime);

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
  });

  it('移动文件，需要收到原文件DELETED 和 新文件的ADDED', async () => {
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

    await new Promise<void>((resolve) => {
      mv(
        FileUri.fsPath(root.resolve('for_rename')),
        FileUri.fsPath(root.resolve('for_rename_folder').resolve('for_rename')),
        { mkdirp: true, clobber: true },
        () => {
          resolve();
        },
      );
    });
    await sleep(sleepTime);

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
  });

  it('同目录移动文件，需要收到原文件DELETED 和 新文件的ADDED', async () => {
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

    await new Promise<void>((resolve) => {
      mv(
        FileUri.fsPath(root.resolve('for_rename')),
        FileUri.fsPath(root.resolve('for_rename_1')),
        { mkdirp: true, clobber: true },
        () => {
          resolve();
        },
      );
    });
    await sleep(sleepTime);

    expect([...addUris]).toEqual(expectedAddUris);
    expect([...deleteUris]).toEqual(expectedDeleteUris);
  });

  // 移除了 efsw 后，新建 `中文文件` 后接收不懂 ADDED
  it.skip('新建中文文件，需要收到新文件的ADDED', async () => {
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

// tslint:disable-next-line:no-any
process.on('unhandledRejection', (reason: any) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection: ' + reason);
});
