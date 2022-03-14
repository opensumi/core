import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { ContentSearchServerPath } from '../common';

import { SearchContextKey } from './search-contextkey';
import { bindSearchPreference } from './search-preferences';
import { SearchContribution } from './search.contribution';
import { ContentSearchClientService } from './search.service';

@Injectable()
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: SearchContextKey,
      useClass: SearchContextKey,
    },
    SearchContribution,
  ];

  backServices = [
    {
      servicePath: ContentSearchServerPath,
      clientToken: ContentSearchClientService,
    },
  ];

  preferences = bindSearchPreference;
}
