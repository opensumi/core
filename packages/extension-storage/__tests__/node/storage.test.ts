import { URI, StoragePaths, FileUri, ILogServiceManager } from '@ali/ide-core-common';
import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ExtensionStorageModule } from '@ali/ide-extension-storage/lib/node';
import { IExtensionStorageServer, IExtensionStoragePathServer } from '@ali/ide-extension-storage';
import { FileStat } from '@ali/ide-file-service';
import * as fs from 'fs-extra';
import * as temp from 'temp';
import * as path from 'path';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';
import { MockLoggerManageClient } from '@ali/ide-core-browser/lib/mocks/logger';
import { AppConfig } from '@ali/ide-core-node';

process.on('unhandledRejection', (reason) => {
  console.error(reason);
});

describe('Extension Storage Server -- Setup directory should be worked', () => {

  let injector: MockInjector;
  let root: URI;
  const track = temp.track();

  const initializeInjector = async () => {

    injector = createNodeInjector([
      FileServiceModule,
      ExtensionStorageModule,
    ]);

    injector.addProviders({
      token: ILogServiceManager,
      useClass: MockLoggerManageClient,
    }, {
      token: AppConfig,
      useValue: {},
    });
  };

  beforeEach(() => {
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('extension-storage-test')));

    return initializeInjector();
  });

  afterEach(() => {
    track.cleanupSync();
  });

  it('Extension Path Server should setup directory correctly', async (done) => {
    const extensionStorage = injector.get(IExtensionStorageServer);
    const rootFileStat = {
      uri: root.toString(),
      isDirectory: true,
      lastModification: 0,
    } as FileStat;
    const extensionStorageDirName = '.extensionStorageDirName';
    injector.mock(ILogServiceManager, 'getLogFolder', () => {
      return root.withoutScheme().toString();
    });
    injector.mock(IExtensionStoragePathServer, 'getUserHomeDir', async () => {
      return root.withoutScheme().toString();
    });
    await extensionStorage.init(rootFileStat, [rootFileStat], extensionStorageDirName);
    expect(fs.existsSync(path.join(root.withoutScheme().toString(), extensionStorageDirName))).toBeTruthy();
    expect(fs.existsSync(path.join(root.withoutScheme().toString(), extensionStorageDirName, StoragePaths.EXTENSIONS_GLOBAL_STORAGE_DIR))).toBeTruthy();
    expect(fs.existsSync(path.join(root.withoutScheme().toString(), extensionStorageDirName, StoragePaths.EXTENSIONS_WORKSPACE_STORAGE_DIR))).toBeTruthy();
    done();
  });

});

describe('Extension Storage Server -- Data operation should be worked', () => {

  let injector: MockInjector;
  let root: URI;
  let extensionStorage: IExtensionStorageServer;
  const track = temp.track();

  const initializeInjector = async () => {

    injector = createNodeInjector([
      FileServiceModule,
      ExtensionStorageModule,
    ]);

    injector.addProviders({
      token: ILogServiceManager,
      useClass: MockLoggerManageClient,
    }, {
      token: AppConfig,
      useValue: {},
    });
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
    injector.mock(ILogServiceManager, 'getLogFolder', () => {
      return root.withoutScheme().toString();
    });
    injector.mock(IExtensionStoragePathServer, 'getUserHomeDir', async () => {
      return root.withoutScheme().toString();
    });
    await extensionStorage.init(rootFileStat, [rootFileStat], extensionStorageDirName);
  });

  afterEach(() => {
    track.cleanupSync();
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
