import { Injectable, Autowired } from '@opensumi/di';
import { IContextKeyService, IContextKey } from '@opensumi/ide-core-browser';
import {
  HasSearchResults,
  ReplaceInputBoxFocusedKey,
  SearchInputBoxFocusedKey,
  SearchViewFocusedKey,
} from '@opensumi/ide-core-browser/lib/contextkey/search';

@Injectable()
export class SearchContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextkeyService: IContextKeyService;

  public hasSearchResults: IContextKey<boolean>;
  public searchViewFocusedKey: IContextKey<boolean>;
  public searchInputBoxFocusedKey: IContextKey<boolean>;
  public replaceInputBoxFocusedKey: IContextKey<boolean>;

  private _contextKeyService: IContextKeyService;

  initScopedContext(dom: HTMLDivElement) {
    this._contextKeyService = this.globalContextkeyService.createScoped(dom);
    this.hasSearchResults = HasSearchResults.bind(this._contextKeyService);
    this.searchViewFocusedKey = SearchViewFocusedKey.bind(this._contextKeyService);
    this.searchInputBoxFocusedKey = SearchInputBoxFocusedKey.bind(this._contextKeyService);
    this.replaceInputBoxFocusedKey = ReplaceInputBoxFocusedKey.bind(this._contextKeyService);
  }

  get service() {
    return this._contextKeyService;
  }
}
