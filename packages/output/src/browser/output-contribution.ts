import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { BottomPanelService } from '@ali/ide-bottom-panel/lib/browser/bottom-panel.service';
import { Output } from './output.view';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';

@Domain(CommandContribution, KeybindingContribution, MenuContribution, LayoutContribution, MainLayoutContribution)
export class OutputContribution implements CommandContribution, KeybindingContribution, MenuContribution, LayoutContribution, MainLayoutContribution {

  @Autowired()
  private bottomPanelService: BottomPanelService;

  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  onDidCreateSlot() {
    const handler = this.layoutService.registerTabbarComponent({
      component: Output,
      title: '输出',
      iconClass: 'volans_icon withdraw',
    }, 'right');
    // setTimeout(() => handler!.activate(), 2000);
    // setTimeout(() => handler!.dispose(), 3000);
    // setTimeout(() => handler!.setSize(500), 3000);
    setTimeout(() => handler!.setBadge('3'));
    // setTimeout(() => {
    //   handler!.setComponent(OutputTest);
    // }, 2000);
  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerMenus(menus: MenuModelRegistry): void {

  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-output', {
      component: Output,
      title: '输出',
    });
  }
}
