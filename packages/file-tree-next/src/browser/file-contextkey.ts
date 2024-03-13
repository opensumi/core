import { Autowired, Injectable } from '@opensumi/di';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser';
import {
  ExplorerCompressedFirstFocusContext,
  ExplorerCompressedFocusContext,
  ExplorerCompressedLastFocusContext,
  ExplorerFocusedContext,
  ExplorerResourceCut,
  ExplorerResourceIsFolderContext,
  ExplorerViewletVisibleContext,
  FilesExplorerFilteredContext,
  FilesExplorerFocusedContext,
  FilesExplorerInputFocusedContext,
} from '@opensumi/ide-core-browser/lib/contextkey/explorer';

@Injectable()
export class FileContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  public readonly explorerResourceIsFolder: IContextKey<boolean>;
  public readonly explorerViewletVisibleContext: IContextKey<boolean>;
  public explorerFocused: IContextKey<boolean>;
  public explorerResourceCut: IContextKey<boolean>;
  public filesExplorerFocused: IContextKey<boolean>;
  public filesExplorerInputFocused: IContextKey<boolean>;
  public filesExplorerFilteredContext: IContextKey<boolean>;
  public explorerCompressedFocusContext: IContextKey<boolean>;
  public explorerCompressedFirstFocusContext: IContextKey<boolean>;
  public explorerCompressedLastFocusContext: IContextKey<boolean>;

  private _contextKeyService: IContextKeyService;

  constructor() {
    this.explorerResourceIsFolder = ExplorerResourceIsFolderContext.bind(this.globalContextKeyService);
    this.explorerViewletVisibleContext = ExplorerViewletVisibleContext.bind(this.globalContextKeyService);
  }

  initScopedContext(dom: HTMLDivElement) {
    this._contextKeyService = this.globalContextKeyService.createScoped(dom);
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
