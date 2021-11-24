import { Optional, Injectable, Autowired } from '@opensumi/di';
import { IContextKeyService, IContextKey } from '@opensumi/ide-core-browser';
import { ExplorerResourceIsFolderContext, ExplorerViewletVisibleContext, ExplorerFocusedContext, ExplorerResourceCut, FilesExplorerFocusedContext, FilesExplorerInputFocusedContext, FilesExplorerFilteredContext, ExplorerCompressedLastFocusContext, ExplorerCompressedFocusContext, ExplorerCompressedFirstFocusContext } from '@opensumi/ide-core-browser/lib/contextkey/explorer';

@Injectable()
export class FileContextKey {

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  public readonly explorerResourceIsFolder: IContextKey<boolean>;
  public readonly explorerViewletVisibleContext: IContextKey<boolean>;
  public readonly explorerFocused: IContextKey<boolean>;
  public readonly explorerResourceCut: IContextKey<boolean>;
  public readonly filesExplorerFocused: IContextKey<boolean>;
  public readonly filesExplorerInputFocused: IContextKey<boolean>;
  public readonly filesExplorerFilteredContext: IContextKey<boolean>;
  public readonly explorerCompressedFocusContext: IContextKey<boolean>;
  public readonly explorerCompressedFirstFocusContext: IContextKey<boolean>;
  public readonly explorerCompressedLastFocusContext: IContextKey<boolean>;

  private readonly _contextKeyService: IContextKeyService;

  constructor(@Optional() dom: HTMLDivElement) {
    this._contextKeyService = this.globalContextKeyService.createScoped(dom);
    this.explorerResourceIsFolder = ExplorerResourceIsFolderContext.bind(this._contextKeyService);
    this.explorerViewletVisibleContext = ExplorerViewletVisibleContext.bind(this._contextKeyService);
    this.explorerFocused = ExplorerFocusedContext.bind(this._contextKeyService);
    this.explorerResourceCut = ExplorerResourceCut.bind(this._contextKeyService);

    this.filesExplorerFocused = FilesExplorerFocusedContext.bind(this._contextKeyService);
    this.filesExplorerInputFocused = FilesExplorerInputFocusedContext.bind(this._contextKeyService);
    this.filesExplorerFilteredContext = FilesExplorerFilteredContext.bind(this._contextKeyService);

    this.explorerCompressedFocusContext = ExplorerCompressedFocusContext.bind(this._contextKeyService);
    this.explorerCompressedFirstFocusContext = ExplorerCompressedFirstFocusContext.bind(this._contextKeyService);
    this.explorerCompressedLastFocusContext = ExplorerCompressedLastFocusContext.bind(this._contextKeyService);
  }

  get service() {
    return this._contextKeyService;
  }
}
