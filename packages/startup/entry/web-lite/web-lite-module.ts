import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { CommonCommandsContribution } from './contributions/common-commands/index.contribution';
import { FileProviderContribution } from './contributions/file-provider/index.contribution';
import { GitSchemeContribution } from './contributions/git-scheme/index.contribution';
import { KtExtFsProviderContribution } from './contributions/kt-ext-provider/index.contribution';
import { LanguageServiceContribution } from './contributions/language-service/index.contribution';
import { TextmateLanguageGrammarContribution } from './contributions/textmate-language-grammar/index.contribution';
import { ThemeAndIconContribution } from './contributions/theme-icon/index.contribution';
import { ViewContribution } from './contributions/view/index.contribution';

import { ICodeService } from './modules/code-service/base';
import { CodeServiceImpl } from './modules/code-service';

import { ILsifService } from './modules/lsif-service/base';
import { LsifServiceImpl } from './modules/lsif-service';
// sample
import { SampleContribution } from './contributions/sample.contribution';

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
    CommonCommandsContribution,
    GitSchemeContribution,
    FileProviderContribution,
    KtExtFsProviderContribution,
    LanguageServiceContribution,
    TextmateLanguageGrammarContribution,
    ThemeAndIconContribution,
    ViewContribution,
    // sample
    SampleContribution,
  ];
}
