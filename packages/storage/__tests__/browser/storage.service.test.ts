import * as fs from 'fs-extra';
import temp from 'temp';

import { Injectable, Injector } from '@opensumi/di';
import {
  URI,
  FileUri,
  STORAGE_SCHEMA,
  Disposable,
  StorageProvider,
  DefaultStorageProvider,
  STORAGE_NAMESPACE,
  ILoggerManagerClient,
  ScopedBrowserStorageService,
  GlobalBrowserStorageService,
} from '@opensumi/ide-core-browser';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IFileServiceClient, IDiskFileProvider } from '@opensumi/ide-file-service';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { StorageModule } from '../../src/browser';
import { IStoragePathServer } from '../../src/common';

const track = temp.track();
const root = FileUri.create(fs.realpathSync(temp.mkdirSync('storage-root')));
@Injectable()
export class MockDatabaseStoragePathServer implements IStoragePathServer {
  async getLastWorkspaceStoragePath() {
    return root.resolve('datas').toString();
  }

  async getLastGlobalStoragePath() {
    return root.toString();
  }

  async provideWorkspaceStorageDirPath(): Promise<string | undefined> {
    return root.resolve('datas').toString();
  }

  async provideGlobalStorageDirPath(): Promise<string | undefined> {
    return root.toString();
  }

  init() {
    return true;
  }

  getItems() {
    return {};
  }
}

const MockWorkspaceService = {
  onWorkspaceChanged: jest.fn(() => Disposable.create(() => {})),
  workspace: {
    uri: root.resolve('workspace').toString(),
  },
  whenReady: Promise.resolve(),
};

describe('StorageProvider should be work', () => {
  let injector: Injector;
  const MockLoggerManagerClient = {
    getLogger: jest.fn(),
  };
  beforeAll(async () => {
    injector = createBrowserInjector([StorageModule]);
    injector.overrideProviders(
      {
        token: IFileServiceClient,
        useValue: {
          access: () => false,
          createFolder: () => {},
          createFile: () => ({
            uri: root.resolve('storage').toString(),
          }),
          setContent: () => {},
          readFile: () => '{}',
          getFileStat: () => undefined,
        },
      },
      {
        token: IDiskFileProvider,
        useClass: DiskFileSystemProvider,
      },
      {
        token: IStoragePathServer,
        useClass: MockDatabaseStoragePathServer,
      },
      {
        token: IWorkspaceService,
        useValue: MockWorkspaceService,
      },
      {
        token: ILoggerManagerClient,
        useValue: MockLoggerManagerClient,
      },
      {
        token: StorageProvider,
        useFactory: () => (storageId) => injector.get(DefaultStorageProvider).get(storageId),
      },
    );
  });

  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(async () => {
    track.cleanupSync();
  });

  it('Get GlobalStorage', async () => {
    const getStorage: StorageProvider = injector.get(StorageProvider);
    const recentStorage = await getStorage(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA);
    expect(recentStorage).toBeDefined();
    await recentStorage.whenReady;
    const commands = ['test'];
    recentStorage.set('commands', commands);
    expect(recentStorage.get('commands')).toEqual(commands);
  });

  it('Get ScopedStorage', async () => {
    const getStorage: StorageProvider = injector.get(StorageProvider);
    const explorerStorage = await getStorage(STORAGE_NAMESPACE.EXPLORER);
    expect(explorerStorage).toBeDefined();
    await explorerStorage.whenReady;
    const toggle = false;
    explorerStorage.set('toggle', toggle);
    expect(explorerStorage.get('toggle')).toBe(toggle);
  });

  it('Builtin ScopedStorage will create and add expires on LocalStorage', async () => {
    const getStorage: StorageProvider = injector.get(StorageProvider);
    const extensionStorage = await getStorage(STORAGE_NAMESPACE.EXTENSIONS);
    expect(extensionStorage).toBeDefined();
    await extensionStorage.whenReady;
    const extensions = ['opensumi.test.extension'];
    await extensionStorage.set('extensions', extensions);
    expect(extensionStorage.get('extensions')).toEqual(extensions);
    const browserLocalStroage = injector.get(ScopedBrowserStorageService, [MockWorkspaceService.workspace.uri]);
    const cache = browserLocalStroage.getData<any>(STORAGE_NAMESPACE.EXTENSIONS.path.toString());
    expect(typeof cache?.expires).toBe('number');
    expect(cache?.extensions).toBe(JSON.stringify(extensions));
  });

  it('Builtin GlobalStorage will create LocalStorage without expires data', async () => {
    const getStorage: StorageProvider = injector.get(StorageProvider);
    const recentStorage = await getStorage(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA);
    expect(recentStorage).toBeDefined();
    await recentStorage.whenReady;
    const recents = ['opensumi.test.recent'];
    await recentStorage.set('recents', recents);
    expect(recentStorage.get('recents')).toEqual(recents);
    const browserLocalStroage = injector.get(GlobalBrowserStorageService);
    const cache = browserLocalStroage.getData<any>(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA.path.toString());
    expect(cache?.expires).toBeUndefined();
    expect(cache?.recents).toBe(JSON.stringify(recents));
  });

  it('Custom ScopedStorage will disable cache on LocalStorage', async () => {
    const getStorage: StorageProvider = injector.get(StorageProvider);
    const customId = new URI('test').withScheme(STORAGE_SCHEMA.SCOPE);
    const extensionStorage = await getStorage(customId);
    expect(extensionStorage).toBeDefined();
    await extensionStorage.whenReady;
    const test = ['test'];
    await extensionStorage.set('test', test);
    expect(extensionStorage.get('test')).toEqual(test);
    const browserLocalStroage = injector.get(ScopedBrowserStorageService, [MockWorkspaceService.workspace.uri]);
    const cache = browserLocalStroage.getData<any>(customId.path.toString());
    expect(cache?.expires).toBeUndefined();
    expect(cache?.test).toBeUndefined();
  });
});
