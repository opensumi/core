import * as React from 'react';
import MonacoServiceImpl from './monaco.service';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, MonacoService, MonacoContribution, IContextKeyService, SchemaStore, JsonSchemaContribution } from '@ali/ide-core-browser';
import { MonacoClientContribution } from './monaco.contribution';
import { SchemaStoreImpl } from './schema-registry';

@Injectable()
export class MonacoModule extends BrowserModule {
  contributionProvider = [MonacoContribution, JsonSchemaContribution];

  providers: Provider[] = [
    MonacoClientContribution,
    {
      token: MonacoService,
      useClass: MonacoServiceImpl,
    },
    {
      token: SchemaStore,
      useClass: SchemaStoreImpl,
    },
  ];
}
