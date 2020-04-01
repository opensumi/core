import { Provider, Injectable } from '@ali/common-di';
import { SearchContribution } from './search.contribution';
import { BrowserModule } from '@ali/ide-core-browser';

import { ContentSearchServerPath } from '../common';
import { ContentSearchClientService } from './search.service';
import { bindSearchPreference } from './search-preferences';
import { SearchKeybindingContext } from './search-keybinding-contexts';

@Injectable()
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    SearchContribution,
    SearchKeybindingContext,
  ];

  backServices = [{
    servicePath: ContentSearchServerPath,
    clientToken: ContentSearchClientService,
  }];

  preferences = bindSearchPreference;
}
