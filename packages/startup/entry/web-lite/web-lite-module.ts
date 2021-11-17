import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { CommonServerPath } from '@ide-framework/ide-core-common';

import { CommonCommandsContribution } from './modules/common-commands/index.contribution';
import { FileProviderContribution } from './modules/file-provider/index.contribution';
import { GitSchemeContribution } from './modules/git-scheme/index.contribution';
import { KtExtFsProviderContribution } from './modules/kt-ext-provider/index.contribution';
import { LanguageServiceContribution } from './modules/language-service/index.contribution';
import { TextmateLanguageGrammarContribution } from './modules/textmate-language-grammar/index.contribution';
import { ViewContribution } from './modules/view/index.contribution';

import { ICodeService } from './services/code-service/base';
import { CodeServiceImpl } from './services/code-service';
import { ILsifService } from './services/lsif-service/base';
import { LsifServiceImpl } from './services/lsif-service';
import { BrowserCommonServer } from './overrides/browser-common-server';
// sample
import { SampleContribution } from './modules/sample.contribution';
import { SCMProviderContribution } from './modules/scm-provider/index.contribution';

@Injectable()
export class WebLiteModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: ICodeService,
      useClass: CodeServiceImpl,
    },
    {
      token: ILsifService,
      useClass: LsifServiceImpl,
    },
    {
      token: CommonServerPath,
      useClass: BrowserCommonServer,
    },
    CommonCommandsContribution,
    GitSchemeContribution,
    FileProviderContribution,
    KtExtFsProviderContribution,
    LanguageServiceContribution,
    TextmateLanguageGrammarContribution,
    ViewContribution,
    // sample
    SampleContribution,
    // scm provider sample
    SCMProviderContribution,
  ];
}
