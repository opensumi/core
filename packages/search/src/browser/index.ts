import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, SlotLocation } from '@ali/ide-core-browser';
import { SearchContribution } from './search-contribution';
import { Search } from './search.view';

@Injectable()
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    SearchContribution,
  ];
  component = Search;
  iconClass = 'fa-search';
}
