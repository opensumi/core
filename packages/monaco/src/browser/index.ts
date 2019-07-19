import * as React from 'react';
import MonacoServiceImpl from './monaco.service';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, MonacoService, MonacoContribution } from '@ali/ide-core-browser';
import { MonacoClientContribution } from './monaco.contribution';

@Injectable()
export class MonacoModule extends BrowserModule {
  contributionProvider = [MonacoContribution];

  providers: Provider[] = [
    MonacoClientContribution,
    {
      token: MonacoService,
      useClass: MonacoServiceImpl,
    },
  ];
}
