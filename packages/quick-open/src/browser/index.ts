import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { QuickOpenClientContribution } from './quick-open.contribution';

@EffectDomain(require('../../package.json').name)
export class QuickOpenModule extends BrowserModule {
  providers: Provider[] = [
    QuickOpenClientContribution,
  ];
}
