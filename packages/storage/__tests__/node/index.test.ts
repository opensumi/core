import { Injectable, Injector } from '@ali/common-di';
import { StorageModule } from '../../src/node';
import { IStorageServer, IStoragePathServer, IUpdateRequest, IWorkspaceStorageServer } from '../../src/common';
import { URI, FileUri } from '@ali/ide-core-node';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';

const track = temp.track();
let root: URI;
root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));
@Injectable()
class MockDatabaseStoragePathServer implements IStoragePathServer {

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
  let injector: Injector;
  const storageName = 'global';
  beforeAll(() => {
    injector = createNodeInjector([
      FileServiceModule,
      StorageModule,
    ]);

    injector.overrideProviders({
      token: IStoragePathServer,
      useClass: MockDatabaseStoragePathServer,
    });

    workspaceStorage = injector.get(IWorkspaceStorageServer);
  });

  afterAll(async () => {
    track.cleanupSync();
  });

  describe('01 #init', () => {
    let storagePath;

    it('Storage directory path should be return.', async () => {
      storagePath = await workspaceStorage.init();
      expect(typeof storagePath).toBe('string');
    });
  });

  describe('02 #getItems', () => {
    it('Storage should return {}.', async () => {
      const res = await workspaceStorage.getItems(storageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(0);
    });
  });

  describe('02 #updateItems', () => {
    it('Storage should be updated.', async () => {
      const updateRequest: IUpdateRequest = {
        insert: {
          'id': 2,
          'name': 'test',
        },
        delete: ['id'],
      };
      await workspaceStorage.updateItems(storageName, updateRequest);
      const res = await workspaceStorage.getItems(storageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });
  });
});
