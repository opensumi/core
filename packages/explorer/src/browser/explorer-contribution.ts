import { Autowired } from '@opensumi/di';
import {
  localize,
  Domain,
  IExtensionsPointService,
  formatLocalize,
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  EXPLORER_COMMANDS,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { browserViews } from '@opensumi/ide-core-browser/lib/extensions/schema/browserViews';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

export const EXPLORER_CONTAINER_ID = 'explorer';

@Domain(ClientAppContribution, CommandContribution, ComponentContribution)
export class ExplorerContribution implements CommandContribution, ComponentContribution {
  @Autowired(IExtensionsPointService)
  protected readonly extensionsPointService: IExtensionsPointService;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  // Explorer 只注册容器
  registerComponent(registry: ComponentRegistry) {
    registry.register('@opensumi/ide-explorer', [], {
      iconClass: getIcon('explorer'),
      title: localize('explorer.title'),
      priority: 10,
      containerId: EXPLORER_CONTAINER_ID,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(EXPLORER_COMMANDS.TOGGLE_VISIBILITY, {
      execute: () => {
        const tabbarHandler = this.mainlayoutService.getTabbarHandler(EXPLORER_CONTAINER_ID);
        if (tabbarHandler) {
          tabbarHandler.isActivated() ? tabbarHandler.deactivate() : tabbarHandler.activate();
        }
      },
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
