import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { ExplorerFolderContext, ExplorerFocusedContext, ExplorerResourceCut, FilesExplorerFocusedContext, FilesExplorerInputFocusedContext } from '@ali/ide-core-browser/lib/contextkey/explorer';

@Injectable()
export class FileContextKey {

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  public readonly explorerFolder: IContextKey<boolean>;
  public readonly explorerFocused: IContextKey<boolean>;
  public readonly explorerResourceCut: IContextKey<boolean>;
  public readonly filesExplorerFocused: IContextKey<boolean>;
  public readonly filesExplorerInputFocused: IContextKey<boolean>;

  constructor(@Optional() contextKeyService: IContextKeyService) {
    contextKeyService = contextKeyService || this.globalContextKeyService;
    this.explorerFolder = ExplorerFolderContext.bind(contextKeyService);
    this.explorerFocused = ExplorerFocusedContext.bind(contextKeyService);
    this.explorerResourceCut = ExplorerResourceCut.bind(contextKeyService);

    this.filesExplorerFocused = FilesExplorerFocusedContext.bind(contextKeyService);
    this.filesExplorerInputFocused = FilesExplorerInputFocusedContext.bind(contextKeyService);
  }
}
