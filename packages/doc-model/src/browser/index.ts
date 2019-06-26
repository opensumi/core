import * as React from 'react';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { documentService } from '../common';
import { BrowserDocumentService } from './provider';
import { DocModelContribution } from './doc-model.contribution';
import { RemoteProvider, EmptyProvider } from './provider';
export * from './event';

const pkgJson = require('../../package.json');

@EffectDomain(pkgJson.name)
export class DocModelModule extends BrowserModule {
  providers: Provider[] = [
    DocModelContribution,
    {
      token: RemoteProvider.symbol,
      useClass: RemoteProvider,
    },
    {
      token: EmptyProvider.symbol,
      useClass: EmptyProvider,
    },
  ];

  backServices = [
    {
      servicePath: documentService,
      clientToken: BrowserDocumentService,
    },
  ];
}
