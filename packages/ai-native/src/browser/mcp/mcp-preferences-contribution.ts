import { Autowired, Injectable } from '@opensumi/di';
import {
  CodeSchemaId,
  Domain,
  IJSONSchema,
  IJSONSchemaRegistry,
  JsonSchemaContribution,
  MaybePromise,
  PreferenceConfiguration,
  PreferenceContribution,
  PreferenceSchema,
  URI,
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';
import {
  BrowserEditorContribution,
  IResource,
  IResourceProvider,
  ResourceService,
} from '@opensumi/ide-editor/lib/browser';

import { MCPPreferencesSchema, MCPSchema, MCPSchemaUri } from './mcp-preferences';

@Injectable()
export class MCPResourceProvider implements IResourceProvider {
  provideResource(uri: URI): MaybePromise<IResource<any>> {
    return {
      supportsRevive: true,
      name: localize('menu-bar.title.debug'),
      icon: getIcon('debug'),
      uri,
    };
  }

  provideResourceSubname(): string | null {
    return null;
  }

  async shouldCloseResource(): Promise<boolean> {
    return true;
  }
}

@Domain(PreferenceContribution, PreferenceConfiguration, BrowserEditorContribution, JsonSchemaContribution)
export class MCPPreferencesContribution
  implements PreferenceContribution, PreferenceConfiguration, BrowserEditorContribution, JsonSchemaContribution
{
  @Autowired(MCPResourceProvider)
  private readonly prefResourceProvider: MCPResourceProvider;

  schema: PreferenceSchema = MCPPreferencesSchema;
  name = 'mcp';

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider(this.prefResourceProvider);
  }

  registerSchema(registry: IJSONSchemaRegistry) {
    registry.registerSchema(MCPSchemaUri, MCPSchema, ['mcp.json']);
  }
}
