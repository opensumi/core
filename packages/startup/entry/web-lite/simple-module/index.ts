import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { LiteDocumentDataManager, SimpleLanguageService } from '../modules/simple-language-service';
import { SCMRawFileServiceContribution } from '../modules/static-resource/scm-raw';

import { LanguageServiceContribution } from './language-service.contribution';
import { LanguageGrammarContribution } from './language-grammar.contribution';
import { ViewContribution } from './view.contribution';
import { SCMContribution } from './scm.contribution';
import { FSProviderContribution, KtExtFsProviderContribution } from './fs.contribution';
import { ThemeAndIconContribution } from './theme.contribution';

@Injectable()
export class SimpleModule extends BrowserModule {
  providers: Provider[] = [
    LiteDocumentDataManager,
    SimpleLanguageService,
    FSProviderContribution,
    KtExtFsProviderContribution,
    ThemeAndIconContribution,
    SCMRawFileServiceContribution,
    SCMContribution,
    ViewContribution,
    LanguageGrammarContribution,
  ].concat(process.env.LSIF_HOST ? LanguageServiceContribution : (null as any))
   .filter(Boolean);
}
