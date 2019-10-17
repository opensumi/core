import { Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { KeybindingContext } from '@ali/ide-core-browser';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common';
import { ContentSearchClientService } from './search.service';
import { SEARCH_CONTAINER_ID, SearchBindingContextIds } from '../common/content-search';

@Domain(KeybindingContext)
export class SearchKeybindingContext implements KeybindingContext {
  @Autowired(ContentSearchClientService)
  searchBrowserService: ContentSearchClientService;

  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  readonly id: string = SearchBindingContextIds.searchInputFocus;

  isEnabled(): boolean {
    return this.searchBrowserService.UIState.isSearchFocus;
  }
}
