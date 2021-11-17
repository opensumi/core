import { Domain, CommandContribution, CommandRegistry, ComponentContribution, ComponentRegistry, AppConfig, SlotLocation, localize } from '@ide-framework/ide-core-browser';
import { Autowired } from '@ide-framework/common-di';
import { ToolbarCustomizeComponent, ToolbarCustomizeViewService } from './toolbar-customize';
import { MenuContribution, IMenuRegistry, MenuId } from '@ide-framework/ide-core-browser/lib/menu/next';

@Domain(CommandContribution, ComponentContribution, MenuContribution)
export class ToolbarCustomizeContribution implements CommandContribution, ComponentContribution, MenuContribution {

  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(ToolbarCustomizeViewService)
  viewService: ToolbarCustomizeViewService;

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({
      id: 'toolbar.showCustomizePanel',
      label: 'Show Toolbar Customization',
    }, {
      execute: () => {
        this.viewService.setVisible(true);
      },
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('addon/toolbar-customize', {
      id: 'addon/toolbar-customize',
      component: ToolbarCustomizeComponent,
    });
    if (!this.config.layoutConfig[SlotLocation.extra]) {
      this.config.layoutConfig[SlotLocation.extra] = {
        modules: [],
      };
    }
    this.config.layoutConfig[SlotLocation.extra]!.modules.push('addon/toolbar-customize');
  }

  registerMenus(registry: IMenuRegistry) {
    registry.registerMenuItem(MenuId.KTToolbarLocationContext, {
      command: {
        id: 'toolbar.showCustomizePanel',
        label: localize('toolbar.customize.menu'),
      },
    });
  }

}
