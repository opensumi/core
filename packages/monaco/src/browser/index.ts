import { Injectable, Provider } from '@opensumi/di';
import {
  BrowserModule,
  IContextKeyService,
  IJSONSchemaRegistry,
  ISchemaStore,
  JsonSchemaContribution,
  MonacoContribution,
  MonacoOverrideServiceRegistry,
  MonacoService,
} from '@opensumi/ide-core-browser';
import { IConfigurationService } from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';

import { ConfigurationService, MonacoContextKeyService } from './monaco.context-key.service';
import { MonacoClientContribution } from './monaco.contribution';
import MonacoServiceImpl from './monaco.service';
import { MonacoOverrideServiceRegistryImpl } from './override.service.registry';
import { SchemaRegistry, SchemaStore } from './schema-registry';

import './contrib/merge-editor/view/merge-editor.module.less';

export * as monacoBrowser from './monaco-exports';

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
