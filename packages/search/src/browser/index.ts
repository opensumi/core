import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { SearchContribution } from './search-contribution';
import { Search } from './search.view';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    SearchContribution,
  ];
  component = Search;
  iconClass = 'fa-search';
}
