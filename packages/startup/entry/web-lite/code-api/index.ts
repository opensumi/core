import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { CodeAPIContribution } from './code-api.contribution';
import { CodeAPIProvider } from './code-api.provider';
import { ICodeAPIProvider } from './common/types';

@Injectable()
export class CodeAPIModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: ICodeAPIProvider,
      useClass: CodeAPIProvider,
    },
    CodeAPIContribution,
  ];
}
