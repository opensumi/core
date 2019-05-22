
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { URI } from '@ali/ide-core-common';
import { FileUri } from '@ali/ide-core-node';
import { NsfwFileSystemWatcherServer } from '../../src/node/file-service-watcher';
import { DidFilesChangedParams } from '../../src/common/file-service-watcher-protocol';
// tslint:disable:no-unused-expression

const track = temp.track();

describe('nsfw-filesystem-watcher', function () {

  let root: URI;
  let watcherServer: NsfwFileSystemWatcherServer;
  let watcherId: number;
  jest.setTimeout(10000);

  beforeEach(async () => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));
    watcherServer = createNsfwFileSystemWatcherServer();
    watcherId = await watcherServer.watchFileChanges(root.toString());
    await sleep(2000);
  });

  afterEach(async () => {
    track.cleanupSync();
    watcherServer.dispose();
  });

  it('Should receive file changes events from in the workspace by default.', async function () {
    if (process.platform === 'win32') {
      // this.skip();
      return;
    }
    const actualUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach(c => actualUris.add(c.uri.toString()));
      }
    };
    watcherServer.setClient(watcherClient);

    const expectedUris = [
      root.resolve('foo').toString(),
      root.withPath(root.path.join('foo', 'bar')).toString(),
      root.withPath(root.path.join('foo', 'bar', 'baz.txt')).toString()
    ];

    fs.mkdirSync(FileUri.fsPath(root.resolve('foo')));
    expect(fs.statSync(FileUri.fsPath(root.resolve('foo'))).isDirectory()).toBe(true);
    await sleep(2000);

    fs.mkdirSync(FileUri.fsPath(root.resolve('foo').resolve('bar')));
    expect(fs.statSync(FileUri.fsPath(root.resolve('foo').resolve('bar'))).isDirectory()).toBe(true);
    await sleep(2000);

    fs.writeFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'baz');
    expect(fs.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual('baz');
    await sleep(2000);
    expect(expectedUris).toEqual([...actualUris]);
  });

  it('Should not receive file changes events from in the workspace by default if unwatched', async function () {
    if (process.platform === 'win32') {
      // this.skip();
      return;
    }
    const actualUris = new Set<string>();

    const watcherClient = {
      onDidFilesChanged(event: DidFilesChangedParams) {
        event.changes.forEach(c => actualUris.add(c.uri.toString()));
      }
    };
    watcherServer.setClient(watcherClient);

    /* Unwatch root */
    watcherServer.unwatchFileChanges(watcherId);

    fs.mkdirSync(FileUri.fsPath(root.resolve('foo')));
    expect(fs.statSync(FileUri.fsPath(root.resolve('foo'))).isDirectory()).toBe(true);
    await sleep(2000);

    fs.mkdirSync(FileUri.fsPath(root.resolve('foo').resolve('bar')));
    expect(fs.statSync(FileUri.fsPath(root.resolve('foo').resolve('bar'))).isDirectory()).toBe(true);
    await sleep(2000);

    fs.writeFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'baz');
    expect(fs.readFileSync(FileUri.fsPath(root.resolve('foo').resolve('bar').resolve('baz.txt')), 'utf8')).toEqual('baz');
    await sleep(2000);

    expect(actualUris.size).toEqual(0);
  });

  function createNsfwFileSystemWatcherServer() {
    return new NsfwFileSystemWatcherServer({
      verbose: true
    });
  }

  function sleep(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

});

// tslint:disable-next-line:no-any
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled promise rejection: ' + reason);
});
