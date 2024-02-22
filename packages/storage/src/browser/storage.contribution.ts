import { Autowired } from '@opensumi/di';
import {
  AppConfig,
  Domain,
  GlobalBrowserStorageService,
  IStorage,
  STORAGE_NAMESPACE,
  STORAGE_SCHEMA,
  ScopedBrowserStorageService,
  StorageResolverContribution,
  URI,
} from '@opensumi/ide-core-browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { IGlobalStorageServer, IStorageServer, IWorkspaceStorageServer } from '../common';

import { Storage } from './storage';

@Domain(StorageResolverContribution)
export class DatabaseStorageContribution implements StorageResolverContribution {
  @Autowired(IWorkspaceStorageServer)
  private workspaceStorage: IStorageServer;

  @Autowired(IGlobalStorageServer)
  private globalStorage: IStorageServer;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(GlobalBrowserStorageService)
  private globalLocalStorage: GlobalBrowserStorageService;

  @Autowired(ScopedBrowserStorageService)
  private scopedLocalStorage: ScopedBrowserStorageService;

  private cache: Map<string, IStorage> = new Map();

  async resolve(storageId: URI) {
    const storageName = storageId.path.toString();
    let storage: IStorage;
    const cache = this.cache.get(storageId.toString());
    if (cache) {
      storage = cache;
    } else {
      if (storageId.scheme === STORAGE_SCHEMA.SCOPE) {
        // 如果是内置的 Storage，在初始化过程中采用 ScopedBrowserStorageService 代理
        if (this.isBuiltinStorage(storageId)) {
          storage = new Storage(
            this.workspaceStorage,
            this.workspaceService,
            this.appConfig,
            storageName,
            false,
            this.scopedLocalStorage,
          );
        } else {
          storage = new Storage(this.workspaceStorage, this.workspaceService, this.appConfig, storageName, false);
        }
      } else if (storageId.scheme === STORAGE_SCHEMA.GLOBAL) {
        if (this.isBuiltinStorage(storageId)) {
          // 如果是内置的 Storage，在初始化过程中采用 GlobalBrowserStorageService 代理
          storage = new Storage(
            this.globalStorage,
            this.workspaceService,
            this.appConfig,
            storageName,
            true,
            this.globalLocalStorage,
          );
        } else {
          storage = new Storage(this.globalStorage, this.workspaceService, this.appConfig, storageName, true);
        }
      } else {
        return;
      }
      this.cache.set(storageId.toString(), storage);
    }

    // 等待后台存储模块初始化数据
    await storage.whenReady;
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
}
