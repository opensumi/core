import path from 'path';

import * as fs from 'fs-extra';
import temp from 'temp';

import { Injectable, Injector } from '@opensumi/di';
import { URI, FileUri, AppConfig, Disposable, STORAGE_SCHEMA, ILoggerManagerClient } from '@opensumi/ide-core-node';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IFileServiceClient, IDiskFileProvider } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';
import { Storage } from '@opensumi/ide-storage/lib/browser/storage';
import { DatabaseStorageContribution } from '@opensumi/ide-storage/lib/browser/storage.contribution';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { StorageModule } from '../../src/browser';
import {
  IStorageServer,
  IStoragePathServer,
  IUpdateRequest,
  IWorkspaceStorageServer,
  IGlobalStorageServer,
} from '../../src/common';

const track = temp.track();
const root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));
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
}

describe('WorkspaceStorage should be work', () => {
  let workspaceStorage: IStorageServer;
  let globalStorage: IStorageServer;
  let injector: Injector;
  let databaseStorageContribution: DatabaseStorageContribution;
  const storageName = 'testStorage';
  const MockWorkspaceService = {
    onWorkspaceChanged: jest.fn(() => Disposable.create(() => {})),
    workspace: {
      uri: 'file://home',
    },
    whenReady: Promise.resolve(),
  };
  const MockLoggerManagerClient = {
    getLogger: jest.fn(),
  };
  beforeAll(() => {
    injector = createBrowserInjector([StorageModule]);

    injector.addProviders({
      token: AppConfig,
      useValue: {},
    });

    injector.overrideProviders(
      {
        token: IFileServiceClient,
        useClass: FileServiceClient,
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
    );
    const fileServiceClient: FileServiceClient = injector.get(IFileServiceClient);
    fileServiceClient.registerProvider('file', injector.get(IDiskFileProvider));
    workspaceStorage = injector.get(IWorkspaceStorageServer);
    globalStorage = injector.get(IGlobalStorageServer);
    databaseStorageContribution = injector.get(DatabaseStorageContribution);
  });

  afterAll(async () => {
    track.cleanupSync();
  });

  describe('01 #init', () => {
    let storagePath;

    it('Storage directory path should be return.', async () => {
      storagePath = await workspaceStorage.init();
      expect(typeof storagePath).toBe('string');
      storagePath = await globalStorage.init();
      expect(typeof storagePath).toBe('string');
    });
  });

  describe('02 #getItems', () => {
    it('Storage should return {}.', async () => {
      const workspace = await workspaceStorage.getItems(storageName);
      expect(typeof workspace).toBe('object');
      expect(Object.keys(workspace).length).toBe(0);
      const global = await globalStorage.getItems(storageName);
      expect(typeof global).toBe('object');
      expect(Object.keys(global).length).toBe(0);
    });
  });

  describe('03 #workspaceStorage', () => {
    it('storage with single storageName should be updated.', async () => {
      const updateRequest: IUpdateRequest = {
        insert: {
          id: 2,
          name: 'test',
        },
        delete: ['id'],
      };
      await workspaceStorage.updateItems(storageName, updateRequest);
      expect(fs.existsSync(path.join(root.path.toString(), `datas/${storageName}.json`))).toBeTruthy();
      const res = await workspaceStorage.getItems(storageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });

    it('storage with long storageName should be updated.', async () => {
      const longStorageName = `${storageName}/path`;
      const updateRequest: IUpdateRequest = {
        insert: {
          id: 2,
          name: 'test',
        },
        delete: ['id'],
      };
      await workspaceStorage.updateItems(longStorageName, updateRequest);
      expect(fs.existsSync(path.join(root.path.toString(), `datas/${longStorageName}.json`))).toBeTruthy();
      const res = await workspaceStorage.getItems(longStorageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });
  });

  describe('04 #globalStorage', () => {
    it('storage with single storageName should be updated.', async () => {
      const updateRequest: IUpdateRequest = {
        insert: {
          id: 2,
          name: 'test',
        },
        delete: ['id'],
      };
      await globalStorage.updateItems(storageName, updateRequest);
      expect(fs.existsSync(path.join(root.path.toString(), `${storageName}.json`))).toBeTruthy();
      const res = await globalStorage.getItems(storageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });

    it('storage with long storageName should be updated.', async () => {
      const longStorageName = `${storageName}/path`;
      const updateRequest: IUpdateRequest = {
        insert: {
          id: 2,
          name: 'test',
        },
        delete: ['id'],
      };
      await globalStorage.updateItems(longStorageName, updateRequest);
      expect(fs.existsSync(path.join(root.path.toString(), `${longStorageName}.json`))).toBeTruthy();
      const res = await globalStorage.getItems(longStorageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });
  });

  describe('04 #Storage', () => {
    it('Should be init correctly', async (done) => {
      const scopedStorageUri = new URI('scope').withScheme(STORAGE_SCHEMA.SCOPE);
      const scopedStorage = await databaseStorageContribution.resolve(scopedStorageUri);
      expect(scopedStorage).toBeDefined();
      expect((scopedStorage as Storage).whenReady).toBeDefined();
      expect(MockWorkspaceService.onWorkspaceChanged).toBeCalledTimes(1);
      const globalStorageUri = new URI('global').withScheme(STORAGE_SCHEMA.GLOBAL);
      const globalStorage = await databaseStorageContribution.resolve(globalStorageUri);
      expect(globalStorage).toBeDefined();
      expect((globalStorage as Storage).whenReady).toBeDefined();
      expect(MockWorkspaceService.onWorkspaceChanged).toBeCalledTimes(2);
      done();
    });
  });
});
