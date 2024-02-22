import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { ContentSearchServerPath, IContentSearchClientService, ISearchTreeService } from '../common';

import { SearchContextKey } from './search-contextkey';
import { bindSearchPreference } from './search-preferences';
import { SearchContribution } from './search.contribution';
import { ContentSearchClientService } from './search.service';
import { SearchTreeService } from './tree/search-tree.service';

@Injectable()
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: SearchContextKey,
      useClass: SearchContextKey,
    },
    {
      token: IContentSearchClientService,
      useClass: ContentSearchClientService,
    },
    {
      token: ISearchTreeService,
      useClass: SearchTreeService,
    },
    SearchContribution,
  ];

  backServices = [
    {
      servicePath: ContentSearchServerPath,
      clientToken: IContentSearchClientService,
    },
  ];

  preferences = bindSearchPreference;
}
