import { Provider, Injectable } from '@ali/common-di';
import { LanguageFrontendContribution } from './language-frontend-contribution';
import { LanguageContribution } from './language-client-contribution';
import { TypescriptClientContribution } from './typescript-client-contribution';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class LanguageModule extends BrowserModule {
  contributionProvider = LanguageContribution;

  providers: Provider[] = [
    LanguageFrontendContribution,
  ];

}
