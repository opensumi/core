
import { Autowired } from '@opensumi/di';
import { localize, Domain, IExtensionsPointService, formatLocalize, ClientAppContribution } from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { browserViews } from '@opensumi/ide-core-browser/lib/extensions/schema/browserViews';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

export const EXPLORER_CONTAINER_ID = 'explorer';

@Domain(ClientAppContribution, ComponentContribution)
export class ExplorerContribution implements ComponentContribution {

  @Autowired(IExtensionsPointService)
  protected readonly extensionsPointService: IExtensionsPointService;

  // Explorer 只注册容器
  registerComponent(registry: ComponentRegistry) {
    registry.register('@opensumi/ide-explorer', [], {
      iconClass: getIcon('explorer'),
      title: localize('explorer.title'),
      priority: 10,
      containerId: EXPLORER_CONTAINER_ID,
    });
  }

  onStart() {
    this.extensionsPointService.appendExtensionPoint(['browserViews', 'properties'], {
      extensionPoint: EXPLORER_CONTAINER_ID,
      frameworkKind: ['opensumi'],
      jsonSchema: {
        ...browserViews.properties,
        description: formatLocalize('sumiContributes.browserViews.location.custom', localize('explorer.title')),
      },
    });
  }

}
