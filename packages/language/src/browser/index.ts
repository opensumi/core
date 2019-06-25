import { Provider, Injectable } from '@ali/common-di';
import { LanguageFrontendContribution } from './language-frontend-contribution';
import { LanguageContribution } from './language-client-contribution';
import { TypescriptClientContribution } from './typescript-client-contribution';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class LanguageModule extends BrowserModule {
  contributionProvider = LanguageContribution;

  providers: Provider[] = [
    LanguageFrontendContribution,
    TypescriptClientContribution,
  ];

}
