import * as temp from 'temp';
import * as fs from 'fs-extra';
import { URI } from '@ali/ide-core-common';
import { FileUri } from '@ali/ide-core-node';
import { NsfwFileSystemWatcherServer } from '../../src/node/file-service-watcher';
import { DidFilesChangedParams, FileChangeType } from '../../src/common/file-service-watcher-protocol';
// tslint:disable:no-unused-expression

const track = temp.track();
const sleepTime = 1500;

describe('nsfw-filesystem-watcher', () => {

  let root: URI;
  let watcherServer: NsfwFileSystemWatcherServer;
  let watcherId: number;
  jest.setTimeout(10000);

  beforeEach(async () => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));
    fs.writeFileSync(FileUri.fsPath(root.resolve('for_rename')), 'rename');
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
    expect(fs.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual('baz');
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
    expect(fs.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual('baz');
    await sleep(sleepTime);

    expect(actualUris.size).toEqual(0);
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

    const expectedAddUris = [
      root.resolve('for_rename_renamed').toString(),
    ];

    const expectedDeleteUris = [
      root.resolve('for_rename').toString(),
    ];

    fs.renameSync(FileUri.fsPath(root.resolve('for_rename')), FileUri.fsPath(root.resolve('for_rename_renamed')));
    await sleep(sleepTime);

    expect(expectedAddUris).toEqual([...addUris]);
    expect(expectedDeleteUris).toEqual([...deleteUris]);
  });

  function createNsfwFileSystemWatcherServer() {
    return new NsfwFileSystemWatcherServer({
      verbose: false,
    });
  }

  function sleep(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

});

// tslint:disable-next-line:no-any
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled promise rejection: ' + reason);
});
