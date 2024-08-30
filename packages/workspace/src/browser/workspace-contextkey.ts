import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser';
import {
  VirtualWorkspace,
  WorkbenchState,
  WorkspaceFolderCount,
  WorkspaceTrusted,
} from '@opensumi/ide-core-browser/lib/contextkey';

@Injectable()
export class WorkspaceContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  public readonly workbenchStateContextKey: IContextKey<string>;
  public readonly workspaceFolderCountContextKey: IContextKey<number>;
  public readonly workspaceTrustedContextKey: IContextKey<boolean>;
  public readonly virtualWorkspaceContextKey: IContextKey<boolean>;

  constructor(@Optional() contextKeyService: IContextKeyService) {
    contextKeyService = contextKeyService || this.globalContextKeyService;
    this.workbenchStateContextKey = WorkbenchState.bind(contextKeyService);
    this.workspaceFolderCountContextKey = WorkspaceFolderCount.bind(contextKeyService);
    this.workspaceTrustedContextKey = WorkspaceTrusted.bind(contextKeyService);
    this.virtualWorkspaceContextKey = VirtualWorkspace.bind(contextKeyService);
  }
}
