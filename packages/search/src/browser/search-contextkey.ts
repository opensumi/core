import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { RawContextKey } from '@ali/ide-core-browser/lib/raw-context-key';

export const CanClearSearchResult = new RawContextKey<boolean>('canClearSearchResult', false);
export const CanRefreshSearchResult = new RawContextKey<boolean>('canRefreshSearchResult', false);

@Injectable()
export class SearchContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextkeyService: IContextKeyService;

  public readonly canClearSearchResult: IContextKey<boolean>;
  public readonly canRefreshSearchResult: IContextKey<boolean>;

  constructor(@Optional() contextKeyService: IContextKeyService) {
    contextKeyService = contextKeyService || this.globalContextkeyService;
    this.canClearSearchResult = CanClearSearchResult.bind(contextKeyService);
    this.canRefreshSearchResult = CanRefreshSearchResult.bind(contextKeyService);
  }
}
