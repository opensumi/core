import { Injector } from '@ali/common-di';
import { FileSystemNodeOptions, FileServiceModule } from '../../src/node';
import { IFileService } from '../../src/common';
import { URI, FileUri } from '@ali/ide-core-node';
// import { isWindows } from '../../../core-common';
// import * as os from 'os';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
// import { servicePath as FileTreeServicePath } from '@ali/ide-file-tree'
// import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { SUPPORTED_ENCODINGS } from '../../src/node/encoding';

const track = temp.track();

describe('FileService', () => {
  let root: URI;
  let fileService: IFileService;
  let injector: Injector;

  beforeEach(() => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));

    injector = createNodeInjector([FileServiceModule]);

    // injector = new Injector([{
    //   token: 'FileServiceOptions',
    //   useValue: FileSystemNodeOptions.DEFAULT,
    // }]);
    fileService = injector.get(IFileService);
  });

  afterEach(async () => {
    track.cleanupSync();
  });

  describe('01 #getFileStat', () => {
    it('Should return undefined if not file exists under the given URI.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(false);

      const fileStat = await fileService.getFileStat(uri.toString());
      expect(fileStat).toBe(undefined);
    });

    it('Should return a proper result for a file.', async () => {
      const uri = root.resolve('foo.txt');
      fs.writeFileSync(FileUri.fsPath(uri), 'foo');
      expect(fs.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);

      const stat = await fileService.getFileStat(uri.toString());
      expect(stat).not.toBe(undefined);
      expect(stat!.isDirectory).toBe(false);
      expect(stat!.uri).toEqual(uri.toString());
    });

    it('Should return a proper result for a directory.', async () => {
      const uri1 = root.resolve('foo.txt');
      const uri2 = root.resolve('bar.txt');
      fs.writeFileSync(FileUri.fsPath(uri1), 'foo');
      fs.writeFileSync(FileUri.fsPath(uri2), 'bar');
      expect(fs.statSync(FileUri.fsPath(uri1)).isFile()).toBe(true);
      expect(fs.statSync(FileUri.fsPath(uri2)).isFile()).toBe(true);
      const stat = await fileService.getFileStat(root.toString());
      expect(stat).not.toBe(undefined);
      expect(stat!.children!.length).toEqual(2);
    });
  });

  describe('02 #resolveContent', () => {

    it('Should be rejected with an error when trying to resolve the content of a non-existing file.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(false);
      await expectThrowsAsync(fileService.resolveContent(uri.toString()));
    });

    it('Should be rejected with an error when trying to resolve the content of a directory.', async () => {
      const uri = root.resolve('foo');
      fs.mkdirSync(FileUri.fsPath(uri));
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fs.statSync(FileUri.fsPath(uri)).isDirectory()).toBe(true);

      await expectThrowsAsync(fileService.resolveContent(uri.toString()), Error);
    });

    it('Should be rejected with an error if the desired encoding cannot be handled.', async () => {
      const uri = root.resolve('foo.txt');
      fs.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fs.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);
      expect(fs.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('foo');

      // tslint:disable-next-line
      await expectThrowsAsync(fileService.resolveContent(uri.toString(), { encoding: 'unknownEncoding' }), /unknownEncoding/);
    });

    it('Should be return with the content for an existing file.', async () => {
      const uri = root.resolve('foo.txt');
      fs.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fs.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fs.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);
      expect(fs.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' }))
        .toEqual('foo');

      const content = await fileService.resolveContent(uri.toString());
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
      const content = await fileService.resolveContent(uri.toString());
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

  describe('#14 roots', () => {

    it('should not throw error', async () => {
      expect(await fileService.getRoots()).toBeDefined();
    });

  });

  describe('#15 getCurrentUserHome', () => {

    it('should not throw error', async () => {
      expect(await fileService.getCurrentUserHome()).toBeDefined();
    });

  });

  describe('encoding', () => {
    it('Should get utf8 info', async () => {
        const uri = root.resolve('utf8.txt');
        fs.writeFileSync(FileUri.fsPath(uri), 'data', { encoding: 'utf8'});
        expect(await fileService.getEncoding(FileUri.fsPath(uri))).toEqual({
          value: 'utf8',
          labelLong: SUPPORTED_ENCODINGS.utf8.labelLong,
          labelShort: SUPPORTED_ENCODINGS.utf8.labelShort,
        });
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
