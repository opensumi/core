import path from 'path';

import * as fs from 'fs-extra';
import temp from 'temp';

import { MockLoggerManageClient } from '@opensumi/ide-core-browser/__mocks__/logger';
import { URI, StoragePaths, FileUri, IFileServiceClient, ILoggerManagerClient } from '@opensumi/ide-core-common';
import { AppConfig } from '@opensumi/ide-core-node';
import { IExtensionStorageServer, IExtensionStoragePathServer } from '@opensumi/ide-extension-storage';
import { FileStat, IDiskFileProvider } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ExtensionStorageModule } from '../../src/browser';

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error(reason);
});

describe('Extension Storage Server -- Setup directory should be worked', () => {
  let injector: MockInjector;
  let root: URI;
  const track = temp.track();

  const initializeInjector = async () => {
    injector = createBrowserInjector([ExtensionStorageModule]);

    injector.addProviders(
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
      {
        token: AppConfig,
        useValue: {},
      },
      {
        token: IFileServiceClient,
        useClass: FileServiceClient,
      },
      {
        token: IDiskFileProvider,
        useClass: DiskFileSystemProvider,
      },
    );

    const fileServiceClient: FileServiceClient = injector.get(IFileServiceClient);
    fileServiceClient.registerProvider('file', injector.get(IDiskFileProvider));
  };

  beforeEach(() => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('extension-storage-test')));

    return initializeInjector();
  });

  afterEach(() => {
    track.cleanupSync();
    injector.disposeAll();
  });

  it('Extension Path Server should setup directory correctly', async (done) => {
    const extensionStorage = injector.get(IExtensionStorageServer);
    const rootFileStat = {
      uri: root.toString(),
      isDirectory: true,
      lastModification: 0,
    } as FileStat;
    const extensionStorageDirName = '.extensionStorageDirName';
    injector.mock(ILoggerManagerClient, 'getLogFolder', () => root.path.toString());
    injector.mock(IExtensionStoragePathServer, 'getUserHomeDir', async () => root.path.toString());
    await extensionStorage.init(rootFileStat, [rootFileStat], extensionStorageDirName);
    expect(fs.existsSync(path.join(root.path.toString(), extensionStorageDirName))).toBeTruthy();
    expect(
      fs.existsSync(
        path.join(root.path.toString(), extensionStorageDirName, StoragePaths.EXTENSIONS_GLOBAL_STORAGE_DIR),
      ),
    ).toBeTruthy();
    expect(
      fs.existsSync(
        path.join(root.path.toString(), extensionStorageDirName, StoragePaths.EXTENSIONS_WORKSPACE_STORAGE_DIR),
      ),
    ).toBeTruthy();
    done();
  });
});

describe('Extension Storage Server -- Data operation should be worked', () => {
  let injector: MockInjector;
  let root: URI;
  let extensionStorage: IExtensionStorageServer;
  const track = temp.track();

  const initializeInjector = async () => {
    injector = createBrowserInjector([ExtensionStorageModule]);

    injector.addProviders(
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
      {
        token: AppConfig,
        useValue: {},
      },
      {
        token: IFileServiceClient,
        useClass: FileServiceClient,
      },
      {
        token: IDiskFileProvider,
        useClass: DiskFileSystemProvider,
      },
    );

    const fileServiceClient: FileServiceClient = injector.get(IFileServiceClient);
    fileServiceClient.registerProvider('file', injector.get(IDiskFileProvider));
  };

  beforeEach(async () => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('extension-storage-test')));

    await initializeInjector();

    extensionStorage = injector.get(IExtensionStorageServer);
    const rootFileStat = {
      uri: root.toString(),
      isDirectory: true,
      lastModification: 0,
    } as FileStat;
    const extensionStorageDirName = '.extensionStorageDirName';
    injector.mock(ILoggerManagerClient, 'getLogFolder', () => root.path.toString());
    injector.mock(IExtensionStoragePathServer, 'getUserHomeDir', async () => root.path.toString());
    await extensionStorage.init(rootFileStat, [rootFileStat], extensionStorageDirName);
  });

  afterEach(() => {
    track.cleanupSync();
    injector.disposeAll();
  });

  it('Global -- set value can be work', async (done) => {
    const isGlobal = true;
    const key = 'test';
    const value = {
      hello: 'world',
    };
    const data = {};
    data[key] = value;
    await extensionStorage.set(key, value, isGlobal);
    expect(await extensionStorage.get(key, isGlobal)).toEqual(value);
    expect(await extensionStorage.getAll(isGlobal)).toEqual(data);
    done();
  });

  it('Workspace -- set value can be work', async (done) => {
    const isGlobal = false;
    const key = 'test';
    const value = {
      hello: 'world',
    };
    const data = {};
    data[key] = value;
    await extensionStorage.set(key, value, isGlobal);
    expect(await extensionStorage.get(key, isGlobal)).toEqual(value);
    expect(await extensionStorage.getAll(isGlobal)).toEqual(data);
    done();
  });
});
