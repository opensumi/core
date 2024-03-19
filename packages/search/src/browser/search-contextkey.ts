import { Autowired, Injectable } from '@opensumi/di';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser';
import {
  HasSearchResults,
  SearchInputBoxFocusedKey,
  SearchViewFocusedKey,
  SearchViewVisibleKey,
} from '@opensumi/ide-core-browser/lib/contextkey/search';

@Injectable()
export class SearchContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextkeyService: IContextKeyService;

  public hasSearchResults: IContextKey<boolean>;
  public searchViewFocusedKey: IContextKey<boolean>;
  public searchInputBoxFocusedKey: IContextKey<boolean>;

  public searchViewVisibleKey: IContextKey<boolean>;

  private _contextKeyService: IContextKeyService;

  initScopedContext(dom: HTMLDivElement) {
    this._contextKeyService = this.globalContextkeyService.createScoped(dom);
    this.searchViewFocusedKey = SearchViewFocusedKey.bind(this._contextKeyService);
    this.searchInputBoxFocusedKey = SearchInputBoxFocusedKey.bind(this._contextKeyService);
    this.hasSearchResults = HasSearchResults.bind(this._contextKeyService);
    this.searchViewVisibleKey = SearchViewVisibleKey.bind(this._contextKeyService);
  }

  get service() {
    return this._contextKeyService;
  }
}
