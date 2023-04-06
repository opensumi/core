import { Injectable, Autowired } from '@opensumi/di';
import { IEventBus } from '@opensumi/ide-core-browser';
import { StorageProvider, IStorage, STORAGE_NAMESPACE, BasicEvent } from '@opensumi/ide-core-common';

export class FileTreeDelectEvent extends BasicEvent<void> {}

@Injectable()
export class RecentStorage {
  @Autowired(StorageProvider)
  private getStorage: StorageProvider;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private recentStorage: IStorage;
  private recentGlobalStorage: IStorage;

  constructor() {
    this.initialize();
  }

  initialize() {
    this.eventBus.on(FileTreeDelectEvent, async () => {
      this.recentStorage = await this.getStorage(STORAGE_NAMESPACE.RECENT_DATA);
    });
  }

  public async getScopeStorage() {
    this.recentStorage = this.recentStorage || (await this.getStorage(STORAGE_NAMESPACE.RECENT_DATA));
    return this.recentStorage;
  }

  public async getGlobalStorage() {
    this.recentGlobalStorage =
      this.recentGlobalStorage || (await this.getStorage(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA));
    return this.recentGlobalStorage;
  }
}
