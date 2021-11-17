import { Domain, StorageResolverContribution, URI, IStorage, ClientAppContribution, STORAGE_SCHEMA, AppConfig } from '@ide-framework/ide-core-browser';
import { Autowired } from '@ide-framework/common-di';
import { Storage } from './storage';
import { IStorageServer, IWorkspaceStorageServer, IGlobalStorageServer } from '../common';
import { IWorkspaceService } from '@ide-framework/ide-workspace';

@Domain(StorageResolverContribution, ClientAppContribution)
export class DatabaseStorageContribution implements StorageResolverContribution, ClientAppContribution {

  @Autowired(IWorkspaceStorageServer)
  private workspaceStorage: IStorageServer;

  @Autowired(IGlobalStorageServer)
  private globalStorage: IStorageServer;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  storage: IStorage;

  private resolvedStorages: Map<string, IStorage> = new Map();

  async resolve(storageId: URI) {
    const storageName = storageId.path.toString();
    if (this.resolvedStorages.has(storageName)) {
      return this.resolvedStorages.get(storageName);
    }

    let storage: IStorage;
    if (storageId.scheme === STORAGE_SCHEMA.SCOPE) {
      storage = new Storage(this.workspaceStorage, this.workspaceService, this.appConfig, storageName);
    } else if (storageId.scheme === STORAGE_SCHEMA.GLOBAL) {
      storage = new Storage(this.globalStorage, this.workspaceService, this.appConfig, storageName);
    } else {
      return;
    }

    this.resolvedStorages.set(storageName, storage);
    // 等待后台存储模块初始化数据
    await storage.whenReady;

    return storage;
  }

  onReconnect() {
    if (this.storage) {
      this.storage.reConnectInit();
    }
  }
}
