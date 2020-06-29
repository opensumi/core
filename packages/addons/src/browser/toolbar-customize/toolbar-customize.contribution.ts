import { Domain, CommandContribution, CommandRegistry, ComponentContribution, ComponentRegistry, AppConfig, SlotLocation, localize } from '@ali/ide-core-browser';
import { Autowired } from '@ali/common-di';
import { ToolbarCustomizeComponent, ToolbarCustomizeViewService } from './toolbar-customize';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

@Domain(CommandContribution, ComponentContribution, NextMenuContribution)
export class ToolbarCustomizeContribution implements CommandContribution, ComponentContribution, NextMenuContribution {

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

  registerNextMenus(registry: IMenuRegistry) {
    registry.registerMenuItem(MenuId.KTToolbarLocationContext, {
      command: {
        id: 'toolbar.showCustomizePanel',
        label: localize('toolbar.customize.menu'),
      },
    });
  }

}
