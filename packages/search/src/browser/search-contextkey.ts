import { Optional, Injectable, Autowired } from '@opensumi/di';
import { IContextKeyService, IContextKey } from '@opensumi/ide-core-browser';
import { RawContextKey } from '@opensumi/ide-core-browser/lib/raw-context-key';

export const CanClearSearchResult = new RawContextKey<boolean>('canClearSearchResult', false);
export const CanRefreshSearchResult = new RawContextKey<boolean>('canRefreshSearchResult', false);
export const SearchInputFocused = new RawContextKey<boolean>('searchInputFocused', false);

@Injectable()
export class SearchContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextkeyService: IContextKeyService;

  public readonly canClearSearchResult: IContextKey<boolean>;
  public readonly canRefreshSearchResult: IContextKey<boolean>;
  public readonly searchInputFocused: IContextKey<boolean>;

  constructor(@Optional() contextKeyService: IContextKeyService) {
    contextKeyService = contextKeyService || this.globalContextkeyService;
    this.canClearSearchResult = CanClearSearchResult.bind(contextKeyService);
    this.canRefreshSearchResult = CanRefreshSearchResult.bind(contextKeyService);
    this.searchInputFocused = SearchInputFocused.bind(contextKeyService);
  }
}
