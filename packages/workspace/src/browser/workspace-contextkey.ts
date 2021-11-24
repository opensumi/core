import { Optional, Injectable, Autowired } from '@opensumi/common-di';
import { IContextKeyService, IContextKey } from '@opensumi/ide-core-browser';
import { WorkbenchState, WorkspaceFolderCount } from '@opensumi/ide-core-browser/lib/contextkey';

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
