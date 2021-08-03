import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { ExplorerFolderContext, ExplorerFocusedContext, ExplorerResourceCut, FilesExplorerFocusedContext, FilesExplorerInputFocusedContext, FilesExplorerFilteredContext, ExplorerCompressedLastFocusContext, ExplorerCompressedFocusContext, ExplorerCompressedFirstFocusContext } from '@ali/ide-core-browser/lib/contextkey/explorer';

@Injectable()
export class FileContextKey {

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  public readonly explorerFolder: IContextKey<boolean>;
  public readonly explorerFocused: IContextKey<boolean>;
  public readonly explorerResourceCut: IContextKey<boolean>;
  public readonly filesExplorerFocused: IContextKey<boolean>;
  public readonly filesExplorerInputFocused: IContextKey<boolean>;
  public readonly filesExplorerFilteredContext: IContextKey<boolean>;
  public readonly explorerCompressedFocusContext: IContextKey<boolean>;
  public readonly explorerCompressedFirstFocusContext: IContextKey<boolean>;
  public readonly explorerCompressedLastFocusContext: IContextKey<boolean>;

  constructor(@Optional() dom: HTMLDivElement) {
    const contextKeyService = this.globalContextKeyService.createScoped(dom);
    this.explorerFolder = ExplorerFolderContext.bind(contextKeyService);
    this.explorerFocused = ExplorerFocusedContext.bind(contextKeyService);
    this.explorerResourceCut = ExplorerResourceCut.bind(contextKeyService);

    this.filesExplorerFocused = FilesExplorerFocusedContext.bind(contextKeyService);
    this.filesExplorerInputFocused = FilesExplorerInputFocusedContext.bind(contextKeyService);
    this.filesExplorerFilteredContext = FilesExplorerFilteredContext.bind(contextKeyService);

    this.explorerCompressedFocusContext = ExplorerCompressedFocusContext.bind(contextKeyService);
    this.explorerCompressedFirstFocusContext = ExplorerCompressedFirstFocusContext.bind(contextKeyService);
    this.explorerCompressedLastFocusContext = ExplorerCompressedLastFocusContext.bind(contextKeyService);
  }
}
