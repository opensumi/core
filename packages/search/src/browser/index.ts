import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { SearchContribution } from './search.contribution';
import { FileSearchContribution } from './file-search.contribution';
import { Search } from './search.view';
import { FileSearchServicePath, ContentSearchServerPath } from '../common/';
import { BrowserModule } from '@ali/ide-core-browser';
import { SearchBrowserService } from '../browser/search.service';

@Injectable()
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    SearchContribution,
    FileSearchContribution,
  ];

  backServices = [{
    servicePath: FileSearchServicePath,
    clientToken: FileSearchContribution,
  }, {
    servicePath: ContentSearchServerPath,
    clientToken: SearchBrowserService,
  }];
}
