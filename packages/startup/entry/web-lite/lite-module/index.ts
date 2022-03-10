import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule, LogServiceForClientPath } from '@opensumi/ide-core-browser';
import { CommonServerPath, KeytarServicePath } from '@opensumi/ide-core-common';
import { DebugPreferences } from '@opensumi/ide-debug/lib/browser';
import { ExtensionNodeServiceServerPath } from '@opensumi/ide-extension/lib/common';
import { FileSearchServicePath } from '@opensumi/ide-file-search/lib/common';

import { ExtensionClientService } from './extension';
import { FileProviderContribution } from './file-provider/index.contribution';
import { TextmateLanguageGrammarContribution } from './grammar/index.contribution';
// import { LanguageServiceContribution } from './language-service/language.contribution';
// import { LsifServiceImpl } from './language-service/lsif-service';
// import { ILsifService } from './language-service/lsif-service/base';
import { BrowserCommonServer } from './overrides/browser-common-server';
import { BrowserFileSchemeModule } from './overrides/browser-file-scheme';
import { MockCredentialService } from './overrides/mock-credential.service';
import { MockFileSearch } from './overrides/mock-file-search';
import { MockLogServiceForClient } from './overrides/mock-logger';

@Injectable()
export class WebLiteModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: CommonServerPath,
      useClass: BrowserCommonServer,
    },
    {
      token: ExtensionNodeServiceServerPath,
      useClass: ExtensionClientService,
    },
    {
      token: FileSearchServicePath,
      useClass: MockFileSearch,
    },
    {
      token: LogServiceForClientPath,
      useClass: MockLogServiceForClient,
    },
    {
      token: KeytarServicePath,
      useClass: MockCredentialService,
    },
    {
      token: DebugPreferences,
      useValue: {},
    },
    FileProviderContribution,
    TextmateLanguageGrammarContribution,
    // lsif client. disabled by default
    // {
    //   token: ILsifService,
    //   useClass: LsifServiceImpl,
    // },
    // LanguageServiceContribution,
  ];
}
