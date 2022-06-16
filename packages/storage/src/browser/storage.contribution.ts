import { Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  Domain,
  StorageResolverContribution,
  URI,
  IStorage,
  ClientAppContribution,
  STORAGE_SCHEMA,
  AppConfig,
  ScopedBrowserStorageService,
  GlobalBrowserStorageService,
  STORAGE_NAMESPACE,
} from '@opensumi/ide-core-browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IStorageServer, IWorkspaceStorageServer, IGlobalStorageServer } from '../common';

import { Storage } from './storage';

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

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(GlobalBrowserStorageService)
  private globalLocalStorage: GlobalBrowserStorageService;

  storage: IStorage;

  async resolve(storageId: URI) {
    const storageName = storageId.path.toString();
    let storage: IStorage;
    await this.workspaceService.whenReady;
    if (storageId.scheme === STORAGE_SCHEMA.SCOPE) {
      let scopedLocalStorage;
      // 如果是内置的 Storage，在初始化过程中采用 ScopedBrowserStorageService 代理
      if (this.isBuiltinStorage(storageId)) {
        scopedLocalStorage = this.injector.get(ScopedBrowserStorageService, [this.workspaceService.workspace?.uri]);
      }
      storage = new Storage(
        this.workspaceStorage,
        this.workspaceService,
        this.appConfig,
        storageName,
        scopedLocalStorage,
      );
    } else if (storageId.scheme === STORAGE_SCHEMA.GLOBAL) {
      if (this.isBuiltinStorage(storageId)) {
        // 如果是内置的 Storage，在初始化过程中采用 GlobalBrowserStorageService 代理
        storage = new Storage(
          this.globalStorage,
          this.workspaceService,
          this.appConfig,
          storageName,
          this.globalLocalStorage,
        );
      } else {
        storage = new Storage(this.globalStorage, this.workspaceService, this.appConfig, storageName);
      }
    } else {
      return;
    }
    // 等待后台存储模块初始化数据
    await storage.whenReady;

    this.storage = storage;

    return storage;
  }

  isBuiltinStorage(storageId: URI) {
    const keys = Object.keys(STORAGE_NAMESPACE);
    for (const key of keys) {
      if (storageId.isEqual(STORAGE_NAMESPACE[key])) {
        return true;
      }
    }
    return false;
  }

  onReconnect() {
    if (this.storage) {
      this.storage.reConnectInit();
    }
  }
}
