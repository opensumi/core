import fs from 'fs-extra';
import temp from 'temp';

import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  DisposableCollection,
  Event,
  FileChangeType,
  FileSystemProviderCapabilities,
  FileUri,
  UTF8,
} from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-core-common/lib/types/file';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { FileService } from '@opensumi/ide-file-service/lib/node';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';
import { WatcherProcessManagerToken } from '@opensumi/ide-file-service/lib/node/watcher-process-manager';
import { SumiReadableStream } from '@opensumi/ide-utils/lib/stream';

import { FileServicePath, IDiskFileProvider, IFileServiceClient } from '../../src';
import { FileServiceClientModule } from '../../src/browser';
import { RecursiveFileSystemWatcher } from '../../src/node/hosted/recursive/file-service-watcher';

function createMockStreamProvider() {
  return {
    capabilities: FileSystemProviderCapabilities.FileReadWrite,
    onDidChangeCapabilities: Event.None,
    onDidChangeFile: Event.None,
    watch: jest.fn(() => 1),
    stat: jest.fn(),
    readFile: jest.fn(),
    readFileStream: jest.fn(),
  };
}

function createReadableStream(chunks: Uint8Array[]) {
  const stream = new SumiReadableStream<Uint8Array>();
  setTimeout(() => {
    chunks.forEach((chunk) => stream.emitData(chunk));
    stream.end();
  }, 0);
  return stream;
}

function createStreamStat(uri: string, size: number): FileStat {
  return {
    uri,
    lastModification: Date.now(),
    isDirectory: false,
    size,
  };
}

describe('FileServiceClient should be work', () => {
  jest.setTimeout(10000);

  const injector = createBrowserInjector([FileServiceClientModule]);
  const toDispose = new DisposableCollection();
  let fileServiceClient: IFileServiceClient;
  let streamProvider: ReturnType<typeof createMockStreamProvider>;
  const track = temp.track();
  const tempDir = FileUri.create(fs.realpathSync(temp.mkdirSync('file-service-client-test')));
  const preferenceGetValidMock = jest.fn();
  const preferenceServiceMock = {
    getValid: preferenceGetValidMock,
  };

  injector.overrideProviders(
    {
      token: FileServicePath,
      useClass: FileService,
    },
    {
      token: IDiskFileProvider,
      useClass: DiskFileSystemProvider,
    },
    {
      token: WSChannelHandler,
      useValue: {
        clientId: 'test_client_id',
      },
    },
    {
      token: WatcherProcessManagerToken,
      useValue: {
        setClient: () => void 0,
        watch: (() => 1) as any,
        unWatch: () => void 0,
        createProcess: () => void 0,
        setWatcherFileExcludes: () => void 0,
      },
    },
    {
      token: PreferenceService,
      useValue: preferenceServiceMock,
    },
  );

  beforeAll(() => {
    // @ts-ignore
    injector.mock(RecursiveFileSystemWatcher, 'shouldUseNSFW', () => Promise.resolve(false));
    fileServiceClient = injector.get(IFileServiceClient);
    toDispose.push(fileServiceClient.registerProvider('file', injector.get(IDiskFileProvider)));
    streamProvider = createMockStreamProvider();
    toDispose.push(fileServiceClient.registerProvider('stream', streamProvider as any));
  });

  afterAll(async () => {
    toDispose.dispose();
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

  it('onImageFilesChanged event', (done) => {
    async function inner() {
      fileServiceClient.onImageFilesChanged((event) => {
        // 期望只收到一个image的event
        expect(event.every((v) => v.uri.includes('a.jpg'))).toBeTruthy();
        done();
      });
      // 触发两个change
      await fileServiceClient.fireFilesChange({
        changes: [
          {
            uri: 'a.jpg',
            type: FileChangeType.UPDATED,
          },
          {
            uri: 'a.log',
            type: FileChangeType.UPDATED,
          },
        ],
      });
    }
    inner();
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

  describe('large file stream reading', () => {
    const streamResourceUri = 'stream://test/large-file.txt';

    const configureStreamPreferences = (threshold: number, enabled: boolean) => {
      preferenceGetValidMock.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'editor.largeFile') {
          return threshold;
        }
        if (key === 'editor.streamLargeFile') {
          return enabled;
        }
        return defaultValue;
      });
    };

    beforeEach(() => {
      preferenceGetValidMock.mockReset();
      streamProvider.stat.mockReset();
      streamProvider.readFile.mockReset();
      streamProvider.readFileStream.mockReset();
    });

    it('reads via stream when preference enabled and size exceeds threshold', async () => {
      configureStreamPreferences(10, true);
      streamProvider.stat.mockResolvedValue(createStreamStat(streamResourceUri, 20));
      const chunkOne = new Uint8Array([1, 2]);
      const chunkTwo = new Uint8Array([3, 4]);
      streamProvider.readFileStream.mockImplementation(async () => createReadableStream([chunkOne, chunkTwo]));
      streamProvider.readFile.mockResolvedValue(new Uint8Array([9]));

      const result = await fileServiceClient.readFile(streamResourceUri);

      expect(Array.from(result.content.buffer)).toEqual([1, 2, 3, 4]);
      expect(streamProvider.readFileStream).toHaveBeenCalledTimes(1);
      expect(streamProvider.readFile).not.toHaveBeenCalled();
    });

    it('reads via stream when size equals threshold', async () => {
      configureStreamPreferences(10, true);
      streamProvider.stat.mockResolvedValue(createStreamStat(streamResourceUri, 10));
      const chunk = new Uint8Array([11]);
      streamProvider.readFileStream.mockImplementation(async () => createReadableStream([chunk]));

      const result = await fileServiceClient.readFile(streamResourceUri);

      expect(streamProvider.readFileStream).toHaveBeenCalledTimes(1);
      expect(streamProvider.readFile).not.toHaveBeenCalled();
      expect(Array.from(result.content.buffer)).toEqual([11]);
    });

    it('falls back to readFile when stream reading fails', async () => {
      configureStreamPreferences(10, true);
      streamProvider.stat.mockResolvedValue(createStreamStat(streamResourceUri, 50));
      streamProvider.readFileStream.mockImplementation(async () => {
        throw new Error('stream error');
      });
      const fallbackContent = new Uint8Array([7]);
      streamProvider.readFile.mockResolvedValue(fallbackContent);

      const result = await fileServiceClient.readFile(streamResourceUri);

      expect(streamProvider.readFileStream).toHaveBeenCalledTimes(1);
      expect(streamProvider.readFile).toHaveBeenCalledTimes(1);
      expect(Array.from(result.content.buffer)).toEqual([7]);
    });

    it('skips stream path when preference disables it', async () => {
      configureStreamPreferences(10, false);
      streamProvider.stat.mockResolvedValue(createStreamStat(streamResourceUri, 20));
      const fallbackContent = new Uint8Array([5, 6]);
      streamProvider.readFile.mockResolvedValue(fallbackContent);

      const result = await fileServiceClient.readFile(streamResourceUri);

      expect(streamProvider.readFileStream).not.toHaveBeenCalled();
      expect(streamProvider.readFile).toHaveBeenCalledTimes(1);
      expect(Array.from(result.content.buffer)).toEqual([5, 6]);
    });

    it('uses readFile when size is below threshold even if streaming enabled', async () => {
      configureStreamPreferences(10, true);
      streamProvider.stat.mockResolvedValue(createStreamStat(streamResourceUri, 5));
      const smallContent = new Uint8Array([8, 9]);
      streamProvider.readFile.mockResolvedValue(smallContent);

      const result = await fileServiceClient.readFile(streamResourceUri);

      expect(streamProvider.readFileStream).not.toHaveBeenCalled();
      expect(streamProvider.readFile).toHaveBeenCalledTimes(1);
      expect(Array.from(result.content.buffer)).toEqual([8, 9]);
    });
  });
});
