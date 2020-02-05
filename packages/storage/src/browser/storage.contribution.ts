import { Domain, StorageResolverContribution, URI, IStorage, ClientAppContribution, STORAGE_SCHEMA, AppConfig } from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { Storage } from './storage';
import { WorkspaceStorageServerPath, GlobalStorageServerPath, IStorageServer } from '../common';
import { IWorkspaceService } from '@ali/ide-workspace';

@Domain(StorageResolverContribution, ClientAppContribution)
export class DatabaseStorageContribution implements StorageResolverContribution, ClientAppContribution {

  @Autowired(WorkspaceStorageServerPath)
  private workspaceStorage: IStorageServer;

  @Autowired(GlobalStorageServerPath)
  private globalStorage: IStorageServer;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  storage: IStorage;

  async resolve(storageId: URI) {
    const storageName = storageId.path.toString();
    let storage: IStorage;
    if (storageId.scheme === STORAGE_SCHEMA.SCOPE) {
      storage = new Storage(this.workspaceStorage, this.workspaceService, this.appConfig, storageName);
    } else if (storageId.scheme === STORAGE_SCHEMA.GLOBAL) {
      storage = new Storage(this.globalStorage, this.workspaceService, this.appConfig, storageName);
    } else {
      return;
    }
    // 等待后台存储模块初始化数据
    await storage.whenReady;

    this.storage = storage;

    return storage;
  }

  onReconnect() {
    if (this.storage) {
      this.storage.reConnectInit();
    }
  }
}
