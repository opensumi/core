import { Injectable, Autowired } from '@ali/common-di';
import { LocalStorageService } from '@ali/ide-core-browser/lib/services';
import { IWorkspaceService, IWorkspaceStorageService } from '../common';
import { FileStat } from '@ali/ide-file-service';

/*
 * 为存在LocalStorage的数据添加命名空间
 */
@Injectable()
export class WorkspaceStorageService implements IWorkspaceStorageService {

  private prefix: string;
  private initialized: Promise<void>;

  @Autowired(LocalStorageService) protected localStorageService: LocalStorageService;
  @Autowired(IWorkspaceService) protected workspaceService: IWorkspaceService;

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
    return this.localStorageService.setData(fullKey, data);
  }

  async getData<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    await this.initialized;
    const fullKey = this.prefixWorkspaceURI(key);
    return this.localStorageService.getData(fullKey, defaultValue);
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
