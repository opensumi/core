import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { LiteDocumentDataManager, SimpleLanguageService } from '../modules/simple-language-service';
import { SCMRawFileServiceContribution } from '../modules/static-resource/scm-raw';

import { LangContribution } from './lang.contribution';
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
  ].concat(process.env.LSIF_HOST ? LangContribution : (null as any))
   .filter(Boolean);
}
