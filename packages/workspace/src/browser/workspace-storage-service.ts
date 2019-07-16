import { Injectable, Autowired } from '@ali/common-di';
import { StorageService, LocalStorageService } from '@ali/ide-core-browser/lib/services';
import { WorkspaceService } from './workspace-service';
import { FileStat } from '@ali/ide-file-service';

/*
 * 为存在LocalStorage的数据添加命名空间
 */
@Injectable()
export class WorkspaceStorageService implements StorageService {

  private prefix: string;
  private initialized: Promise<void>;

  @Autowired(LocalStorageService) protected storageService: StorageService;
  @Autowired(WorkspaceService) protected workspaceService: WorkspaceService;

  constructor() {
    this.init();
  }

  protected init() {
    this.initialized = this.workspaceService.roots.then(() => {
      this.updatePrefix();
      this.workspaceService.onWorkspaceLocationChanged(() => this.updatePrefix());
    });
  }

  async setData<T>(key: string, data: T): Promise<void> {
    if (!this.prefix) {
      await this.initialized;
    }
    const fullKey = this.prefixWorkspaceURI(key);
    return this.storageService.setData(fullKey, data);
  }

  async getData<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    await this.initialized;
    const fullKey = this.prefixWorkspaceURI(key);
    return this.storageService.getData(fullKey, defaultValue);
  }

  protected prefixWorkspaceURI(originalKey: string): string {
    return `${this.prefix}:${originalKey}`;
  }

  protected getPrefix(workspaceStat: FileStat | undefined): string {
    return workspaceStat ? workspaceStat.uri : '_global_';
  }

  private updatePrefix(): void {
    this.prefix = this.getPrefix(this.workspaceService.workspace);
  }
}
