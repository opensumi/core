import { Provider, Injectable } from '@opensumi/di';
import {
  BrowserModule,
  MonacoService,
  MonacoContribution,
  IContextKeyService,
  ISchemaStore,
  JsonSchemaContribution,
  IJSONSchemaRegistry,
  MonacoOverrideServiceRegistry,
} from '@opensumi/ide-core-browser';
import { IConfigurationService } from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';

import { MonacoContextKeyService } from './monaco.context-key.service';
import { ConfigurationService } from './monaco.context-key.service';
import { MonacoClientContribution } from './monaco.contribution';
import MonacoServiceImpl from './monaco.service';
import { MonacoOverrideServiceRegistryImpl } from './override.service.registry';
import { SchemaStore, SchemaRegistry } from './schema-registry';

import './contrib/merge-editor/view/merge-editor.module.less';

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
      token: MonacoOverrideServiceRegistry,
      useClass: MonacoOverrideServiceRegistryImpl,
    },
    {
      token: IJSONSchemaRegistry,
      useClass: SchemaRegistry,
    },
    {
      token: IContextKeyService,
      useClass: MonacoContextKeyService,
    },
    {
      token: IConfigurationService,
      useClass: ConfigurationService,
    },
  ];
}
