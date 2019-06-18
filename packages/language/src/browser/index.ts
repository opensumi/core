import { Provider, Injectable } from '@ali/common-di';
import { LanguageFrontendContribution } from './language-frontend-contribution';
import { BrowserModule } from '@ali/ide-core-browser';
import { LanguageContribution } from './language-client-contribution';
import { TypescriptClientContribution } from './typescript-client-contribution';

@Injectable()
export class LanguageModule extends BrowserModule {
  contributionProvider = LanguageContribution;

  providers: Provider[] = [
    LanguageFrontendContribution,
    TypescriptClientContribution,
  ];

}
