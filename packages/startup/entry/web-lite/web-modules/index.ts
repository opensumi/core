import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { LanguageGrammarContribution } from './language-grammar.contribution';

@Injectable()
export class WebLiteModule extends BrowserModule {
  providers: Provider[] = [
    LanguageGrammarContribution,
  ];
}
