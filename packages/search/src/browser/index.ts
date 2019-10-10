import { Provider, Injectable } from '@ali/common-di';
import { SearchContribution } from './search.contribution';
import { FileSearchContribution } from './file-search.contribution';
import { FileSearchServicePath, ContentSearchServerPath } from '../common/';
import { BrowserModule } from '@ali/ide-core-browser';
import { SearchBrowserService } from '../browser/search.service';
import { SearchTreeService } from './search-tree.service';
import { bindSearchPreference } from './search-preferences';
import { SearchKeybindingContext } from './search-keybinding-contexts';

@Injectable()
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    SearchContribution,
    FileSearchContribution,
    SearchKeybindingContext,
  ];

  backServices = [{
    servicePath: FileSearchServicePath,
    clientToken: FileSearchContribution,
  }, {
    servicePath: ContentSearchServerPath,
    clientToken: SearchBrowserService,
  }];

  preferences = bindSearchPreference;
}
