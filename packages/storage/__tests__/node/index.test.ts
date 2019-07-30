import { Injectable, Injector } from '@ali/common-di';
import { StorageModule } from '../../src/node';
import { IDatabaseStorageServer, IDatabaseStoragePathServer, IUpdateRequest } from '../../src/common';
import { URI, FileUri } from '@ali/ide-core-node';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { FileServiceModule } from '@ali/ide-file-service/lib/node';

const track = temp.track();
let root: URI;
root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));
@Injectable()
class MockDatabaseStoragePathServer implements IDatabaseStoragePathServer {

  async getLastStoragePath() {
    return root.resolve('datas').toString();
  }

  async provideStorageDirPath(): Promise<string | undefined> {
    return root.resolve('datas').toString();
  }
  // 返回数据存储文件夹
  async getGlobalStorageDirPath(): Promise<string> {
    return root.toString();
  }
}

describe('DatabaseStorageServer should be work', () => {
  let databaseStorageServer: IDatabaseStorageServer;
  let injector: Injector;
  beforeAll(() => {
    injector = createNodeInjector([
      FileServiceModule,
      StorageModule,
    ]);

    injector.overrideProviders({
      token: IDatabaseStoragePathServer,
      useClass: MockDatabaseStoragePathServer,
    });

    databaseStorageServer = injector.get(IDatabaseStorageServer);
  });

  afterAll(async () => {
    track.cleanupSync();
  });

  describe('01 #init', () => {
    let storagePath;

    it('Storage directory path should be return.', async () => {
      storagePath = await databaseStorageServer.init('global');
      expect(typeof storagePath).toBe('string');
    });
  });

  describe('02 #getItems', () => {
    it('Storage should return {}.', async () => {
      const res = await databaseStorageServer.getItems();
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
      await databaseStorageServer.updateItems(updateRequest);
      const res = await databaseStorageServer.getItems();
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });
  });
});
