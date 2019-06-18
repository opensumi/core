import { Provider, Injectable } from '@ali/common-di';
import { MainLayout } from './main-layout.view';
import { MainLayoutContribution } from './main-layout.contribution';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class MainLayoutModule extends BrowserModule {
  providers: Provider[] = [
    MainLayoutContribution,
  ];
  component: React.FunctionComponent = MainLayout;
}
