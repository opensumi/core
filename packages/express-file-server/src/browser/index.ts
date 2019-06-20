import { Provider, Injectable } from '@ali/common-di';
import { ExpressFileServerContribution } from './file-server.contribution';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class ExpressFileServerModule extends BrowserModule {
  providers: Provider[] = [
    ExpressFileServerContribution,
  ];
}
