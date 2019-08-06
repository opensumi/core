import { Domain, StorageResolverContribution, URI, IStorage, ClientAppContribution } from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { DatabaseStorage } from './storage';
import { DatabaseStorageServerPath, IDatabaseStorageServer } from '../common';

@Domain(StorageResolverContribution)
export class DatabaseStorageContribution implements StorageResolverContribution {

  @Autowired(DatabaseStorageServerPath)
  database: IDatabaseStorageServer;

  async resolve(storageId: URI) {
    const storageName = storageId.path.toString();
    if (storageId.scheme !== 'db') {
      return;
    }
    const storage: IStorage = new DatabaseStorage(this.database, storageName);
    // 等待后台存储模块初始化数据
    await storage.whenReady;

    return storage;
  }
}
