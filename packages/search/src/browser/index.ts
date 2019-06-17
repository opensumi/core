import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule, SlotLocation } from '@ali/ide-core-browser';
import { SearchContribution } from './search-contribution';
import { Search } from './search.view';

@Injectable()
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    SearchContribution,
  ];
  slotMap: SlotMap = new Map([
  ]);

  component = Search;
  iconClass = 'fa-search';
}
