import os from 'os';
import path from 'path';

import * as fse from 'fs-extra';

import { isWindows } from '@opensumi/ide-core-common';
import { URI, FileUri } from '@opensumi/ide-core-node';
import { expectThrowsAsync } from '@opensumi/ide-core-node/__tests__/helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { FileSystemWatcherServer } from '../../lib/node/recursive/file-service-watcher';
import { IFileService, FileChangeType } from '../../src/common';
import { FileServiceModule, FileService } from '../../src/node';

// tslint:disable:variable-name
describe('FileService', () => {
  let root: URI;
  let fileService: IFileService;
  let injector: MockInjector;
  let counter = 1;

  beforeEach(async () => {
    // 换一个方式实现 temp dir
    const testDir = path.join(os.tmpdir(), 'fs-test', 'describe-' + counter++);
    await fse.ensureDir(testDir);
    root = FileUri.create(testDir);

    injector = createNodeInjector([FileServiceModule]);
    // @ts-ignore
    injector.mock(FileSystemWatcherServer, 'isEnableNSFW', () => false);
    fileService = injector.get(IFileService);
  });

  afterAll(async () => {
    await fse.remove(path.join(os.tmpdir(), 'fs-test'));
  });

  describe('01 #getFileStat', () => {
    it('Should return undefined if not file exists under the given URI.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBe(false);

      const fileStat = await fileService.getFileStat(uri.toString());
      expect(fileStat).toBe(undefined);
    });

    it('Should return a proper result for a file.', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo');
      expect(fse.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);

      const stat = await fileService.getFileStat(uri.toString());
      expect(stat).not.toBe(undefined);
      expect(stat!.isDirectory).toBe(false);
      expect(stat!.uri).toEqual(uri.toString());
    });

    it('Should return a proper result for a directory.', async () => {
      const uri1 = root.resolve('foo.txt');
      const uri2 = root.resolve('bar.txt');
      fse.writeFileSync(FileUri.fsPath(uri1), 'foo');
      fse.writeFileSync(FileUri.fsPath(uri2), 'bar');
      expect(fse.statSync(FileUri.fsPath(uri1)).isFile()).toBe(true);
      expect(fse.statSync(FileUri.fsPath(uri2)).isFile()).toBe(true);
      const stat = await fileService.getFileStat(root.toString());
      expect(stat).not.toBe(undefined);
      expect(stat!.children!.length).toEqual(2);
    });
  });

  describe('02 #resolveContent', () => {
    it('Should be rejected with an error when trying to resolve the content of a non-existing file.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBe(false);
      await expectThrowsAsync(fileService.resolveContent(uri.toString()));
    });

    it('Should be rejected with an error when trying to resolve the content of a directory.', async () => {
      const uri = root.resolve('foo');
      fse.mkdirSync(FileUri.fsPath(uri));
      expect(fse.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fse.statSync(FileUri.fsPath(uri)).isDirectory()).toBe(true);

      await expectThrowsAsync(fileService.resolveContent(uri.toString()), Error);
    });

    it('Should be rejected with an error if the desired encoding cannot be handled.', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fse.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fse.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);
      expect(fse.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('foo');

      // tslint:disable-next-line
      await expectThrowsAsync(
        fileService.resolveContent(uri.toString(), { encoding: 'unknownEncoding' }),
        /unknownencoding/,
      );
    });

    it('Should be return with the content for an existing file.', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fse.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fse.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);
      expect(fse.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('foo');

      const content = await fileService.resolveContent(uri.toString());
      expect(content).toHaveProperty('content');
      expect(content.content).toEqual('foo');
    });

    it('Should be return with the stat object for an existing file.', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fse.existsSync(FileUri.fsPath(uri))).toBe(true);
      expect(fse.statSync(FileUri.fsPath(uri)).isFile()).toBe(true);
      expect(fse.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('foo');
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

  describe('03 #setContent', () => {
    it('Should be rejected with an error when trying to set the content of a non-existing file.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();

      const stat = {
        uri: uri.toString(),
        lastModification: new Date().getTime(),
        isDirectory: false,
      };

      await expectThrowsAsync(fileService.setContent(stat, 'foo'), Error);
    });

    it('Should be rejected with an error when trying to set the content of a directory.', async () => {
      const uri = root.resolve('foo');
      fse.mkdirSync(FileUri.fsPath(uri));
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(uri)).isDirectory()).toBeTruthy();

      const stat = await fileService.getFileStat(uri.toString());
      expect(stat).toBeDefined();
      await expectThrowsAsync(fileService.setContent(stat!, 'foo'), Error);
    });

    it('Should be rejected with an error when trying to set the content of a file which is out-of-sync.', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(uri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('foo');

      const stat = await fileService.getFileStat(uri.toString());
      // Make sure current file stat is out-of-sync.
      // Here the content is modified in the way that file sizes will differ.
      fse.writeFileSync(FileUri.fsPath(uri), 'longer', { encoding: 'utf8' });
      expect(fse.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('longer');
      expect(stat).toBeDefined();
      await expectThrowsAsync(fileService.setContent(stat!, 'baz'), Error);
    });

    it('Should be rejected with an error when trying to set the content when the desired encoding cannot be handled.', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(uri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('foo');

      const stat = await fileService.getFileStat(uri.toString());
      expect(stat).toBeDefined();
      await fileService.setContent(stat!, 'bar', { encoding: 'ascii' });
      expect(fse.readFileSync(FileUri.fsPath(uri), 'ascii')).toEqual('bar');
      const newStat = await fileService.getFileStat(uri.toString());
      expect(newStat).toBeDefined();
      await fileService.updateContent(newStat!, [{ text: 'foo' }], { encoding: 'ascii' });
      expect(fse.readFileSync(FileUri.fsPath(uri), 'ascii')).toEqual('foo');
      await expectThrowsAsync(fileService.setContent(stat!, 'baz', { encoding: 'unknownEncoding' }), Error);
    });

    it('Should return with a stat representing the latest state of the successfully modified file.', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo', { encoding: 'utf8' });
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(uri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('foo');

      const currentStat = await fileService.getFileStat(uri.toString());
      expect(currentStat).toBeDefined();

      await fileService.setContent(currentStat!, 'baz');
      expect(fse.readFileSync(FileUri.fsPath(uri), { encoding: 'utf8' })).toEqual('baz');
    });
  });

  describe('04 #move', () => {
    it('Should be rejected with an error if no file exists under the source location.', async () => {
      const sourceUri = root.resolve('foo.txt');
      const targetUri = root.resolve('bar.txt');
      expect(fse.existsSync(FileUri.fsPath(sourceUri))).toBeFalsy();

      await expectThrowsAsync(fileService.move(sourceUri.toString(), targetUri.toString()), Error);
    });

    it("Should be rejected with an error if target exists and overwrite is not set to 'true'.", async () => {
      const sourceUri = root.resolve('foo.txt');
      const targetUri = root.resolve('bar.txt');
      fse.writeFileSync(FileUri.fsPath(sourceUri), 'foo');
      fse.writeFileSync(FileUri.fsPath(targetUri), 'bar');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isFile()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isFile()).toBeTruthy();

      await expectThrowsAsync(fileService.move(sourceUri.toString(), targetUri.toString()), Error);
    });

    it('Moving a file to an empty directory. Should be rejected with an error because files cannot be moved to an existing directory locations.', async () => {
      const sourceUri = root.resolve('foo.txt');
      const targetUri = root.resolve('bar');
      fse.writeFileSync(FileUri.fsPath(sourceUri), 'foo');
      fse.mkdirSync(FileUri.fsPath(targetUri));
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(sourceUri), 'utf8')).toEqual('foo');
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();
      expect(fse.readdirSync(FileUri.fsPath(targetUri)).length).toEqual(0);

      await expectThrowsAsync(fileService.move(sourceUri.toString(), targetUri.toString(), { overwrite: true }), Error);
    });

    it('Moving a file to a non-empty directory. Should be rejected with and error because files cannot be moved to an existing directory locations.', async () => {
      const sourceUri = root.resolve('foo.txt');
      const targetUri = root.resolve('bar');
      const targetFileUri_01 = targetUri.resolve('bar_01.txt');
      const targetFileUri_02 = targetUri.resolve('bar_02.txt');
      fse.writeFileSync(FileUri.fsPath(sourceUri), 'foo');
      fse.mkdirSync(FileUri.fsPath(targetUri));
      fse.writeFileSync(FileUri.fsPath(targetFileUri_01), 'bar_01');
      fse.writeFileSync(FileUri.fsPath(targetFileUri_02), 'bar_02');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(sourceUri), 'utf8')).toEqual('foo');
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(targetFileUri_01), 'utf8')).toEqual('bar_01');
      expect(fse.readFileSync(FileUri.fsPath(targetFileUri_02), 'utf8')).toEqual('bar_02');
      expect(fse.readdirSync(FileUri.fsPath(targetUri))).toEqual(['bar_01.txt', 'bar_02.txt']);

      await expectThrowsAsync(fileService.move(sourceUri.toString(), targetUri.toString(), { overwrite: true }), Error);
    });

    it('Moving an empty directory to file. Should be rejected with an error because directories and cannot be moved to existing file locations.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar.txt');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      fse.writeFileSync(FileUri.fsPath(targetUri), 'bar');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(targetUri), 'utf8')).toEqual('bar');
      expect(fse.readdirSync(FileUri.fsPath(sourceUri)).length).toEqual(0);

      await expectThrowsAsync(fileService.move(sourceUri.toString(), targetUri.toString(), { overwrite: true }), Error);
    });

    it('Moving a non-empty directory to file. Should be rejected with an error because directories cannot be moved to existing file locations.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar.txt');
      const sourceFileUri_01 = sourceUri.resolve('foo_01.txt');
      const sourceFileUri_02 = sourceUri.resolve('foo_02.txt');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      fse.writeFileSync(FileUri.fsPath(targetUri), 'bar');
      fse.writeFileSync(FileUri.fsPath(sourceFileUri_01), 'foo_01');
      fse.writeFileSync(FileUri.fsPath(sourceFileUri_02), 'foo_02');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(targetUri), 'utf8')).toEqual('bar');
      expect(fse.readdirSync(FileUri.fsPath(sourceUri))).toEqual(['foo_01.txt', 'foo_02.txt']);

      await expectThrowsAsync(fileService.move(sourceUri.toString(), targetUri.toString(), { overwrite: true }), Error);
    });

    it('Moving file to file. Should overwrite the target file content and delete the source file.', async () => {
      const sourceUri = root.resolve('foo.txt');
      const targetUri = root.resolve('bar.txt');
      fse.writeFileSync(FileUri.fsPath(sourceUri), 'foo');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isFile()).toBeTruthy();
      expect(fse.existsSync(FileUri.fsPath(targetUri))).toBeFalsy();

      const stat = await fileService.move(sourceUri.toString(), targetUri.toString(), { overwrite: true });
      expect(stat.uri).toEqual(targetUri.toString());
      expect(fse.existsSync(FileUri.fsPath(sourceUri))).toBeFalsy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(targetUri), 'utf8')).toEqual('foo');
    });

    it('Moving an empty directory to an empty directory. Should remove the source directory.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      fse.mkdirSync(FileUri.fsPath(targetUri));
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();
      expect(fse.readdirSync(FileUri.fsPath(sourceUri)).length).toEqual(0);
      expect(fse.readdirSync(FileUri.fsPath(targetUri)).length).toEqual(0);

      const stat = await fileService.move(sourceUri.toString(), targetUri.toString(), { overwrite: true });
      expect(stat.uri).toEqual(targetUri.toString());
      expect(fse.existsSync(FileUri.fsPath(sourceUri))).toBeFalsy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();
      expect(fse.readdirSync(FileUri.fsPath(targetUri)).length).toEqual(0);
    });

    it('Moving an empty directory to a non-empty directory without overwrite. Should be rejected because the target folder is not empty.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar');
      const targetFileUri_01 = targetUri.resolve('bar_01.txt');
      const targetFileUri_02 = targetUri.resolve('bar_02.txt');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      fse.mkdirSync(FileUri.fsPath(targetUri));
      fse.writeFileSync(FileUri.fsPath(targetFileUri_01), 'bar_01');
      fse.writeFileSync(FileUri.fsPath(targetFileUri_02), 'bar_02');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();
      expect(fse.readdirSync(FileUri.fsPath(sourceUri)).length).toEqual(0);
      expect(fse.readFileSync(FileUri.fsPath(targetFileUri_01), 'utf8')).toEqual('bar_01');
      expect(fse.readFileSync(FileUri.fsPath(targetFileUri_02), 'utf8')).toEqual('bar_02');
      expect(fse.readdirSync(FileUri.fsPath(targetUri))).toEqual(['bar_01.txt', 'bar_02.txt']);

      await expectThrowsAsync(fileService.move(sourceUri.toString(), targetUri.toString()));
    });

    it('Moving a non-empty directory to an empty directory. Source folder and its content should be moved to the target location.', async (): Promise<void> => {
      if (isWindows) {
        // https://github.com/theia-ide/theia/issues/2088
        return;
      }
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar');
      const sourceFileUri_01 = sourceUri.resolve('foo_01.txt');
      const sourceFileUri_02 = sourceUri.resolve('foo_02.txt');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      fse.mkdirSync(FileUri.fsPath(targetUri));
      fse.writeFileSync(FileUri.fsPath(sourceFileUri_01), 'foo_01');
      fse.writeFileSync(FileUri.fsPath(sourceFileUri_02), 'foo_02');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();
      expect(fse.readdirSync(FileUri.fsPath(targetUri)).length).toEqual(0);
      expect(fse.readdirSync(FileUri.fsPath(sourceUri))).toEqual(['foo_01.txt', 'foo_02.txt']);
      expect(fse.readFileSync(FileUri.fsPath(sourceFileUri_01), 'utf8')).toEqual('foo_01');
      expect(fse.readFileSync(FileUri.fsPath(sourceFileUri_02), 'utf8')).toEqual('foo_02');

      const stat = await fileService.move(sourceUri.toString(), targetUri.toString(), { overwrite: true });
      expect(stat.uri).toEqual(targetUri.toString());
      expect(fse.existsSync(FileUri.fsPath(sourceUri))).toBeFalsy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();
      expect(fse.readdirSync(FileUri.fsPath(targetUri))).toEqual(['foo_01.txt', 'foo_02.txt']);
      expect(fse.readFileSync(FileUri.fsPath(targetUri.resolve('foo_01.txt')), 'utf8')).toEqual('foo_01');
      expect(fse.readFileSync(FileUri.fsPath(targetUri.resolve('foo_02.txt')), 'utf8')).toEqual('foo_02');
    });

    it('Moving a non-empty directory to a non-empty directory without overwrite. Should be rejected because the target location is not empty.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar');
      const sourceFileUri_01 = sourceUri.resolve('foo_01.txt');
      const sourceFileUri_02 = sourceUri.resolve('foo_02.txt');
      const targetFileUri_01 = targetUri.resolve('bar_01.txt');
      const targetFileUri_02 = targetUri.resolve('bar_02.txt');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      fse.mkdirSync(FileUri.fsPath(targetUri));
      fse.writeFileSync(FileUri.fsPath(sourceFileUri_01), 'foo_01');
      fse.writeFileSync(FileUri.fsPath(sourceFileUri_02), 'foo_02');
      fse.writeFileSync(FileUri.fsPath(targetFileUri_01), 'bar_01');
      fse.writeFileSync(FileUri.fsPath(targetFileUri_02), 'bar_02');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(sourceFileUri_01), 'utf8')).toEqual('foo_01');
      expect(fse.readFileSync(FileUri.fsPath(sourceFileUri_02), 'utf8')).toEqual('foo_02');
      expect(fse.readFileSync(FileUri.fsPath(targetFileUri_01), 'utf8')).toEqual('bar_01');
      expect(fse.readFileSync(FileUri.fsPath(targetFileUri_02), 'utf8')).toEqual('bar_02');
      expect(fse.readdirSync(FileUri.fsPath(sourceUri))).toEqual(['foo_01.txt', 'foo_02.txt']);
      expect(fse.readdirSync(FileUri.fsPath(targetUri))).toEqual(['bar_01.txt', 'bar_02.txt']);

      await expectThrowsAsync(fileService.move(sourceUri.toString(), targetUri.toString()));
    });
  });

  describe('05 #copy', () => {
    it('Copy a file from non existing location. Should be rejected with an error. Nothing to copy.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar');
      fse.mkdirSync(FileUri.fsPath(targetUri));
      expect(fse.existsSync(FileUri.fsPath(sourceUri))).toBeFalsy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();

      await expectThrowsAsync(fileService.copy(sourceUri.toString(), targetUri.toString()), Error);
    });

    it('Copy a file to existing location without overwrite enabled. Should be rejected with an error.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar');
      fse.mkdirSync(FileUri.fsPath(targetUri));
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(targetUri)).isDirectory()).toBeTruthy();

      await expectThrowsAsync(fileService.copy(sourceUri.toString(), targetUri.toString()), Error);
    });

    it('Copy a file to existing location with the same file name. Should be rejected with an error.', async () => {
      const sourceUri = root.resolve('foo');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();

      await expectThrowsAsync(fileService.copy(sourceUri.toString(), sourceUri.toString()), Error);
    });

    it('Copy an empty directory to a non-existing location. Should return with the file stat representing the new file at the target location.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.existsSync(FileUri.fsPath(targetUri))).toBeFalsy();

      const stat = await fileService.copy(sourceUri.toString(), targetUri.toString());
      expect(stat.uri).toEqual(targetUri.toString());
      expect(fse.existsSync(FileUri.fsPath(sourceUri))).toBeTruthy();
      expect(fse.existsSync(FileUri.fsPath(targetUri))).toBeTruthy();
    });

    it('Copy an empty directory to a non-existing, nested location. Should return with the file stat representing the new file at the target location.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('nested/path/to/bar');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.existsSync(FileUri.fsPath(targetUri))).toBeFalsy();

      const stat = await fileService.copy(sourceUri.toString(), targetUri.toString());
      expect(stat.uri).toEqual(targetUri.toString());
      expect(fse.existsSync(FileUri.fsPath(sourceUri))).toBeTruthy();
      expect(fse.existsSync(FileUri.fsPath(targetUri))).toBeTruthy();
    });

    it('Copy a directory with content to a non-existing location. Should return with the file stat representing the new file at the target location.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('bar');
      const subSourceUri = sourceUri.resolve('foo_01.txt');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      fse.writeFileSync(FileUri.fsPath(subSourceUri), 'foo');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(subSourceUri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(subSourceUri), 'utf8')).toEqual('foo');
      expect(fse.existsSync(FileUri.fsPath(targetUri))).toBeFalsy();

      const stat = await fileService.copy(sourceUri.toString(), targetUri.toString());
      expect(stat.uri).toEqual(targetUri.toString());
      expect(fse.existsSync(FileUri.fsPath(sourceUri))).toBeTruthy();
      expect(fse.existsSync(FileUri.fsPath(targetUri))).toBeTruthy();
      expect(fse.readdirSync(FileUri.fsPath(sourceUri))).toEqual(['foo_01.txt']);
      expect(fse.readdirSync(FileUri.fsPath(targetUri))).toEqual(['foo_01.txt']);
      expect(fse.readFileSync(FileUri.fsPath(subSourceUri), 'utf8')).toEqual('foo');
      expect(fse.readFileSync(FileUri.fsPath(targetUri.resolve('foo_01.txt')), 'utf8')).toEqual('foo');
    });

    it('Copy a directory with content to a non-existing, nested location. Should return with the file stat representing the new file at the target location.', async () => {
      const sourceUri = root.resolve('foo');
      const targetUri = root.resolve('nested/path/to/bar');
      const subSourceUri = sourceUri.resolve('foo_01.txt');
      fse.mkdirSync(FileUri.fsPath(sourceUri));
      fse.writeFileSync(FileUri.fsPath(subSourceUri), 'foo');
      expect(fse.statSync(FileUri.fsPath(sourceUri)).isDirectory()).toBeTruthy();
      expect(fse.statSync(FileUri.fsPath(subSourceUri)).isFile()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(subSourceUri), 'utf8')).toEqual('foo');
      expect(fse.existsSync(FileUri.fsPath(targetUri))).toBeFalsy();

      const stat = await fileService.copy(sourceUri.toString(), targetUri.toString());
      expect(stat.uri).toEqual(targetUri.toString());
      expect(fse.existsSync(FileUri.fsPath(sourceUri))).toBeTruthy();
      expect(fse.existsSync(FileUri.fsPath(targetUri))).toBeTruthy();
      expect(fse.readdirSync(FileUri.fsPath(sourceUri))).toEqual(['foo_01.txt']);
      expect(fse.readdirSync(FileUri.fsPath(targetUri))).toEqual(['foo_01.txt']);
      expect(fse.readFileSync(FileUri.fsPath(subSourceUri), 'utf8')).toEqual('foo');
      expect(fse.readFileSync(FileUri.fsPath(targetUri.resolve('foo_01.txt')), 'utf8')).toEqual('foo');
    });
  });

  describe('07 #createFile', () => {
    it('Should be rejected with an error if a file already exists with the given URI.', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo');
      expect(fse.statSync(FileUri.fsPath(uri)).isFile()).toBeTruthy();

      await expectThrowsAsync(fileService.createFile(uri.toString()), Error);
    });

    it('Should be rejected with an error if the encoding is given but cannot be handled.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();

      await expectThrowsAsync(fileService.createFile(uri.toString(), { encoding: 'unknownEncoding' }), Error);
    });

    it('Should create an empty file without any contents by default.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();

      const stat = await fileService.createFile(uri.toString());
      expect(stat.uri).toEqual(uri.toString());
      expect(stat.children).toBeUndefined();
      expect(fse.readFileSync(FileUri.fsPath(uri), 'utf8')).toEqual('');
    });

    it('Should create a file with the desired content.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();

      const stat = await fileService.createFile(uri.toString(), { content: 'foo' });
      expect(stat.uri).toEqual(uri.toString());
      expect(stat.children).toBeUndefined();
      expect(fse.readFileSync(FileUri.fsPath(uri), 'utf8')).toEqual('foo');
    });

    it('Should create a file with the desired content into a non-existing, nested location.', async () => {
      const uri = root.resolve('foo/bar/baz.txt');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();

      const stat = await fileService.createFile(uri.toString(), { content: 'foo' });
      expect(stat.uri).toEqual(uri.toString());
      expect(stat.children).toBeUndefined();
      expect(fse.readFileSync(FileUri.fsPath(uri), 'utf8')).toEqual('foo');
    });

    it('Should create a file with the desired content and encoding.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();

      const stat = await fileService.createFile(uri.toString(), { content: 'foo', encoding: 'utf8' });
      expect(stat.uri).toEqual(uri.toString());
      expect(stat.children).toBeUndefined();
      expect(fse.readFileSync(FileUri.fsPath(uri), 'utf8')).toEqual('foo');
    });
  });

  describe('08 #createFolder', () => {
    it('Should be rejected with an error if a FILE already exist under the desired URI.', async () => {
      const uri = root.resolve('foo');
      fse.writeFileSync(FileUri.fsPath(uri), 'some content');
      expect(fse.statSync(FileUri.fsPath(uri)).isDirectory()).toBeFalsy();

      await expectThrowsAsync(fileService.createFolder(uri.toString()), Error);
    });

    it('Should NOT be rejected with an error if a DIRECTORY already exist under the desired URI.', async () => {
      const uri = root.resolve('foo');
      fse.mkdirSync(FileUri.fsPath(uri));
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeTruthy();

      const stat = await fileService.createFolder(uri.toString());
      expect(stat.uri).toEqual(uri.toString());
      expect(stat.children).toEqual([]);
    });

    it('Should create a directory and return with the stat object on successful directory creation.', async () => {
      const uri = root.resolve('foo');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();

      const stat = await fileService.createFolder(uri.toString());
      expect(stat.uri).toEqual(uri.toString());
      expect(stat.children).toEqual([]);
    });

    it('Should create all the missing directories and return with the stat object on successful creation.', async () => {
      const uri = root.resolve('foo/bar/foobar/barfoo');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();

      const stat = await fileService.createFolder(uri.toString());
      expect(stat.uri).toEqual(uri.toString());
      expect(stat.children).toEqual([]);
    });
  });

  describe('#10 delete', () => {
    it('Should be rejected when the file to delete does not exist.', async () => {
      const uri = root.resolve('foo.txt');
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();

      await expectThrowsAsync(fileService.delete(uri.toString(), { moveToTrash: false }), Error);
    });

    it('Should delete the file.', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo');
      expect(fse.readFileSync(FileUri.fsPath(uri), 'utf8')).toEqual('foo');

      await fileService.delete(uri.toString(), { moveToTrash: false });
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();
    });

    it('Should delete a directory without content.', async () => {
      const uri = root.resolve('foo');
      fse.mkdirSync(FileUri.fsPath(uri));
      expect(fse.statSync(FileUri.fsPath(uri)).isDirectory()).toBeTruthy();

      await fileService.delete(uri.toString(), { moveToTrash: false });
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();
    });

    it('Should delete a directory with all its content.', async () => {
      const uri = root.resolve('foo');
      const subUri = uri.resolve('bar.txt');
      fse.mkdirSync(FileUri.fsPath(uri));
      fse.writeFileSync(FileUri.fsPath(subUri), 'bar');
      expect(fse.statSync(FileUri.fsPath(uri)).isDirectory()).toBeTruthy();
      expect(fse.readFileSync(FileUri.fsPath(subUri), 'utf8')).toEqual('bar');

      await fileService.delete(uri.toString(), { moveToTrash: false });
      expect(fse.existsSync(FileUri.fsPath(uri))).toBeFalsy();
      expect(fse.existsSync(FileUri.fsPath(subUri))).toBeFalsy();
    });
  });

  describe('#15 getCurrentUserHome', () => {
    it('should not throw error', async () => {
      expect(await fileService.getCurrentUserHome()).toBeDefined();
    });
  });

  describe('watch', () => {
    it('Should return id and dispose', async () => {
      const watchId = await fileService.watchFileChanges(root.toString());
      expect(typeof watchId).toEqual('number');
      await fileService.unwatchFileChanges(watchId);
    });

    it('Should set and get Excludes', () => {
      fileService.setWatchFileExcludes(['test']);
      expect(fileService.getWatchFileExcludes()).toEqual(['test']);

      fileService.setFilesExcludes(['test'], ['/root']);
      expect(fileService.getFilesExcludes()).toEqual(['test']);
    });
  });

  describe('getFsPath', () => {
    it('Should return fsPath', async () => {
      expect(await fileService.getFsPath(root.resolve('test').toString())).toEqual(root.resolve('test').codeUri.fsPath);
    });
  });

  describe('getFileType', () => {
    it('Should return file type', async () => {
      const uri = root.resolve('foo1111.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'getFileType', { encoding: 'utf8' });
      expect(await fileService.getFileType(uri.toString())).toEqual('text');
    });
  });

  describe('getUri', () => {
    it('Should return uri', async () => {
      const uri = root.resolve('foo.txt');
      fse.writeFileSync(FileUri.fsPath(uri), 'foo');

      expect((await fileService.getUri(uri.toString())).toString()).toEqual(uri.toString());
    });
  });

  describe('fireFilesChange', () => {
    it('Should fireFilesChange event', () => {
      let changes;
      (fileService as FileService).onFilesChanged((e) => {
        changes = e.changes;
      });
      const uri = root.resolve('foo.txt');
      fileService.fireFilesChange([{ uri: uri.toString(), type: FileChangeType.UPDATED }]);

      expect(changes).toEqual([{ uri: uri.toString(), type: FileChangeType.UPDATED }]);
    });
  });

  describe('dispose', () => {
    it('Should no error', async () => {
      expect(fileService.dispose()).toBeUndefined();
    });
  });
});
