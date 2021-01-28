import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { WorkbenchState, WorkspaceFolderCount } from '@ali/ide-core-browser/lib/contextkey';

@Injectable()
export class WorkspaceContextKey {

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  public readonly workbenchStateContextKey: IContextKey<string>;
  public readonly workspaceFolderCountContextKey: IContextKey<number>;

  constructor(@Optional() contextKeyService: IContextKeyService) {
    contextKeyService = contextKeyService || this.globalContextKeyService;
    this.workbenchStateContextKey = WorkbenchState.bind(contextKeyService);
    this.workspaceFolderCountContextKey = WorkspaceFolderCount.bind(contextKeyService);
  }
}
