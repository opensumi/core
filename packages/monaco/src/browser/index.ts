import MonacoServiceImpl from './monaco.service';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, MonacoService, MonacoContribution, IContextKeyService, ISchemaStore, JsonSchemaContribution, ISchemaRegistry, IMimeService } from '@ali/ide-core-browser';
import { MonacoClientContribution } from './monaco.contribution';
import { SchemaStore, SchemaRegistry } from './schema-registry';
import { MonacoMimeService } from './monaco-mime';
import { MonacoContextKeyService } from './monaco.context-key.service';

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
      token: ISchemaStore,
      useClass: SchemaStore,
    },
    {
      token: ISchemaRegistry,
      useClass: SchemaRegistry,
    },
    {
      token: IMimeService,
      useClass: MonacoMimeService,
    },
    {
      token: IContextKeyService,
      useClass: MonacoContextKeyService,
    },
  ];
}
