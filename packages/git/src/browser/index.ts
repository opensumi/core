import { Provider, Injectable } from '@ali/common-di';
import { GitContribution } from './git-contribution';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class GitModule extends BrowserModule {
  providers: Provider[] = [
    GitContribution,
  ];
}
