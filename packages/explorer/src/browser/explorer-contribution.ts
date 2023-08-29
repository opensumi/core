import { Autowired } from '@opensumi/di';
import { localize, Domain, getIcon, formatLocalize, ClientAppContribution } from '@opensumi/ide-core-browser';
import { EXPLORER_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import { browserViews } from '@opensumi/ide-core-browser/lib/extensions/schema/browserViews';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { IExtensionsSchemaService } from '@opensumi/ide-core-common';

export { EXPLORER_CONTAINER_ID };

@Domain(ClientAppContribution, ComponentContribution)
export class ExplorerContribution implements ClientAppContribution, ComponentContribution {
  @Autowired(IExtensionsSchemaService)
  protected readonly extensionsSchemaService: IExtensionsSchemaService;

  /**
   * register `explorer` component container
   */
  registerComponent(registry: ComponentRegistry) {
    registry.register('@opensumi/ide-explorer', [], {
      iconClass: getIcon('explorer'),
      title: localize('explorer.title'),
      priority: 10,
      containerId: EXPLORER_CONTAINER_ID,
      activateKeyBinding: 'ctrlcmd+shift+e',
    });
  }

  onStart() {
    this.extensionsSchemaService.appendExtensionPoint(['browserViews', 'properties'], {
      extensionPoint: EXPLORER_CONTAINER_ID,
      frameworkKind: ['opensumi'],
      jsonSchema: {
        ...browserViews.properties,
        description: formatLocalize('sumiContributes.browserViews.location.custom', localize('explorer.title')),
      },
    });
  }
}
