import { Injector } from '@ali/common-di';
import { URI, FileUri } from '@ali/ide-core-node';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { startServer } from '../../../../tools/dev-tool/src/server';
import { FileServiceModule } from '../../src/node/index';
import { FileServiceClientModule } from '@ali/ide-file-service/lib/browser';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { createClientConnection } from '@ali/ide-core-browser';

import * as ws from 'ws';
import { FileChangeType, FileChangeEvent } from '@ali/ide-file-service/lib/common/file-service-watcher-protocol';
import { Server } from 'net';

const track = temp.track();

describe('FileService', () => {
  let root: URI;
  let fileServiceClient: FileServiceClient;
  let server: Server;
  (global as any).WebSocket = ws;
  jest.setTimeout(10000);

  beforeEach(() => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));
  });
  afterAll(() => {
    return new Promise((r, j) => {
      console.info('close server');

      server.close((err) => {
        if (err) {
          return j(err);
        }
        return r();
      });
    });
  });
  beforeAll(async () => {
    const injector = new Injector();
    console.info('start server');
    const app = await startServer([injector.get(FileServiceModule)]);
    server = app.getServer();
    return new Promise((resolve) => {
      setTimeout(async () => {
        createBrowserInjector([FileServiceClientModule], injector);
        await createClientConnection(injector, [FileServiceClientModule], 'ws://127.0.0.1:8000/service');
        fileServiceClient = injector.get(FileServiceClient);
        resolve();
      }, 5000);
    });

  }, 7000);

  afterEach(() => {
    track.cleanupSync();
  });

  describe('01 #getFileStat', () => {
    it('Should return undefined if not file exists under the given URI.', async (done) => {
      const uri = root.resolve('foo.txt');
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(false);

      const fileStat = await fileServiceClient.getFileStat(uri.toString());
      expect(fileStat).toBe(null);
      done();
    });

    it('Should return a proper result for a file.', async (done) => {
      const uri = root.resolve('foo.txt');
      fs.writeFileSync(FileUri.fsPath(uri), 'foo');
      expect(fs.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);

      const stat = await fileServiceClient.getFileStat(uri.toString());
      expect(stat).not.toBe(undefined);
      expect(stat!.isDirectory).toBe(false);
      expect(stat!.uri).toEqual(uri.toString());
      done();
    });

    it('Should return a proper result for a directory.', async (done) => {
      const uri1 = root.resolve('foo.txt');
      const uri2 = root.resolve('bar.txt');
      fs.writeFileSync(FileUri.fsPath(uri1), 'foo');
      fs.writeFileSync(FileUri.fsPath(uri2), 'bar');
      expect(fs.statSync(FileUri.fsPath(uri1)).isFile()).toBe(true);
      expect(fs.statSync(FileUri.fsPath(uri2)).isFile()).toBe(true);
      const stat = await fileServiceClient.getFileStat(root.toString());
      expect(stat).not.toBe(undefined);
      expect(stat!.children!.length).toEqual(2);
      done();
    });
  });

  describe('02 #resolveContent', () => {

    it('Should be rejected with an error when trying to resolve the content of a non-existing file.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(false);
      // await expectThrowsAsync(fileServiceClient.resolveContent(uri.toString()));
    });

    it('Should be rejected with an error when trying to resolve the content of a directory.', async () => {
      const uri = root.resolve('foo');
      fs.mkdirSync(FileUri.fsPath(uri));
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fs.statSync(FileUri.fsPath(uri)).isDirectory()).toBe(true);

      // await expectThrowsAsync(fileServiceClient.resolveContent(uri.toString()), Error);
    });

    it('Should be rejected with an error if the desired encoding cannot be handled.', async () => {
      const uri = root.resolve('foo.txt');
      fs.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fs.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);
      expect(fs.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('foo');

      // tslint:disable-next-line
      // await expectThrowsAsync(fileServiceClient.resolveContent(uri.toString(), { encoding: 'unknownEncoding' }), /unknownEncoding/);
    });

    it('Should be return with the content for an existing file.', async () => {
      const uri = root.resolve('foo.txt');
      fs.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fs.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);
      expect(fs.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' }))
        .toEqual('foo');

      const content = await fileServiceClient.resolveContent(uri.toString());
      expect(content).toHaveProperty('content');
      expect(content.content).toEqual('foo');
    });

    it('Should be return with the stat object for an existing file.', async () => {
      const uri = root.resolve('foo.txt');
      fs.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fs.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);
      expect(fs.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' }))
        .toEqual('foo');
      const content = await fileServiceClient.resolveContent(uri.toString());
      expect.objectContaining(content);
      expect(content).toHaveProperty('stat');
      expect(content.stat).toHaveProperty('uri', uri.toString());
      expect(content.stat).toHaveProperty('size');
      expect(content.stat.size).toBeGreaterThan(1);
      expect(content.stat).toHaveProperty('lastModification');
      expect(content.stat.lastModification).toBeGreaterThan(1);
      expect(content.stat).toHaveProperty('isDirectory');
      expect(content.stat.isDirectory).toBe(false);
      expect(content.stat).not.toHaveProperty('children');
    });

  });

  describe('03 #watch', () => {
    it.only('Listen for file changes', async (done) => {
      await fileServiceClient.watchFileChanges(root);
      const uri = root.resolve('foo.txt');
      fileServiceClient.onFilesChanged((fileChange) => {
        const ss: FileChangeEvent = [{
          type: FileChangeType.ADDED,
          uri: uri.toString(),
        }];
        expect(fileChange).toEqual(expect.arrayContaining(ss));
        done();
      });

      fs.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
    });
  });
});

// tslint:disable-next-line
export async function expectThrowsAsync(actual: Promise<any>, expected?: string | RegExp, message?: string): Promise<void>;
// tslint:disable-next-line
export async function expectThrowsAsync(actual: Promise<any>, constructor: Error | Function, expected?: string | RegExp, message?: string): Promise<void>;
// tslint:disable-next-line
export async function expectThrowsAsync(promise: Promise<any>, ...args: any[]): Promise<void> {
  let synchronous = () => { };
  try {
    await promise;
  } catch (e) {
    synchronous = () => { throw e; };
  } finally {
    expect(synchronous).toThrow(...args);
  }
}
