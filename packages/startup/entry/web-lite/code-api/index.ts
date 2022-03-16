import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ICodeAPIProvider } from './common/types';
import { CodeAPIProvider } from './code-api.provider';
import { CodeAPIContribution } from './code-api.contribution';

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
