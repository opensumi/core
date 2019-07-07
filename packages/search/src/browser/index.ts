import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { SearchContribution } from './search-contribution';
import { FileSearchContribution } from './file-search-contribution';
import { Search } from './search.view';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { FileSearchServicePath } from '../common/';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class SearchModule extends BrowserModule {
  providers: Provider[] = [
    SearchContribution,
    FileSearchContribution,
  ];
  component = Search;
  iconClass = 'volans_icon search';

  backServices = [{
    servicePath: FileSearchServicePath,
    clientToken: FileSearchContribution,
  }];
}
