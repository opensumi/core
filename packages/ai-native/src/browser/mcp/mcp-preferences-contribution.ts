import { Autowired, Injectable } from '@opensumi/di';
import {
  Domain,
  MaybePromise,
  PreferenceConfiguration,
  PreferenceContribution,
  PreferenceSchema,
  URI,
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';
import { IResource, IResourceProvider, ResourceService } from '@opensumi/ide-editor/lib/browser';

import { MCPPreferencesSchema } from './mcp-preferences';

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

@Domain(PreferenceContribution, PreferenceConfiguration)
export class MCPPreferencesContribution implements PreferenceContribution, PreferenceConfiguration {
  @Autowired(MCPResourceProvider)
  private readonly prefResourceProvider: MCPResourceProvider;

  schema: PreferenceSchema = MCPPreferencesSchema;
  name = 'mcp';

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider(this.prefResourceProvider);
  }
}
