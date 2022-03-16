import fs from 'fs-extra';
import temp from 'temp';

import { FileUri } from '@opensumi/ide-core-common';
import { UTF8 } from '@opensumi/ide-core-common/lib/encoding';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { FileService } from '@opensumi/ide-file-service/lib/node';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';

import { IFileServiceClient, FileServicePath, IDiskFileProvider } from '../../src';
import { FileServiceClientModule } from '../../src/browser';


describe('FileServiceClient should be work', () => {
  const injector = createBrowserInjector([FileServiceClientModule]);
  let fileServiceClient: IFileServiceClient;
  const track = temp.track();
  const tempDir = FileUri.create(fs.realpathSync(temp.mkdirSync('file-service-client-test')));

  injector.overrideProviders(
    {
      token: FileServicePath,
      useClass: FileService,
    },
    {
      token: IDiskFileProvider,
      useClass: DiskFileSystemProvider,
    },
  );

  beforeAll(() => {
    jest.setTimeout(10000);
    fileServiceClient = injector.get(IFileServiceClient);
    fileServiceClient.registerProvider('file', injector.get(IDiskFileProvider));
  });

  afterAll(() => {
    injector.disposeAll();
    track.cleanupSync();
  });

  it('get directory file', async () => {
    const stat = await fileServiceClient.getFileStat(tempDir.toString());
    expect(stat?.isDirectory).toBeTruthy();
    expect(stat?.isSymbolicLink).toBeFalsy();
    expect(stat?.uri).toBe(tempDir.toString());
  });

  it('get normal file', async () => {
    const sourceFile = tempDir.resolve('index.html');
    await fs.createFile(sourceFile.codeUri.fsPath);
    const stat = await fileServiceClient.getFileStat(sourceFile.toString());
    expect(stat?.isDirectory).toBeFalsy();
    expect(stat?.isSymbolicLink).toBeFalsy();
    expect(stat?.uri).toBe(sourceFile.toString());
  });

  it('get symbolic link file', async () => {
    const sourceDir = tempDir.resolve('source-dir');
    const linkUri = tempDir.resolve('symbol-file');
    await fs.ensureDir(sourceDir.codeUri.fsPath);
    await fs.symlink(sourceDir.codeUri.fsPath, linkUri.codeUri.fsPath);
    const stat = await fileServiceClient.getFileStat(linkUri.toString());
    expect(stat?.isSymbolicLink).toBeTruthy();
    expect(stat?.isDirectory).toBeTruthy();
    expect(stat?.uri).toBe(linkUri.toString());
  });

  it('setContent / getContent', async () => {
    const sourceFile = tempDir.resolve('index.js');
    await fileServiceClient.createFile(sourceFile.toString());
    const stat = await fileServiceClient.getFileStat(sourceFile.toString());
    expect(stat?.isDirectory).toBeFalsy();
    expect(stat?.isSymbolicLink).toBeFalsy();
    if (stat) {
      const content = "console.log('hello world')";
      await fileServiceClient.setContent(stat, content);
      const result = await fileServiceClient.readFile(stat.uri);
      expect(result.content.toString()).toBe(content);
    }
  });

  it('isReadonly', async () => {
    const readonly = await fileServiceClient.isReadonly(tempDir.codeUri.fsPath);
    expect(readonly).toBeFalsy();
  });

  it('access', async () => {
    const access = await fileServiceClient.access(tempDir.codeUri.fsPath);
    expect(access).toBeTruthy();
  });

  it('move', async () => {
    const sourceDir = tempDir.resolve('temp-dir1');
    const targetDir = tempDir.resolve('temp-dir2');
    await fs.ensureDir(sourceDir.codeUri.fsPath);
    await fileServiceClient.move(sourceDir.toString(), targetDir.toString());
    const stat = await fileServiceClient.getFileStat(targetDir.toString());
    expect(stat?.isSymbolicLink).toBeFalsy();
    expect(stat?.isDirectory).toBeTruthy();
    expect(stat?.uri).toBe(targetDir.toString());
  });

  it('copy', async () => {
    const sourceDir = tempDir.resolve('temp-dir3');
    const targetDir = tempDir.resolve('temp-dir4');
    await fs.ensureDir(sourceDir.codeUri.fsPath);
    await fileServiceClient.copy(sourceDir.toString(), targetDir.toString());
    let stat = await fileServiceClient.getFileStat(targetDir.toString());
    expect(stat?.isSymbolicLink).toBeFalsy();
    expect(stat?.isDirectory).toBeTruthy();
    expect(stat?.uri).toBe(targetDir.toString());
    stat = await fileServiceClient.getFileStat(sourceDir.toString());
    expect(stat?.isSymbolicLink).toBeFalsy();
    expect(stat?.isDirectory).toBeTruthy();
    expect(stat?.uri).toBe(sourceDir.toString());
  });

  it('getCurrentUserHome', async () => {
    const userhome = await fileServiceClient.getCurrentUserHome();
    expect(typeof userhome?.uri).toBe('string');
  });

  it('getFsPath', async () => {
    const fsPath = await fileServiceClient.getFsPath(tempDir.toString());
    expect(fsPath).toBe(tempDir.codeUri.fsPath);
  });

  it('watch file change', async (done) => {
    const watcher = await fileServiceClient.watchFileChanges(tempDir);
    const targetDir = tempDir.resolve('temp-dir5');
    watcher.onFilesChanged(async (event) => {
      expect(event[0].uri).toBe(targetDir.toString());
      await fileServiceClient.unwatchFileChanges(watcher.watchId);
      watcher.dispose();
      done();
    });
    setTimeout(async () => {
      await fileServiceClient.createFolder(targetDir.toString());
    }, 200);
  });

  it('set fileExcludes', async () => {
    const targetDir = tempDir.resolve('watch-file-exclude-temp-dir');
    await fs.ensureDir(targetDir.codeUri.fsPath);
    await fileServiceClient.setFilesExcludes(['**/test/**'], [targetDir.toString()]);
    await fs.ensureDir(targetDir.resolve('test').codeUri.fsPath);
    const stat = await fileServiceClient.getFileStat(targetDir.toString());
    expect(stat?.children?.length === 0).toBeTruthy();
  });

  it('set watchExcludes', async (done) => {
    const targetDir = tempDir.resolve('watch-exclude-temp-dir');
    await fs.ensureDir(targetDir.codeUri.fsPath);
    await fileServiceClient.setWatchFileExcludes(['**/test/**']);
    const watcher = await fileServiceClient.watchFileChanges(targetDir);
    watcher.onFilesChanged(async (event) => {
      expect(!!event.find((e) => e.uri === targetDir.resolve('abc.js').toString())).toBeTruthy();
      expect(!!event.find((e) => e.uri === targetDir.resolve('test').toString())).toBeFalsy();
      await fileServiceClient.unwatchFileChanges(watcher.watchId);
      watcher.dispose();
      done();
    });
    setTimeout(async () => {
      await fs.ensureDir(targetDir.resolve('test').codeUri.fsPath);
      await fs.ensureDir(targetDir.resolve('abc.js').codeUri.fsPath);
    }, 200);
  });

  it('delete file', async () => {
    const targetDir = tempDir.resolve('delete-temp-dir');
    await fs.ensureDir(targetDir.codeUri.fsPath);
    await fs.ensureDir(targetDir.resolve('test').codeUri.fsPath);
    let stat = await fileServiceClient.getFileStat(targetDir.toString());
    expect(stat?.children?.length).toBe(1);
    await fileServiceClient.delete(targetDir.resolve('test').toString());
    stat = await fileServiceClient.getFileStat(targetDir.toString());
    expect(stat?.children?.length).toBe(0);
  });

  it('getEncoding', async () => {
    // always utf8;
    const encoding = await fileServiceClient.getEncoding(tempDir.toString());
    expect(encoding).toBe(UTF8);
  });
});
