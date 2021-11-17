import { Provider, Injectable } from '@ide-framework/common-di';
import { SearchContribution } from './search.contribution';
import { BrowserModule } from '@ide-framework/ide-core-browser';

import { ContentSearchServerPath } from '../common';
import { ContentSearchClientService } from './search.service';
import { bindSearchPreference } from './search-preferences';
import { SearchContextKey } from './search-contextkey';

@Injectable()
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: SearchContextKey,
      useClass: SearchContextKey,
    },
    SearchContribution,
  ];

  backServices = [{
    servicePath: ContentSearchServerPath,
    clientToken: ContentSearchClientService,
  }];

  preferences = bindSearchPreference;
}
