import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { SampleContribution } from './sample.contribution';
import { LangContribution } from './lang.contribution';
import { LiteDocumentDataManager, SimpleLanguageService } from '../modules/simple-language-service';
import { SCMContribution } from './scm.contribution';
import { SCMRawFileServiceContribution } from '../modules/static-resource/scm-raw';

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
    SampleContribution,
  ].concat(process.env.LSIF_HOST ? LangContribution : (null as any))
   .filter(Boolean);
}
