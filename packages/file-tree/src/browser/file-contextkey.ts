import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { ExplorerFolderContext, ExplorerFocusedContext, ExplorerResourceCut, FilesExplorerFocusedContext } from '@ali/ide-core-browser/lib/contextkey/explorer';

@Injectable({ multiple: true })
export class FileContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextkeyService: IContextKeyService;

  public readonly explorerFolder: IContextKey<boolean>;
  public readonly explorerFocused: IContextKey<boolean>;
  public readonly explorerResourceCut: IContextKey<boolean>;
  public readonly filesExplorerFocused: IContextKey<boolean>;

  constructor(@Optional() contextKeyService: IContextKeyService) {
    contextKeyService = contextKeyService || this.globalContextkeyService;
    this.explorerFolder = ExplorerFolderContext.bind(contextKeyService);
    this.explorerFocused = ExplorerFocusedContext.bind(contextKeyService);
    this.explorerResourceCut = ExplorerResourceCut.bind(contextKeyService);

    this.filesExplorerFocused = FilesExplorerFocusedContext.bind(contextKeyService);
  }
}
