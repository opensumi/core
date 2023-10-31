import fs from 'fs-extra';
import temp from 'temp';

import { FileUri, UTF8 } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { FileService } from '@opensumi/ide-file-service/lib/node';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';

import { IFileServiceClient, FileServicePath, IDiskFileProvider } from '../../src';
import { FileServiceClientModule } from '../../src/browser';
import { FileSystemWatcherServer } from '../../src/node/recursive/file-service-watcher';

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
    // @ts-ignore
    injector.mock(FileSystemWatcherServer, 'isEnableNSFW', () => false);
    fileServiceClient = injector.get(IFileServiceClient);
    fileServiceClient.registerProvider('file', injector.get(IDiskFileProvider));
  });

  afterAll(async () => {
    await injector.disposeAll();
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

  it('watch file change', async () => {
    const newTempDir = FileUri.create(fs.realpathSync(track.mkdirSync('watch-file-change')));

    const watcher = await fileServiceClient.watchFileChanges(newTempDir);

    const toCreate = newTempDir.resolve('i-will-be-create');
    watcher.onFilesChanged((event) => {
      // 在 MacOS 上偶尔会有两个事件，一个是 newTempDir 创建，一个是 toCreate 创建
      expect(event.every((v) => v.uri.includes(newTempDir.toString()))).toBeTruthy();
    });

    await fileServiceClient.createFolder(toCreate.toString());
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await watcher.dispose();
  });

  it('set fileExcludes', async () => {
    const targetDir = tempDir.resolve('watch-file-exclude-temp-dir');
    await fs.ensureDir(targetDir.codeUri.fsPath);
    await fileServiceClient.setFilesExcludes(['**/test/**'], [targetDir.toString()]);
    await fs.ensureDir(targetDir.resolve('test').codeUri.fsPath);
    const stat = await fileServiceClient.getFileStat(targetDir.toString());
    expect(stat?.children?.length === 0).toBeTruthy();
  });

  it('set watchExcludes', async () => {
    const targetDir = tempDir.resolve('watch-exclude-temp-dir');
    await fs.ensureDir(targetDir.codeUri.fsPath);

    await fileServiceClient.setWatchFileExcludes(['**/test/**']);
    const watcher = await fileServiceClient.watchFileChanges(targetDir);
    watcher.onFilesChanged((event) => {
      expect(!!event.find((e) => e.uri === targetDir.resolve('abc.js').toString())).toBeTruthy();
      expect(!!event.find((e) => e.uri === targetDir.resolve('test').toString())).toBeFalsy();
    });
    await fs.ensureDir(targetDir.resolve('test').codeUri.fsPath);
    await fs.ensureDir(targetDir.resolve('abc.js').codeUri.fsPath);

    await new Promise((resolve) => setTimeout(resolve, 500));

    await watcher.dispose();
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
